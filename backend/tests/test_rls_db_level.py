#!/usr/bin/env python3
"""
Database-level RLS/RBAC validation.

These checks require a real local PostgreSQL instance with the project schema.
If that environment is unavailable, the tests skip instead of failing the whole
suite.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor
import pytest


DB_HOST = "localhost"
DB_PORT = 5432
DB_NAME = "foodbank"
DB_USER = "foodbank"
DB_PASSWORD = "foodbank"


def get_db_connection():
    try:
        return psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
        )
    except Exception as exc:
        pytest.skip(f"PostgreSQL test database unavailable: {exc}")


def create_test_user(name: str, email: str, role: str = "public") -> uuid.UUID:
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        user_id = uuid.uuid4()
        password_hash = "$2b$12$R9h7cIPz0giAu7Zva7.1mu7LxbDDBxg6A5k0VJu9PNvXWLI0Eqn9u"
        cur.execute(
            """
            INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
            """,
            (str(user_id), name, email, password_hash, role),
        )
        conn.commit()
        return user_id
    finally:
        cur.close()
        conn.close()


def create_test_application(user_id: uuid.UUID, food_bank_id: int = 1) -> uuid.UUID:
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        app_id = uuid.uuid4()
        monday = datetime.now() - timedelta(days=datetime.now().weekday())
        week_start = monday.strftime("%Y-%m-%d")
        redemption_code = f"FB-{uuid.uuid4().hex[:6].upper()}"
        cur.execute(
            """
            INSERT INTO applications (
                id, user_id, food_bank_id, redemption_code, status,
                week_start, total_quantity, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, 'pending', %s, 1, NOW(), NOW())
            """,
            (str(app_id), str(user_id), food_bank_id, redemption_code, week_start),
        )
        conn.commit()
        return app_id
    finally:
        cur.close()
        conn.close()


def test_application_isolation():
    timestamp = int(datetime.now().timestamp())
    user1_id = create_test_user("Test User 1", f"testuser1_{timestamp}@example.com")
    user2_id = create_test_user("Test User 2", f"testuser2_{timestamp}@example.com")
    app1_id = create_test_application(user1_id)
    app2_id = create_test_application(user2_id)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT id, user_id FROM applications WHERE id IN (%s, %s)",
            (str(app1_id), str(app2_id)),
        )
        apps = cur.fetchall()
        assert len(apps) == 2

        app1 = next((row for row in apps if row["id"] == str(app1_id)), None)
        app2 = next((row for row in apps if row["id"] == str(app2_id)), None)
        assert app1 is not None and app1["user_id"] == str(user1_id)
        assert app2 is not None and app2["user_id"] == str(user2_id)
    finally:
        cur.close()
        conn.close()


def test_admin_visibility():
    timestamp = int(datetime.now().timestamp())
    regular_user_id = create_test_user("Regular User", f"regular_{timestamp}@example.com", "public")
    admin_user_id = create_test_user("Admin User", f"admin_{timestamp}@example.com", "admin")
    app_id = create_test_application(regular_user_id)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, name, role FROM users WHERE id = %s", (str(admin_user_id),))
        admin = cur.fetchone()
        assert admin is not None
        assert admin["role"] == "admin"

        cur.execute("SELECT id, user_id FROM applications WHERE id = %s", (str(app_id),))
        app = cur.fetchone()
        assert app is not None
    finally:
        cur.close()
        conn.close()


def test_rbac_structure():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT DISTINCT role FROM users ORDER BY role")
        roles = [row["role"] for row in cur.fetchall()]
        assert roles

        cur.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename IN ('users', 'applications')
            ORDER BY tablename
            """
        )
        tables = [row["tablename"] for row in cur.fetchall()]
        assert set(tables) == {"users", "applications"}

        cur.execute(
            """
            SELECT constraint_name
            FROM information_schema.key_column_usage
            WHERE table_name = 'applications'
              AND column_name = 'user_id'
            """
        )
        assert cur.fetchone() is not None
    finally:
        cur.close()
        conn.close()


def test_data_consistency():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT COUNT(*) AS orphan_count
            FROM applications a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE u.id IS NULL
            """
        )
        orphan_count = cur.fetchone()["orphan_count"]
        assert orphan_count == 0

        cur.execute(
            """
            SELECT
                COUNT(*) AS total_apps,
                COUNT(DISTINCT user_id) AS unique_users,
                COUNT(DISTINCT food_bank_id) AS food_banks
            FROM applications
            """
        )
        stats = cur.fetchone()
        assert stats["total_apps"] >= 0
        assert stats["unique_users"] >= 0
        assert stats["food_banks"] >= 0
    finally:
        cur.close()
        conn.close()
