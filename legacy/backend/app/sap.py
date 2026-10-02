import base64
import hashlib
import ipaddress
import json
import logging
import os
import socket
from functools import lru_cache
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Integration

logger = logging.getLogger(__name__)


def _check_public_https_url(value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("SAP endpoints must be HTTPS URLs without embedded credentials")
    if get_settings().app_env != "development":
        try:
            addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise ValueError("SAP endpoint hostname could not be resolved") from exc
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if not ip.is_global:
                raise ValueError("SAP endpoints must resolve to public IP addresses")


def _secret_name(workspace_id: str) -> str:
    settings = get_settings()
    digest = hashlib.sha256(workspace_id.encode()).hexdigest()[:32]
    return f"{settings.sap_secret_name_prefix}-{digest}"


def _local_key() -> bytes:
    encoded = get_settings().app_encryption_key
    if not encoded:
        raise RuntimeError("APP_ENCRYPTION_KEY is required to save SAP credentials in local development")
    try:
        key = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    except (ValueError, TypeError) as exc:
        raise RuntimeError("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key") from exc
    if len(key) != 32:
        raise RuntimeError("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key")
    return key


@lru_cache
def _vault_client():
    from azure.identity import DefaultAzureCredential
    from azure.keyvault.secrets import SecretClient

    settings = get_settings()
    if not settings.key_vault_url:
        raise RuntimeError("KEY_VAULT_URL is required for SAP credential storage")
    credential = DefaultAzureCredential()
    return SecretClient(vault_url=settings.key_vault_url, credential=credential)


def save_secret(workspace_id: str, secret: str) -> str | None:
    settings = get_settings()
    if settings.key_vault_url:
        client = _vault_client()
        name = _secret_name(workspace_id)
        client.set_secret(name, secret)
        return name
    if settings.app_env != "development":
        raise RuntimeError("SAP credentials must be stored in Azure Key Vault")
    key = _local_key()
    nonce = os.urandom(12)
    encrypted = AESGCM(key).encrypt(nonce, secret.encode(), workspace_id.encode())
    return "local:" + base64.urlsafe_b64encode(nonce + encrypted).decode()


def load_secret(integration: Integration) -> str:
    settings = get_settings()
    if integration.secret_ref and integration.secret_ref.startswith("local:"):
        if settings.app_env != "development":
            raise RuntimeError("Local encrypted secret cannot be used outside development")
        payload = base64.urlsafe_b64decode(integration.secret_ref.removeprefix("local:"))
        return AESGCM(_local_key()).decrypt(payload[:12], payload[12:], integration.workspace_id.encode()).decode()
    if integration.secret_ref:
        client = _vault_client()
        return client.get_secret(integration.secret_ref).value or ""
    raise RuntimeError("SAP client secret is not configured")


def validate_endpoints(base_url: str, token_url: str) -> None:
    parsed_base_url = urlparse(base_url)
    if parsed_base_url.path not in {"", "/"} or parsed_base_url.query or parsed_base_url.fragment:
        raise ValueError("SAP API base URL must contain only the HTTPS system host")
    parsed_token_url = urlparse(token_url)
    if parsed_token_url.query or parsed_token_url.fragment:
        raise ValueError("SAP OAuth token URL must not contain a query string or fragment")
    _check_public_https_url(base_url)
    _check_public_https_url(token_url)


async def test_connection(integration: Integration, session: Session) -> dict:
    base_url = integration.base_url.rstrip("/")
    validate_endpoints(base_url, integration.token_url)
    client_secret = load_secret(integration)
    token_data = {"grant_type": "client_credentials"}
    if integration.scopes:
        token_data["scope"] = integration.scopes
    auth = None
    if integration.auth_method == "client_secret_basic":
        auth = (integration.client_id, client_secret)
    else:
        token_data["client_id"] = integration.client_id
        token_data["client_secret"] = client_secret

    timeout = httpx.Timeout(15.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, trust_env=False) as client:
        token_response = await client.post(integration.token_url, data=token_data, auth=auth)
        if token_response.status_code >= 400:
            logger.warning("SAP OAuth token endpoint returned HTTP %s", token_response.status_code)
            raise RuntimeError(f"SAP OAuth authentication failed (HTTP {token_response.status_code})")
        try:
            token = token_response.json()["access_token"]
        except (ValueError, KeyError, TypeError) as exc:
            raise RuntimeError("SAP OAuth response did not contain an access token") from exc

        async with client.stream(
            "GET",
            base_url + integration.api_path,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        ) as response:
            if response.status_code >= 400:
                logger.warning("SAP OData endpoint returned HTTP %s", response.status_code)
                raise RuntimeError(f"SAP OData request failed (HTTP {response.status_code})")
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > 1_000_000:
                raise RuntimeError("SAP OData response is too large for a connection test")
            response_body = bytearray()
            async for chunk in response.aiter_bytes():
                response_body.extend(chunk)
                if len(response_body) > 1_000_000:
                    raise RuntimeError("SAP OData response is too large for a connection test")
        try:
            payload = json.loads(response_body)
        except ValueError as exc:
            raise RuntimeError("SAP OData response was not valid JSON") from exc

    record_count = None
    if isinstance(payload, dict):
        value = payload.get("value")
        if isinstance(value, list):
            record_count = len(value)
        elif isinstance(payload.get("d"), dict) and isinstance(payload["d"].get("results"), list):
            record_count = len(payload["d"]["results"])

    integration.connected_at = datetime.now(timezone.utc)
    session.add(integration)
    session.commit()
    return {
        "connected": True,
        "http_status": response.status_code,
        "sap_service": integration.api_path,
        "records_returned": record_count,
        "checked_at": integration.connected_at,
        "message": "SAP OAuth 2.0 and the configured OData API request succeeded.",
    }
