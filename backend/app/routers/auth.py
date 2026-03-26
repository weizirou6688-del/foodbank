"""
Compatibility stub: auth router has been moved to app.modules.auth

All functions and router are re-exported from the new location for backward compatibility.
"""

from app.modules.auth.router import router, register, login, logout, refresh, get_profile

__all__ = ["router", "register", "login", "logout", "refresh", "get_profile"]

