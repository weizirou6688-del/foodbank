import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEV_ENV_PATH = PROJECT_ROOT / "dev.env"
BACKEND_ENV_PATH = PROJECT_ROOT / "backend" / ".env"

load_dotenv(DEV_ENV_PATH, override=False)
load_dotenv(BACKEND_ENV_PATH, override=True)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _build_default_cors_origins() -> List[str]:
    frontend_start = _env_int("FRONTEND_PORT", 5173)
    frontend_end = _env_int("FRONTEND_FALLBACK_PORT_END", frontend_start)
    preview_port = _env_int("FRONTEND_PREVIEW_PORT", 4173)

    origins: List[str] = ["http://localhost:3000"]
    for port in range(frontend_start, frontend_end + 1):
        origins.append(f"http://localhost:{port}")
        origins.append(f"http://127.0.0.1:{port}")

    origins.append(f"http://localhost:{preview_port}")
    origins.append(f"http://127.0.0.1:{preview_port}")

    return list(dict.fromkeys(origins))


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank",
        description="Async PostgreSQL connection string",
    )

    dev_host: str = Field(
        default=os.getenv("DEV_HOST", "127.0.0.1"),
        description="Host used by local development startup scripts",
    )
    backend_port: int = Field(
        default=_env_int("BACKEND_PORT", 8000),
        description="Preferred backend port for local development",
    )
    backend_fallback_port_end: int = Field(
        default=_env_int("BACKEND_FALLBACK_PORT_END", 8010),
        description="Upper bound of backend fallback port range",
    )
    frontend_port: int = Field(
        default=_env_int("FRONTEND_PORT", 5173),
        description="Preferred frontend port for local development",
    )
    frontend_fallback_port_end: int = Field(
        default=_env_int("FRONTEND_FALLBACK_PORT_END", 5178),
        description="Upper bound of frontend fallback port range",
    )
    frontend_preview_port: int = Field(
        default=_env_int("FRONTEND_PREVIEW_PORT", 4173),
        description="Vite preview port for local development",
    )

    secret_key: str = Field(
        description=(
            "Secret key for JWT signing. REQUIRED - must be long and "
            "cryptographically secure (min 32 chars)."
        )
    )
    algorithm: str = Field(
        default="HS256",
        description="JWT algorithm (HS256 recommended)",
    )
    access_token_expire_minutes: int = Field(
        default=480,
        description="Access token expiration in minutes",
    )
    application_expiry_days: int = Field(
        default=max(_env_int("APPLICATION_EXPIRY_DAYS", 7), 1),
        description="Number of days before pending applications automatically expire",
    )
    application_expiry_check_seconds: int = Field(
        default=max(_env_int("APPLICATION_EXPIRY_CHECK_SECONDS", 3600), 60),
        description="Polling interval in seconds for the application expiry background task",
    )

    cors_origins: List[str] = Field(
        default_factory=_build_default_cors_origins,
        description="Allowed CORS origins (comma-separated or JSON list)",
    )

    app_name: str = Field(
        default="ABC Community Food Bank API",
        description="Application name",
    )
    debug: bool = Field(
        default=False,
        description="Enable debug mode",
    )

    smtp_host: str = Field(
        default="smtp.gmail.com",
        description="SMTP server hostname",
    )
    smtp_port: int = Field(
        default=587,
        description="SMTP server port",
    )
    smtp_username: str | None = Field(
        default=None,
        description="SMTP login username",
    )
    smtp_password: str | None = Field(
        default=None,
        description="SMTP login password or app password",
    )
    smtp_from_email: str | None = Field(
        default=None,
        description="From email address for SMTP messages",
    )
    platform_operations_email: str | None = Field(
        default=None,
        description="Primary operations mailbox for platform-level notifications",
    )
    operations_notification_email: str | None = Field(
        default=None,
        description="Legacy fallback operations mailbox for notifications",
    )

    @property
    def smtp_sender_email(self) -> str | None:
        return self.smtp_from_email or self.smtp_username

    @property
    def operations_fallback_email(self) -> str | None:
        return (
            self.platform_operations_email
            or self.operations_notification_email
            or self.smtp_sender_email
        )

    model_config = {
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
        "env_nested_delimiter": "__",
    }


settings = Settings()
