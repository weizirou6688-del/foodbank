from datetime import date, timedelta, timezone

from sqlalchemy import select

from app.core.bootstrap_seed import (
    DEMO_SCOPED_ADMIN_SEEDS,
    demo_application_created_at,
    demo_week_start,
    ensure_single_package_application_item,
)
from app.core.database import AsyncSessionLocal
from app.core.db_utils import (
    fetch_scalars as _fetch_scalars,
    sync_keyed_quantity_children as _sync_keyed_quantity_children,
    sync_model_fields as _sync_model_fields,
)
from app.core.goods_donation_format import (
    format_goods_pickup_date,
    normalize_goods_donor_phone,
)
from app.models.application import Application
from app.models.application_item import ApplicationItem
from app.models.donation_cash import DonationCash
from app.models.donation_goods import DonationGoods
from app.models.donation_goods_item import DonationGoodsItem
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.user import User


async def _ensure_demo_scoped_admin_records(
    db,
    *,
    admin_email: str,
    bank_name: str,
    cash_donations: list[dict[str, object]],
    goods_donations: list[dict[str, object]],
    applications: list[dict[str, object]],
) -> bool:
    changed = False

    bank = await db.scalar(select(FoodBank).where(FoodBank.name == bank_name))
    if bank is None:
        return changed

    local_admin = await db.scalar(select(User).where(User.email == admin_email))
    if local_admin is not None and _sync_model_fields(
        local_admin,
        {"food_bank_id": bank.id},
    ):
        changed = True

    public_user = await db.scalar(select(User).where(User.email == "user@example.com"))
    if public_user is None:
        return changed

    packages_by_name = {
        package.name: package
        for package in await _fetch_scalars(
            db,
            select(FoodPackage).where(FoodPackage.food_bank_id == bank.id),
        )
    }

    for cash_seed in cash_donations:
        donation = await db.scalar(
            select(DonationCash).where(
                DonationCash.payment_reference == cash_seed["payment_reference"]
            )
        )
        if donation is None:
            db.add(
                DonationCash(
                    donor_name=cash_seed["donor_name"],
                    donor_email=cash_seed["donor_email"],
                    amount_pence=cash_seed["amount_pence"],
                    payment_reference=cash_seed["payment_reference"],
                    status=cash_seed["status"],
                    food_bank_id=bank.id,
                )
            )
            changed = True
        else:
            if _sync_model_fields(
                donation,
                {
                    "donor_name": cash_seed["donor_name"],
                    "donor_email": cash_seed["donor_email"],
                    "amount_pence": cash_seed["amount_pence"],
                    "status": cash_seed["status"],
                    "food_bank_id": bank.id,
                },
            ):
                changed = True

    for goods_seed in goods_donations:
        donation = await db.scalar(
            select(DonationGoods).where(
                DonationGoods.food_bank_id == bank.id,
                DonationGoods.donor_email == goods_seed["donor_email"],
                DonationGoods.donor_name == goods_seed["donor_name"],
            )
        )
        pickup_date = format_goods_pickup_date(
            date.today() + timedelta(days=goods_seed["pickup_date_offset_days"])
        )
        donor_phone = normalize_goods_donor_phone(
            goods_seed["donor_phone"],
            required=True,
        )
        if donation is None:
            donation = DonationGoods(
                food_bank_id=bank.id,
                food_bank_name=bank.name,
                food_bank_address=bank.address,
                donor_name=goods_seed["donor_name"],
                donor_email=goods_seed["donor_email"],
                donor_phone=donor_phone,
                postcode=goods_seed["postcode"],
                pickup_date=pickup_date,
                item_condition=goods_seed["item_condition"],
                estimated_quantity=goods_seed["estimated_quantity"],
                notes=goods_seed["notes"],
                status=goods_seed["status"],
            )
            db.add(donation)
            await db.flush()
            changed = True
        else:
            if _sync_model_fields(
                donation,
                {
                    "food_bank_id": bank.id,
                    "food_bank_name": bank.name,
                    "food_bank_address": bank.address,
                    "donor_phone": donor_phone,
                    "postcode": goods_seed["postcode"],
                    "pickup_date": pickup_date,
                    "item_condition": goods_seed["item_condition"],
                    "estimated_quantity": goods_seed["estimated_quantity"],
                    "notes": goods_seed["notes"],
                    "status": goods_seed["status"],
                },
            ):
                changed = True

        existing_items = await _fetch_scalars(
            db,
            select(DonationGoodsItem).where(
                DonationGoodsItem.donation_id == donation.id
            ),
        )
        desired_quantities = {
            item_seed["item_name"]: item_seed["quantity"]
            for item_seed in goods_seed["items"]
        }
        if await _sync_keyed_quantity_children(
            db,
            existing_items=existing_items,
            desired_quantities=desired_quantities,
            key_getter=lambda item: item.item_name,
            build_child=lambda item_name, quantity: DonationGoodsItem(
                donation_id=donation.id,
                item_name=item_name,
                quantity=quantity,
            ),
        ):
            changed = True

    for application_seed in applications:
        package = packages_by_name.get(application_seed["package_name"])
        if package is None:
            continue

        application = await db.scalar(
            select(Application).where(
                Application.redemption_code == application_seed["redemption_code"]
            )
        )
        week_start = demo_week_start(application_seed["week_offset"])
        created_at = demo_application_created_at(
            week_start,
            int(application_seed.get("created_day_offset", 0)),
            int(application_seed.get("created_hour", 10)),
        )
        created_at_aware = created_at.replace(tzinfo=timezone.utc)
        redeemed_at = (
            created_at_aware + timedelta(days=2)
            if application_seed["status"] == "collected"
            else None
        )
        updated_at = redeemed_at or (created_at_aware + timedelta(hours=6))
        if application is None:
            application = Application(
                user_id=public_user.id,
                food_bank_id=bank.id,
                redemption_code=application_seed["redemption_code"],
                status=application_seed["status"],
                week_start=week_start,
                total_quantity=application_seed["quantity"],
                created_at=created_at,
                updated_at=updated_at,
                redeemed_at=redeemed_at,
            )
            db.add(application)
            await db.flush()
            changed = True
        else:
            if _sync_model_fields(
                application,
                {
                    "user_id": public_user.id,
                    "food_bank_id": bank.id,
                    "status": application_seed["status"],
                    "week_start": week_start,
                    "total_quantity": application_seed["quantity"],
                    "updated_at": updated_at,
                    "redeemed_at": redeemed_at,
                    "deleted_at": None,
                },
            ):
                changed = True

        existing_app_items = await _fetch_scalars(
            db,
            select(ApplicationItem).where(
                ApplicationItem.application_id == application.id
            ),
        )
        if await ensure_single_package_application_item(
            db,
            application_id=application.id,
            existing_items=existing_app_items,
            package_id=package.id,
            quantity=application_seed["quantity"],
        ):
            changed = True

    return changed


async def ensure_demo_admin_scope_records() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        for seed in DEMO_SCOPED_ADMIN_SEEDS:
            changed = await _ensure_demo_scoped_admin_records(
                db,
                admin_email=str(seed["admin_email"]),
                bank_name=str(seed["bank_name"]),
                cash_donations=list(seed["cash_donations"]),
                goods_donations=list(seed["goods_donations"]),
                applications=list(seed["applications"]),
            ) or changed

        if changed:
            await db.commit()