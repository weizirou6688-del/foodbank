"""Backward-compatible re-exports for the auth router."""

from app.modules.auth.router import (
    forgot_password,
    get_profile,
    login,
    logout,
    refresh,
    register,
    reset_password,
    router,
)

__all__ = [
    "router",
    "register",
    "login",
    "logout",
    "refresh",
    "get_profile",
    "forgot_password",
    "reset_password",
]

