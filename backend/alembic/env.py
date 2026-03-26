"""
Alembic environment configuration.

Alembic uses this file to understand the database setup, connection string,
and how to perform migrations. Supports both online and offline migration modes.
"""

from logging.config import fileConfig
from pathlib import Path
import sys

from sqlalchemy import engine_from_config, pool
from alembic import context

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.models import Base


# This is the Alembic Config object, which provides
# the values of various Alembic elements within the "alembic/" folder
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the SQLAlchemy URL from settings
config.set_main_option("sqlalchemy.url", settings.database_url)

# Model's MetaData object for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    This configures the context with just a URL and not an Engine,
    though an Engine is acceptable here as well. By skipping the
    Engine creation we don't even need a DBAPI to be available.
    
    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    """Helper function to execute migrations given a connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    In this scenario we need to create an Engine and associate
    a connection with the context.
    
    Note: For async engine support, we create a sync-style connection
    from the async engine using a special approach.
    """
    # For a standard (non-async) connection setup:
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.database_url
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        strategy="mock",
        executor=do_run_migrations,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    # For async support, use run_migrations_online() within asyncio context
    # For now, fallback to simple sync-style approach
    # In production, you may want to handle async engine separately
    import asyncio
    
    async def run_async():
        """Run async migrations."""
        # For async PostgreSQL, temporarily use sync-style migration
        # by connecting through the engine
        from sqlalchemy import create_engine
        
        # Convert async URL to sync URL for Alembic
        sync_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        
        engine = create_engine(sync_url, poolclass=pool.NullPool)
        
        with engine.begin() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
            )
            
            with context.begin_transaction():
                context.run_migrations()
    
    # Run async migration
    asyncio.run(run_async())
