"""
FastAPI main application entry point.

Initializes the FastAPI app with CORS middleware, exception handlers,
startup/shutdown hooks, and health routes.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import check_database_connection, close_db, init_db
from app.core.database_errors import DATABASE_UNAVAILABLE_DETAIL

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI app lifespan context manager.
    """
    db_ready = False
    db_error: str | None = None

    try:
        await init_db()
        db_ready, db_error = await check_database_connection()
        if not db_ready:
            raise RuntimeError(db_error or "Database connection check failed")
        print("Database initialized and connected")
    except Exception as exc:
        db_error = str(exc)
        logger.warning("Database startup skipped: %s", exc)
        print("Database unavailable; API started in degraded mode")

    app.state.db_ready = db_ready
    app.state.db_error = db_error

    yield

    await close_db()
    print("Database connections closed")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*-\d+\.(app\.github\.dev|githubpreview\.dev)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "X-Content-Range"],
    max_age=600,
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """
    Handle Pydantic validation errors (400 Bad Request).
    """
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(x) for x in error["loc"][1:]) or "body",
            "message": error["msg"],
            "type": error["type"],
        })

    logger.warning("Validation error on %s: %s", request.url.path, errors)

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "status_code": status.HTTP_400_BAD_REQUEST,
            "message": "Validation error",
            "errors": errors,
        },
    )


@app.exception_handler(SQLAlchemyError)
@app.exception_handler(ConnectionError)
@app.exception_handler(OSError)
async def database_exception_handler(request, exc: Exception):
    """
    Convert uncaught database connectivity failures into HTTP 503 responses.
    """
    logger.warning(
        "Database unavailable on %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status_code": status.HTTP_503_SERVICE_UNAVAILABLE,
            "message": "Service temporarily unavailable",
            "detail": DATABASE_UNAVAILABLE_DETAIL,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """
    Global exception handler for unhandled errors.
    """
    logger.error(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "Internal server error",
            "detail": "An unexpected error occurred. Please try again later.",
        },
    )


@app.get("/", tags=["Health"])
async def root():
    return {
        "message": "ABC Community Food Bank API",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    if getattr(app.state, "db_ready", False):
        return {
            "status": "ok",
            "database": "connected",
        }

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "degraded",
            "database": "unavailable",
            "detail": getattr(app.state, "db_error", None) or DATABASE_UNAVAILABLE_DETAIL,
        },
    )


from app.modules import (  # noqa: E402
    applications,
    auth,
    donations,
    food_banks,
    food_packages,
    inventory,
    restock,
    stats,
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(food_banks.router, prefix="/api/v1/food-banks", tags=["Food Banks"])
app.include_router(food_packages.router, prefix="/api/v1", tags=["Food Packages"])
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
        port=settings.backend_port,
        reload=settings.debug,
    )
