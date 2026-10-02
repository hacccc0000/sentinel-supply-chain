from datetime import datetime
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, SecretStr, field_validator


class BuildOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    source: str
    status: str
    risk: str
    findings: int
    created_at: datetime
    summary: str


class BuildIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    source: str = Field(min_length=2, max_length=160)
    status: Literal["passed", "review", "quarantined"] = "review"
    risk: Literal["low", "medium", "high", "critical"] = "low"
    findings: int = Field(default=0, ge=0, le=100000)
    summary: str = Field(default="", max_length=4000)


class WorkerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    kind: str
    status: str
    last_seen: datetime
    version: str


class WorkerIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    kind: str = Field(min_length=2, max_length=64)
    version: str = Field(min_length=1, max_length=64)


class PolicyIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    rule: str = Field(min_length=4, max_length=240)
    action: Literal["alert", "quarantine", "block"]
    enabled: bool = True


class PolicyPatch(BaseModel):
    enabled: bool


class PolicyOut(PolicyIn):
    model_config = ConfigDict(from_attributes=True)

    id: str
    updated_at: datetime


class SapIntegrationIn(BaseModel):
    base_url: AnyHttpUrl
    token_url: AnyHttpUrl
    client_id: str = Field(min_length=1, max_length=256)
    client_secret: SecretStr | None = None
    api_path: str = Field(min_length=1, max_length=512)
    scopes: str = Field(default="", max_length=512)
    auth_method: Literal["client_secret_basic", "client_secret_post"] = "client_secret_basic"

    @field_validator("api_path")
    @classmethod
    def relative_api_path(cls, value: str) -> str:
        if value.startswith(("http://", "https://", "//")) or ".." in value.split("/"):
            raise ValueError("Use a relative SAP OData API path")
        if not value.startswith("/"):
            value = "/" + value
        return value


class SapIntegrationOut(BaseModel):
    configured: bool
    base_url: str | None = None
    token_url: str | None = None
    client_id: str | None = None
    api_path: str | None = None
    scopes: str | None = None
    auth_method: str | None = None
    connected_at: datetime | None = None


class SapTestOut(BaseModel):
    connected: bool
    http_status: int
    sap_service: str
    records_returned: int | None = None
    checked_at: datetime
    message: str


class OverviewOut(BaseModel):
    builds: int
    active_workers: int
    quarantined: int
    critical_findings: int
    recent_builds: list[BuildOut]
