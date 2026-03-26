"""
Application model representing user applications for food packages.

From spec § 1 'applications' table:
Application records track requests from users (public role) to receive food packages
from a specific food bank during a given weekly period. Each application is assigned
a unique redemption code for in-person pickup verification. Status tracks lifecycle
from pending through collection to expiry. Weekly period enforces business rule
limiting 3 packages per user per week.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Application(Base):
    __tablename__ = "applications"

    # Check constraint enforces status enum from spec § 3 Business Rules.
    # Status lifecycle: pending -> collected (successful pickup) or expired
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','collected','expired')",
            name="ck_applications_status",
        ),
    )

    # From spec: id: UUID (PK, default gen_random_uuid())
    # UUID primary key generated server-side by PostgreSQL.
    # Provides global uniqueness and security over sequential IDs.
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # From spec: user_id: UUID, NOT NULL, FK -> users.id
    # Foreign key to User. ondelete='CASCADE' ensures applications
    # deleted when user deleted (maintains referential integrity).
    # index=True enables quick lookup of applications by user.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # From spec: food_bank_id: INTEGER, NOT NULL, FK -> food_banks.id
    # Foreign key to FoodBank. ondelete='RESTRICT' prevents deletion of
    # food banks that have existing applications (historical records matter).
    # index=True enables quick lookup of applications by food bank.
    food_bank_id: Mapped[int] = mapped_column(
        ForeignKey("food_banks.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # From spec: redemption_code: VARCHAR(20), NOT NULL, UNIQUE
    # Format: 'FB-' + 6 alphanumeric chars (spec § 3 Business Rules).
    # Provides verifiable code for tracking offline redemption.
    # UNIQUE constraint prevents duplicate codes across system.
    # Enforced via Pydantic schema validation with regex pattern.
    redemption_code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)

    # From spec: status: VARCHAR(20), NOT NULL, DEFAULT 'pending'
    # Tracks application lifecycle. Check constraint limits to valid values.
    # server_default='pending' ensures new applications start as pending.
    # index=True enables quick filtering by status (e.g., "find expired").
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'pending'"), index=True)

    # From spec: weekly_period: VARCHAR(10), NOT NULL
    # ISO week identifier (e.g., "2026-W12") or date range.
    # Enables business rule enforcement: max 3 packages per user per week.
    # index=True enables queries like "find applications in week X".
    weekly_period: Mapped[str] = mapped_column(String(10), nullable=False, index=True)

    # From spec: total_quantity: INTEGER, NOT NULL
    # Total number of packages in this application.
    # Used for reporting and weekly limit enforcement.
    # Note: Individual item quantities stored in ApplicationItem junction.
    total_quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # From spec: created_at: TIMESTAMP, NOT NULL, DEFAULT NOW()
    # Audit field: records when application was submitted.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        server_default=text("now()"),
    )

    # Relationship: Application -> User (many-to-one)
    # From spec § 2 "users → applications: one-to-many"
    # back_populates="applications" establishes bidirectional relationship.
    user: Mapped["User"] = relationship(back_populates="applications")

    # Relationship: Application -> FoodBank (many-to-one)
    # Implicit from spec: applications reference food_bank_id
    # back_populates="applications" establishes bidirectional relationship.
    food_bank: Mapped["FoodBank"] = relationship(back_populates="applications")

    # Relationship: Application -> ApplicationItems (one-to-many)
    # Details which packages are in this application and quantities.
    # FK: application_items.application_id -> applications.id
    # cascade='all, delete-orphan' ensures items deleted when application deleted.
    items: Mapped[list["ApplicationItem"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
    )
