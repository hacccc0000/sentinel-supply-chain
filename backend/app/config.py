from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    auth_mode: str = "development"
    database_url: str = "postgresql+psycopg://supplychain:supplychain@localhost:5432/supplychain"
    database_sslmode: str = "require"
    cors_origins: str = "http://localhost:5173"
    key_vault_url: str | None = None
    app_encryption_key: str | None = None
    sap_secret_name_prefix: str = "sap-client"
    seed_demo_data: bool = True
    log_level: str = "INFO"

    @field_validator("app_env", "auth_mode")
    @classmethod
    def normalize_mode(cls, value: str) -> str:
        return value.strip().lower()

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.app_env == "production":
            if self.auth_mode != "easyauth":
                raise ValueError("Production requires AUTH_MODE=easyauth")
            if not self.key_vault_url:
                raise ValueError("Production requires KEY_VAULT_URL")
            ssl_modes = [part.split("=", 1)[1] for part in self.database_url.split("?")[-1].split("&") if part.startswith("sslmode=")]
            if (ssl_modes and ssl_modes[0] not in {"require", "verify-ca", "verify-full"}) or (
                not ssl_modes and self.database_sslmode not in {"require", "verify-ca", "verify-full"}
            ):
                raise ValueError("Production PostgreSQL connections must use TLS")
        elif self.auth_mode not in {"development", "easyauth"}:
            raise ValueError("AUTH_MODE must be development or easyauth")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
