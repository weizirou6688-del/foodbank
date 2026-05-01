from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

import app.services.auth_password_reset_service as auth_password_reset_service
from tests.helpers import (
    CapturingSession,
    assert_http_exception,
    async_raise,
    async_return,
    patch_attrs,
    run_async,
)

TEST_EMAIL = "person@example.com"
OLD_PASSWORD = "OldPass123!"
NEW_PASSWORD = "NewPass456!"
SECOND_NEW_PASSWORD = "AnotherPass789!"
VALID_CODE = "654321"
ALTERNATE_CODE = "111111"


def test_request_password_reset_returns_generic_message_for_unknown_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()

    patch_attrs(
        monkeypatch,
        auth_password_reset_service,
        is_smtp_configured=lambda: True,
        _get_user_by_email=async_return(None),
        send_password_reset_email=async_raise(
            AssertionError("email send should not run for an unknown user")
        ),
    )

    message = run_async(
        auth_password_reset_service.request_password_reset(
            db,
            "missing@example.com",
        )
    )

    assert message == auth_password_reset_service.PASSWORD_RESET_GENERIC_MESSAGE
    assert db.added == []
    assert db.flush_calls == 0


def test_request_password_reset_is_blocked_when_smtp_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch_attrs(
        monkeypatch,
        auth_password_reset_service,
        is_smtp_configured=lambda: False,
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            auth_password_reset_service.request_password_reset(
                CapturingSession(),
                TEST_EMAIL,
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Password reset email service is unavailable.",
    )


def test_request_password_reset_persists_a_hashed_code_and_sends_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()
    now = datetime(2026, 4, 23, 9, 30, 0)
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=auth_password_reset_service.get_password_hash(OLD_PASSWORD),
    )
    sent_email: dict[str, object] = {}

    async def _send_password_reset_email(**kwargs):
        sent_email.update(kwargs)

    patch_attrs(
        monkeypatch,
        auth_password_reset_service,
        is_smtp_configured=lambda: True,
        _get_user_by_email=async_return(user),
        generate_password_reset_code=lambda: "123456",
        utcnow=lambda: now,
        send_password_reset_email=_send_password_reset_email,
    )

    message = run_async(
        auth_password_reset_service.request_password_reset(
            db,
            TEST_EMAIL,
        )
    )

    assert message == auth_password_reset_service.PASSWORD_RESET_GENERIC_MESSAGE
    assert db.flush_calls == 1
    assert len(db.added) == 1

    reset_record = db.added[0]
    assert reset_record.user_id == user.id
    assert reset_record.expires_at == now + timedelta(
        minutes=auth_password_reset_service.PASSWORD_RESET_CODE_EXPIRE_MINUTES
    )
    assert auth_password_reset_service.verify_password(
        "123456",
        reset_record.token_hash,
    )
    assert sent_email == {
        "to_email": TEST_EMAIL,
        "verification_code": "123456",
        "expires_in_minutes": auth_password_reset_service.PASSWORD_RESET_CODE_EXPIRE_MINUTES,
    }


def test_reset_password_rejects_an_expired_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()
    now = datetime(2026, 4, 23, 10, 0, 0)
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=auth_password_reset_service.get_password_hash(OLD_PASSWORD),
    )
    original_password_hash = user.password_hash
    reset_record = SimpleNamespace(
        token_hash=auth_password_reset_service.get_password_hash(VALID_CODE),
        used_at=None,
        expires_at=now - timedelta(minutes=1),
    )

    async def _fetch_reset_record(_db, _query):
        if reset_record.used_at is not None or reset_record.expires_at <= now:
            return None
        return reset_record

    patch_attrs(
        monkeypatch,
        auth_password_reset_service,
        _get_user_by_email=async_return(user),
        fetch_one_or_none=_fetch_reset_record,
        utcnow=lambda: now,
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            auth_password_reset_service.reset_password(
                db,
                email=TEST_EMAIL,
                verification_code=VALID_CODE,
                new_password=NEW_PASSWORD,
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=auth_password_reset_service.PASSWORD_RESET_INVALID_CODE_DETAIL,
    )
    assert reset_record.used_at is None
    assert user.password_hash == original_password_hash
    assert db.flush_calls == 0


def test_reset_password_rejects_a_wrong_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()
    now = datetime(2026, 4, 23, 10, 15, 0)
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=auth_password_reset_service.get_password_hash(OLD_PASSWORD),
    )
    original_password_hash = user.password_hash
    reset_record = SimpleNamespace(
        token_hash=auth_password_reset_service.get_password_hash(ALTERNATE_CODE),
        used_at=None,
        expires_at=now + timedelta(minutes=5),
    )

    async def _fetch_reset_record(_db, _query):
        if reset_record.used_at is not None or reset_record.expires_at <= now:
            return None
        return reset_record

    patch_attrs(
        monkeypatch,
        auth_password_reset_service,
        _get_user_by_email=async_return(user),
        fetch_one_or_none=_fetch_reset_record,
        utcnow=lambda: now,
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            auth_password_reset_service.reset_password(
                db,
                email=TEST_EMAIL,
                verification_code=VALID_CODE,
                new_password=NEW_PASSWORD,
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=auth_password_reset_service.PASSWORD_RESET_INVALID_CODE_DETAIL,
    )
    assert reset_record.used_at is None
    assert user.password_hash == original_password_hash
    assert db.flush_calls == 0


def test_reset_password_rejects_a_reused_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()
    now = datetime(2026, 4, 23, 10, 30, 0)
    user = SimpleNamespace(
        id=uuid.uuid4(),
        email=TEST_EMAIL,
        password_hash=auth_password_reset_service.get_password_hash(OLD_PASSWORD),
    )
    reset_record = SimpleNamespace(
        token_hash=auth_password_reset_service.get_password_hash(VALID_CODE),
        used_at=None,
        expires_at=now + timedelta(minutes=5),
    )

    async def _fetch_reset_record(_db, _query):
        if reset_record.used_at is not None or reset_record.expires_at <= now:
            return None
        return reset_record

    patch_attrs(
        monkeypatch,
        auth_password_reset_service,
        _get_user_by_email=async_return(user),
        fetch_one_or_none=_fetch_reset_record,
        utcnow=lambda: now,
    )

    first_message = run_async(
        auth_password_reset_service.reset_password(
            db,
            email=TEST_EMAIL,
            verification_code=VALID_CODE,
            new_password=NEW_PASSWORD,
        )
    )

    assert first_message == auth_password_reset_service.PASSWORD_RESET_SUCCESS_MESSAGE
    assert reset_record.used_at == now
    assert auth_password_reset_service.verify_password(
        NEW_PASSWORD,
        user.password_hash,
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            auth_password_reset_service.reset_password(
                db,
                email=TEST_EMAIL,
                verification_code=VALID_CODE,
                new_password=SECOND_NEW_PASSWORD,
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=auth_password_reset_service.PASSWORD_RESET_INVALID_CODE_DETAIL,
    )
    assert db.flush_calls == 1
