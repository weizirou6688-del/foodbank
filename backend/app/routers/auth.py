"""
Compatibility stub: auth router has been moved to app.modules.auth

All functions and router are re-exported from the new location for backward compatibility.
"""

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

