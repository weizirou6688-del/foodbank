from __future__ import annotations

import uuid
from datetime import date, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, status

import app.services.application_submission_service as application_submission_service
from app.models.application_item import ApplicationItem
from app.schemas.application import ApplicationCreate
from tests.helpers import (
    CapturingSession,
    assert_http_exception,
    async_return,
    patch_attrs,
    run_async,
)

FOOD_BANK_ID = 1
OTHER_FOOD_BANK_ID = 2
PACKAGE_ID = 101
INVENTORY_ITEM_ID = 1001
APPLICATION_WEEK_START = date(2026, 4, 20)


def test_validate_weekly_limits_blocks_package_overage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch_attrs(
        monkeypatch,
        application_submission_service,
        fetch_one_or_none=async_return(3),
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            application_submission_service._validate_weekly_limits(
                CapturingSession(),
                user_id=uuid.uuid4(),
                week_start=APPLICATION_WEEK_START,
                package_quantity=1,
                requested_inventory_quantities={},
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Weekly limit exceeded",
    )


def test_load_requested_packages_rejects_packages_from_another_food_bank(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    package = SimpleNamespace(
        id=PACKAGE_ID,
        stock=4,
        applied_count=2,
        food_bank_id=OTHER_FOOD_BANK_ID,
        is_active=True,
        package_items=[SimpleNamespace(inventory_item_id=INVENTORY_ITEM_ID, quantity=2)],
    )

    patch_attrs(
        monkeypatch,
        application_submission_service,
        fetch_scalars=async_return([package]),
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            application_submission_service._load_requested_packages(
                CapturingSession(),
                food_bank_id=FOOD_BANK_ID,
                requested_package_quantities={PACKAGE_ID: 1},
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provided food_bank_id does not match selected packages",
    )


def test_load_requested_inventory_items_rejects_items_from_another_food_bank(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    inventory_item = SimpleNamespace(
        id=INVENTORY_ITEM_ID,
        food_bank_id=OTHER_FOOD_BANK_ID,
        name="Rice",
        unit="bags",
    )

    patch_attrs(
        monkeypatch,
        application_submission_service,
        fetch_scalars=async_return([inventory_item]),
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            application_submission_service._load_requested_inventory_items(
                CapturingSession(),
                food_bank_id=FOOD_BANK_ID,
                requested_inventory_quantities={INVENTORY_ITEM_ID: 1},
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provided food_bank_id does not match selected inventory items",
    )


def test_submit_public_application_deducts_stock_and_persists_application_items(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()
    user_id = uuid.uuid4()
    application_id = uuid.uuid4()
    created_at = datetime(2026, 4, 23, 14, 0, 0)
    package = SimpleNamespace(
        id=PACKAGE_ID,
        stock=5,
        applied_count=7,
        food_bank_id=FOOD_BANK_ID,
        package_items=[SimpleNamespace(inventory_item_id=INVENTORY_ITEM_ID, quantity=2)],
    )
    inventory_item = SimpleNamespace(
        id=INVENTORY_ITEM_ID,
        food_bank_id=FOOD_BANK_ID,
        name="Rice",
        unit="bags",
    )
    application = SimpleNamespace(
        id=application_id,
        created_at=created_at,
        redemption_code="ABCD-1234",
    )
    inventory_stock = {INVENTORY_ITEM_ID: 6}
    consumed: list[tuple[int, int]] = []

    async def _consume_inventory_lots(inventory_item_id: int, quantity: int, _db):
        consumed.append((inventory_item_id, quantity))
        inventory_stock[inventory_item_id] -= quantity

    patch_attrs(
        monkeypatch,
        application_submission_service,
        run_guarded_transaction=lambda _db, action, **_kwargs: action(),
        require_one_or_404=async_return(FOOD_BANK_ID),
        _validate_weekly_limits=async_return(None),
        _load_requested_packages=async_return({PACKAGE_ID: package}),
        _load_requested_inventory_items=async_return({INVENTORY_ITEM_ID: inventory_item}),
        _create_pending_application=async_return(application),
        consume_inventory_lots=_consume_inventory_lots,
        record_application_distribution_snapshots=async_return(None),
        flush_refresh=async_return(application),
    )

    result = run_async(
        application_submission_service.submit_public_application(
            ApplicationCreate(
                food_bank_id=FOOD_BANK_ID,
                week_start=APPLICATION_WEEK_START,
                items=[
                    {"package_id": PACKAGE_ID, "quantity": 2},
                    {"inventory_item_id": INVENTORY_ITEM_ID, "quantity": 3},
                ],
            ),
            {"id": str(user_id)},
            db,
        )
    )

    assert result is application
    assert package.stock == 3
    assert package.applied_count == 9
    assert inventory_stock[INVENTORY_ITEM_ID] == 3
    assert consumed == [(INVENTORY_ITEM_ID, 3)]
    assert len(db.added) == 2

    package_item = next(
        item
        for item in db.added
        if isinstance(item, ApplicationItem) and item.package_id == PACKAGE_ID
    )
    inventory_application_item = next(
        item
        for item in db.added
        if isinstance(item, ApplicationItem)
        and item.inventory_item_id == INVENTORY_ITEM_ID
    )
    assert package_item.application_id == application_id
    assert package_item.quantity == 2
    assert inventory_application_item.application_id == application_id
    assert inventory_application_item.quantity == 3


def test_submit_public_application_rolls_back_when_inventory_consumption_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = CapturingSession()
    user_id = uuid.uuid4()
    package = SimpleNamespace(
        id=PACKAGE_ID,
        stock=5,
        applied_count=7,
        food_bank_id=FOOD_BANK_ID,
        package_items=[SimpleNamespace(inventory_item_id=INVENTORY_ITEM_ID, quantity=2)],
    )
    inventory_item = SimpleNamespace(
        id=INVENTORY_ITEM_ID,
        food_bank_id=FOOD_BANK_ID,
        name="Rice",
        unit="bags",
    )
    application = SimpleNamespace(
        id=uuid.uuid4(),
        created_at=datetime(2026, 4, 23, 14, 30, 0),
        redemption_code="ABCD-1234",
    )
    original_package_stock = package.stock
    original_package_applied_count = package.applied_count

    async def _consume_inventory_lots(_inventory_item_id: int, _quantity: int, _db):
        raise ValueError("lot exhausted")

    async def _run_guarded_transaction(_db, action, **_kwargs):
        snapshot = list(db.added)
        try:
            return await action()
        except Exception:
            package.stock = original_package_stock
            package.applied_count = original_package_applied_count
            db.added[:] = snapshot
            raise

    patch_attrs(
        monkeypatch,
        application_submission_service,
        run_guarded_transaction=_run_guarded_transaction,
        require_one_or_404=async_return(FOOD_BANK_ID),
        _validate_weekly_limits=async_return(None),
        _load_requested_packages=async_return({PACKAGE_ID: package}),
        _load_requested_inventory_items=async_return({INVENTORY_ITEM_ID: inventory_item}),
        _create_pending_application=async_return(application),
        consume_inventory_lots=_consume_inventory_lots,
        record_application_distribution_snapshots=async_return(None),
        flush_refresh=async_return(application),
    )

    with pytest.raises(HTTPException) as exc_info:
        run_async(
            application_submission_service.submit_public_application(
                ApplicationCreate(
                    food_bank_id=FOOD_BANK_ID,
                    week_start=APPLICATION_WEEK_START,
                    items=[
                        {"package_id": PACKAGE_ID, "quantity": 2},
                        {"inventory_item_id": INVENTORY_ITEM_ID, "quantity": 3},
                    ],
                ),
                {"id": str(user_id)},
                db,
            )
        )

    assert_http_exception(
        exc_info,
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Insufficient stock for inventory item {INVENTORY_ITEM_ID}: "
            "lot exhausted"
        ),
    )
    assert package.stock == original_package_stock
    assert package.applied_count == original_package_applied_count
    assert db.added == []
