"""
FastAPI main application entry point.

Initializes the FastAPI app with CORS middleware, exception handlers,
startup/shutdown hooks, and placeholder routes.

Run with: uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.bootstrap import ensure_demo_users, ensure_demo_food_banks

# Configure logging
logger = logging.getLogger(__name__)


# ==================== STARTUP/SHUTDOWN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI app lifespan context manager (startup/shutdown).
    
    Initializes database tables on startup and closes connections on shutdown.
    """
    # Startup
    db_ready = False
    try:
        await init_db()
        await ensure_demo_users()
        await ensure_demo_food_banks()
        db_ready = True
        print("✅ Database initialized and connected")
    except Exception as exc:
        logger.warning("Database startup skipped: %s", exc)
        print("⚠️ Database unavailable; API started in degraded mode")

    app.state.db_ready = db_ready
    
    yield
    
    # Shutdown
    await close_db()
    print("🛑 Database connections closed")


# ==================== APP INITIALIZATION ====================

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)


# ==================== CORS MIDDLEWARE ====================

# CORS allows frontend applications to make cross-origin requests to this API.
# Configured with origins from environment (CORS_ORIGINS setting).
# In production, specify exact frontend URLs instead of "*" for security.

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # From .env: http://localhost:3000,http://localhost:5173
    allow_origin_regex=r"https://.*-\d+\.(app\.github\.dev|githubpreview\.dev)",
    allow_credentials=True,  # Allow cookies/auth headers
    allow_methods=["*"],  # GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
    allow_headers=["*"],  # All headers including Authorization
    expose_headers=["Content-Range", "X-Content-Range"],  # For pagination/large responses
    max_age=600,  # Preflight cache duration (10 minutes)
)


# ==================== EXCEPTION HANDLERS ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors (400 Bad Request).
    
    Returns consistent JSON error format with validation details.
    Used for malformed request bodies, type mismatches, required field validation, etc.
    """
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"][1:]) or "body",
            "message": error["msg"],
            "type": error["type"],
        })
    
    logger.warning(f"Validation error on {request.url.path}: {errors}")
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "status_code": status.HTTP_400_BAD_REQUEST,
            "message": "Validation error",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """
    Global exception handler for unhandled errors.
    
    Logs the full error for debugging and returns a generic 500 response
    to avoid leaking internal details to clients.
    
    HTTPException is handled automatically by FastAPI and bypasses this handler,
    so it returns the HTTPException details as-is.
    """
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}",
        exc_info=exc
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Internal server error",
            "detail": "An unexpected error occurred. Please try again later.",
        },
    )


# ==================== PLACEHOLDER ROUTES ====================

@app.get("/", tags=["Health"])
async def root():
    """
    Root health check endpoint.
    
    Returns:
        Confirmation that API is running.
    """
    return {
        "message": "ABC Community Food Bank API",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint. Use for monitoring/readiness checks.
    
    Returns:
        Health status.
    """
    db_state = "connected" if getattr(app.state, "db_ready", False) else "unavailable"
    return {
        "status": "healthy",
        "database": db_state,
    }


# ==================== ROUTER INCLUSION ====================

# Import all routers from modules (Phase D modularzation)
from app.modules import (
    applications,
    auth,
    donations,
    food_banks,
    food_packages,
    inventory,
    restock,
    stats,
)

# Mount routers with API v1 prefix
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(food_banks.router, prefix="/api/v1/food-banks", tags=["Food Banks"])
app.include_router(food_packages.router, prefix="/api/v1", tags=["Food Packages"])
app.include_router(food_banks.router, prefix="/api/v1/food-banks", tags=["Food Banks"])
app.include_router(applications.router, prefix="/api/v1/applications", tags=["Applications"])
app.include_router(donations.router, prefix="/api/v1/donations", tags=["Donations"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory"])
app.include_router(restock.router, prefix="/api/v1/restock-requests", tags=["Restock Requests"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["Statistics"])


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
