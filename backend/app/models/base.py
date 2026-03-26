"""
Base declarative class for all SQLAlchemy models.

This module provides the foundation for all ORM models in the application.
All model classes inherit from Base to leverage SQLAlchemy 2.0's declarative base
and automatic table registry.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Declarative base for all SQLAlchemy models.
    
    Inheriting from this class automatically registers models and provides
    access to the metadata registry for schema operations and migrations.
    """

    pass
