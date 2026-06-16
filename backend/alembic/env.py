"""
Alembic environment configuration.

Alembic uses this file to understand the database setup, connection string,
and how to perform migrations. Supports both online and offline migration modes.
"""

from logging.config import fileConfig
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool


ALEMBIC_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = ALEMBIC_ROOT.parent

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.core.database_urls import to_sync_sqlalchemy_url
from app.models import Base


# This is the Alembic Config object, which provides
# the values of various Alembic elements within the "alembic/" folder
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def get_online_migration_config() -> dict[str, str]:
    """Return a mutable config mapping for online migrations."""
    configuration = dict(config.get_section(config.config_ini_section) or {})
    configuration["sqlalchemy.url"] = sync_database_url
    return configuration


def configure_offline_context(url: str) -> None:
    """Apply the shared Alembic context settings for offline migrations."""
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )


def configure_online_context(connection) -> None:
    """Apply the shared Alembic context settings for online migrations."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
    )


# Set the SQLAlchemy URL from settings (converted to sync)
sync_database_url = to_sync_sqlalchemy_url(settings.database_url)
# Cloud Postgres needs TLS for the sync (psycopg2) driver too. Gated on DB_SSL
# so local dev is unaffected. psycopg2 reads sslmode from the URL query.
import os  # noqa: E402
if os.getenv("DB_SSL", "").strip().lower() in {"require", "true", "1", "on", "yes"} \
        and "sslmode=" not in sync_database_url:
    sync_database_url += ("&" if "?" in sync_database_url else "?") + "sslmode=require"
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
    configure_offline_context(config.get_main_option("sqlalchemy.url"))

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.
    
    In this scenario we need to create an Engine and associate
    a connection with the context.
    """
    # Create engine for synchronous migrations
    connectable = engine_from_config(
        get_online_migration_config(),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.begin() as connection:
        configure_online_context(connection)
        
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
