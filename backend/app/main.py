import logging
import app.routers.applications as applications
import app.routers.auth as auth
import app.routers.donations as donations
import app.routers.food_banks as food_banks
import app.routers.food_packages as food_packages
import app.routers.inventory as inventory
import app.routers.restock as restock
import app.routers.stats as stats
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.bootstrap import (
    ensure_canonical_redemption_codes,
    ensure_full_demo_data,
)
from app.core.database import check_database_connection, close_db
from app.core.database_errors import DATABASE_UNAVAILABLE_DETAIL
from app.services.dashboard_history_service import ensure_dashboard_history

logger = logging.getLogger(__name__)


def _json_response(http_status: int, **content) -> JSONResponse:
    return JSONResponse(status_code=http_status, content=content)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_ready = False
    db_error: str | None = None

    try:
        db_ready, db_error = await check_database_connection()
        if not db_ready:
            raise RuntimeError(db_error or "Database connection check failed")

        if settings.seed_demo_data:
            await ensure_full_demo_data()

        await ensure_canonical_redemption_codes()
        await ensure_dashboard_history()
        print("Database connected")
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
    errors = [
        {
            "field": ".".join(str(x) for x in error["loc"][1:]) or "body",
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]

    logger.warning("Validation error on %s: %s", request.url.path, errors)

    return _json_response(
        status.HTTP_400_BAD_REQUEST,
        status_code=status.HTTP_400_BAD_REQUEST,
        message="Validation error",
        errors=errors,
    )


@app.exception_handler(SQLAlchemyError)
@app.exception_handler(ConnectionError)
@app.exception_handler(OSError)
async def database_exception_handler(request, exc: Exception):
    logger.warning(
        "Database unavailable on %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )

    return _json_response(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        message="Service temporarily unavailable",
        detail=DATABASE_UNAVAILABLE_DETAIL,
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )

    return _json_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message="Internal server error",
        detail="An unexpected error occurred. Please try again later.",
    )


@app.get("/", tags=["Health"])
async def root():
    return {"message": "ABC Community Food Bank API", "status": "running", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health_check():
    if getattr(app.state, "db_ready", False):
        return {"status": "ok", "database": "connected"}

    return _json_response(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        status="degraded",
        database="unavailable",
        detail=getattr(app.state, "db_error", None) or DATABASE_UNAVAILABLE_DETAIL,
    )

API_ROUTERS = (
    (auth.router, "/api/v1/auth", ["Auth"]),
    (food_banks.router, "/api/v1/food-banks", ["Food Banks"]),
    (food_packages.router, "/api/v1", ["Food Packages"]),
    (applications.router, "/api/v1/applications", ["Applications"]),
    (donations.router, "/api/v1/donations", ["Donations"]),
    (inventory.router, "/api/v1/inventory", ["Inventory"]),
    (restock.router, "/api/v1/restock-requests", ["Restock Requests"]),
    (stats.router, "/api/v1/stats", ["Statistics"]),
)

for router, prefix, tags in API_ROUTERS:
    app.include_router(router, prefix=prefix, tags=tags)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=settings.debug,
    )
