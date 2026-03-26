"""
Database setup with SQLAlchemy and async support.

Uses asyncpg driver for async PostgreSQL access. Session factory provides
dependency injection for route handlers via FastAPI.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models import Base


# ==================== ENGINE & SESSION FACTORY ====================

# Async engine for PostgreSQL with asyncpg
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # Log SQL statements in debug mode
    future=True,
    pool_pre_ping=True,  # Verify connections before use
)

# Session factory for async sessions
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ==================== DEPENDENCY INJECTION ====================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function for FastAPI route handlers.
    
    Provides an async database session that is automatically closed after
    the route handler completes. Use as:
    
        @app.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    
    Yields:
        AsyncSession: Database session scoped to single request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ==================== STARTUP/SHUTDOWN HOOKS ====================

async def init_db() -> None:
    """
    Initialize database tables (called at app startup).
    
    Creates all tables defined in Base.metadata if they don't exist.
    In production, prefer Alembic migrations.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """
    Close database connections (called at app shutdown).
    """
    await engine.dispose()
