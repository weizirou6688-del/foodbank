"""
Application configuration using Pydantic Settings v2.

Loads environment variables from .env file. All config is read-only after initialization.
"""

from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings from environment variables.
    
    Attributes:
        database_url: PostgreSQL connection string (e.g., postgresql+asyncpg://...)
        secret_key: Secret key for JWT signing (must be long and random in production)
        algorithm: JWT algorithm (default HS256)
        access_token_expire_minutes: Access token TTL in minutes
        refresh_token_expire_days: Refresh token TTL in days
        cors_origins: List of allowed origins for CORS (comma-separated or list)
    """
    
    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://foodbank:foodbank@localhost:5432/foodbank",
        description="Async PostgreSQL connection string"
    )
    
    # JWT & Security
    secret_key: str = Field(
        description="Secret key for JWT signing. REQUIRED - must be long and cryptographically secure (min 32 chars). Generate with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
    )
    algorithm: str = Field(
        default="HS256",
        description="JWT algorithm (HS256 recommended)"
    )
    access_token_expire_minutes: int = Field(
        default=15,
        description="Access token expiration in minutes"
    )
    refresh_token_expire_days: int = Field(
        default=7,
        description="Refresh token expiration in days"
    )
    
    # CORS
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
            "http://127.0.0.1:5175",
        ],
        description="Allowed CORS origins (comma-separated or JSON list)"
    )
    
    # App
    app_name: str = Field(
        default="ABC Community Food Bank API",
        description="Application name"
    )
    debug: bool = Field(
        default=False,
        description="Enable debug mode"
    )
    
    class Config:
        """Pydantic v2 config."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
