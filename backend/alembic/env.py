"""
Alembic environment configuration.

Alembic uses this file to understand the database setup, connection string,
and how to perform migrations. Supports both online and offline migration modes.
"""

from logging.config import fileConfig
from pathlib import Path
import sys

from sqlalchemy import engine_from_config, pool, create_engine
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

# Convert async database URL to sync URL for Alembic (Alembic is synchronous)
def get_sync_database_url(async_url: str) -> str:
    """Convert async PostgreSQL URL to sync URL for Alembic."""
    # Replace asyncpg with psycopg2 (synchronous driver, already in requirements.txt)
    return async_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

# Set the SQLAlchemy URL from settings (converted to sync)
sync_database_url = get_sync_database_url(settings.database_url)
config.set_main_option("sqlalchemy.url", sync_database_url)

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


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    In this scenario we need to create an Engine and associate
    a connection with the context.
    """
    # Get configuration and set the sync URL
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = sync_database_url
    
    # Create engine for synchronous migrations
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.begin() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
