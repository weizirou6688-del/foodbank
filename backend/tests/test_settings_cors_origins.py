from __future__ import annotations

from app.core.config import Settings


def test_settings_accepts_comma_separated_cors_origins(monkeypatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://foodbank.example.com, https://admin.foodbank.example.com",
    )

    settings = Settings()

    assert settings.cors_origins == [
        "https://foodbank.example.com",
        "https://admin.foodbank.example.com",
    ]


def test_settings_accepts_json_list_cors_origins(monkeypatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.setenv(
        "CORS_ORIGINS",
        '["https://foodbank.example.com", "https://admin.foodbank.example.com"]',
    )

    settings = Settings()

    assert settings.cors_origins == [
        "https://foodbank.example.com",
        "https://admin.foodbank.example.com",
    ]
