import base64
import json
from dataclasses import dataclass

from fastapi import HTTPException, Request, status

from .config import get_settings


@dataclass(frozen=True)
class Principal:
    tenant_id: str
    object_id: str
    display_name: str
    roles: frozenset[str]


def _find_claim(claims: list[dict], *names: str) -> str | None:
    for claim in claims:
        claim_type = claim.get("typ", "").lower()
        if claim_type in {name.lower() for name in names}:
            value = claim.get("val")
            if value:
                return str(value)
    return None


def get_principal(request: Request) -> Principal:
    settings = get_settings()
    if settings.auth_mode == "development":
        if settings.app_env == "production":
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication is misconfigured")
        return Principal(
            "local-development",
            "local-user",
            "Local developer",
            frozenset({"SupplyChain.Reader", "SupplyChain.Operator", "SupplyChain.Admin"}),
        )

    encoded = request.headers.get("x-ms-client-principal")
    if not encoded:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in with your organization account")
    try:
        principal = json.loads(base64.b64decode(encoded, validate=True))
        claims = principal.get("claims", [])
        tenant_id = _find_claim(
            claims,
            "http://schemas.microsoft.com/identity/claims/tenantid",
            "tid",
        )
        object_id = _find_claim(
            claims,
            "http://schemas.microsoft.com/identity/claims/objectidentifier",
            "oid",
        )
        display_name = _find_claim(claims, "name") or "Organization user"
        roles = frozenset(
            str(claim.get("val"))
            for claim in claims
            if claim.get("typ", "").lower() == "roles" and claim.get("val")
        )
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticated principal") from exc
    if not tenant_id or not object_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Organization tenant and user claims are required")
    if not roles.intersection({"SupplyChain.Reader", "SupplyChain.Operator", "SupplyChain.Admin"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="An assigned supply-chain application role is required")
    return Principal(tenant_id, object_id, display_name, roles)


def require_role(principal: Principal, role: str) -> None:
    hierarchy = {
        "SupplyChain.Reader": {"SupplyChain.Reader", "SupplyChain.Operator", "SupplyChain.Admin"},
        "SupplyChain.Operator": {"SupplyChain.Operator", "SupplyChain.Admin"},
        "SupplyChain.Admin": {"SupplyChain.Admin"},
    }
    if not principal.roles.intersection(hierarchy.get(role, {role})):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"The {role} role is required")


def workspace_id(request: Request, principal: Principal) -> tuple[str, str]:
    mode = request.headers.get("x-workspace-mode", "demo" if get_settings().app_env == "development" else "live")
    if mode not in {"demo", "live"}:
        raise HTTPException(status_code=400, detail="Workspace mode must be demo or live")
    if mode == "demo":
        return f"demo:{principal.tenant_id}:{principal.object_id}", mode
    return f"tenant:{principal.tenant_id}", mode
