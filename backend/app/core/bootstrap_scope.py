"""带范围的 demo 种子,在共享基础数据之上叠加捐赠和申请。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.bootstrap_seed import (
    DEMO_SCOPED_ADMIN_SEEDS,
    canonical_demo_cash_payment_reference,
    canonical_demo_goods_donor_name,
    demo_cash_payment_reference_lookup_values,
    demo_food_bank_lookup_names,
    demo_goods_donor_lookup_names,
    demo_application_created_at,
    demo_week_start,
    ensure_single_package_application_item,
)
from app.core.database import AsyncSessionLocal
from app.core.db_utils import (
    fetch_scalars,
    sync_keyed_quantity_children,
    sync_model_fields,
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


async def _load_seed_scope(
    db,
    *,
    admin_email: str,
    bank_name: str,
) -> tuple[FoodBank, User, dict[str, FoodPackage], bool] | None:
    bank = None
    for lookup_name in demo_food_bank_lookup_names(bank_name):
        bank = await db.scalar(select(FoodBank).where(FoodBank.name == lookup_name))
        if bank is not None:
            break
    if bank is None:
        return None

    changed = False
    local_admin = await db.scalar(select(User).where(User.email == admin_email))
    if local_admin is not None and sync_model_fields(
        local_admin,
        {"food_bank_id": bank.id},
    ):
        changed = True

    # 带范围的 demo 申请复用共享的公开用户,种子记录走的是
    # 和真实提交一样的"公开用户到 admin"路径
    public_user = await db.scalar(select(User).where(User.email == "user@example.com"))
    if public_user is None:
        return None

    packages_by_name = {
        package.name: package
        for package in await fetch_scalars(
            db,
            select(FoodPackage).where(FoodPackage.food_bank_id == bank.id),
        )
    }
    return bank, public_user, packages_by_name, changed


async def _sync_cash_donations(
    db,
    *,
    bank_id: int,
    cash_donations: list[dict[str, object]],
) -> bool:
    changed = False
    for cash_seed in cash_donations:
        payment_reference = canonical_demo_cash_payment_reference(
            str(cash_seed["payment_reference"])
        )
        donation = await db.scalar(
            select(DonationCash).where(
                DonationCash.payment_reference.in_(
                    demo_cash_payment_reference_lookup_values(payment_reference)
                )
            )
        )
        desired_fields = {
            "payment_reference": payment_reference,
            "donor_name": cash_seed["donor_name"],
            "donor_email": cash_seed["donor_email"],
            "amount_pence": cash_seed["amount_pence"],
            "status": cash_seed["status"],
            "food_bank_id": bank_id,
        }
        if donation is None:
            db.add(DonationCash(**desired_fields))
            changed = True
            continue

        if sync_model_fields(donation, desired_fields):
            changed = True

    return changed


async def _sync_goods_donation_items(
    db,
    *,
    donation: DonationGoods,
    goods_items: list[dict[str, object]],
) -> bool:
    existing_items = await fetch_scalars(
        db,
        select(DonationGoodsItem).where(DonationGoodsItem.donation_id == donation.id),
    )
    desired_quantities = {
        item_seed["item_name"]: item_seed["quantity"] for item_seed in goods_items
    }
    return await sync_keyed_quantity_children(
        db,
        existing_items=existing_items,
        desired_quantities=desired_quantities,
        key_getter=lambda item: item.item_name,
        build_child=lambda item_name, quantity: DonationGoodsItem(
            donation_id=donation.id,
            item_name=item_name,
            quantity=quantity,
        ),
    )


async def _sync_goods_donations(
    db,
    *,
    bank: FoodBank,
    goods_donations: list[dict[str, object]],
) -> bool:
    changed = False

    for goods_seed in goods_donations:
        donor_name = canonical_demo_goods_donor_name(str(goods_seed["donor_name"]))
        # 用捐赠人邮箱加上标准化后的名字,被改过名的 demo 机构
        # 能匹配到自己的旧种子记录,不会另起重复行
        donation = await db.scalar(
            select(DonationGoods).where(
                DonationGoods.food_bank_id == bank.id,
                DonationGoods.donor_email == goods_seed["donor_email"],
                DonationGoods.donor_name.in_(demo_goods_donor_lookup_names(donor_name)),
            )
        )
        desired_fields = {
            "donor_name": donor_name,
            "food_bank_id": bank.id,
            "food_bank_name": bank.name,
            "food_bank_address": bank.address,
            "donor_phone": normalize_goods_donor_phone(
                goods_seed["donor_phone"],
                required=True,
            ),
            "postcode": goods_seed["postcode"],
            "pickup_date": format_goods_pickup_date(
                date.today() + timedelta(days=goods_seed["pickup_date_offset_days"])
            ),
            "item_condition": goods_seed["item_condition"],
            "estimated_quantity": goods_seed["estimated_quantity"],
            "notes": goods_seed["notes"],
            "status": goods_seed["status"],
        }

        if donation is None:
            donation = DonationGoods(
                donor_email=goods_seed["donor_email"],
                **desired_fields,
            )
            db.add(donation)
            await db.flush()
            changed = True
        elif sync_model_fields(donation, desired_fields):
            changed = True

        if await _sync_goods_donation_items(
            db,
            donation=donation,
            goods_items=list(goods_seed["items"]),
        ):
            changed = True

    return changed


def _application_seed_times(
    application_seed: dict[str, object],
) -> tuple[date, datetime, datetime, datetime | None]:
    # 按周相对的时间戳让 demo 的分析数据始终看起来是新的,
    # 同时保留从提交到领取的可信生命周期
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
    return week_start, created_at, updated_at, redeemed_at


async def _sync_application_records(
    db,
    *,
    bank: FoodBank,
    public_user: User,
    packages_by_name: dict[str, FoodPackage],
    applications: list[dict[str, object]],
) -> bool:
    changed = False

    for application_seed in applications:
        package = packages_by_name.get(application_seed["package_name"])
        if package is None:
            continue

        application = await db.scalar(
            select(Application).where(
                Application.redemption_code == application_seed["redemption_code"]
            )
        )
        week_start, created_at, updated_at, redeemed_at = _application_seed_times(
            application_seed
        )
        desired_fields = {
            "user_id": public_user.id,
            "food_bank_id": bank.id,
            "status": application_seed["status"],
            "week_start": week_start,
            "total_quantity": application_seed["quantity"],
            "updated_at": updated_at,
            "redeemed_at": redeemed_at,
            "deleted_at": None,
        }

        if application is None:
            application = Application(
                redemption_code=application_seed["redemption_code"],
                created_at=created_at,
                **desired_fields,
            )
            db.add(application)
            await db.flush()
            changed = True
        elif sync_model_fields(application, desired_fields):
            changed = True

        existing_app_items = await fetch_scalars(
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


async def _sync_admin_scope_seed(
    db,
    *,
    admin_email: str,
    bank_name: str,
    cash_donations: list[dict[str, object]],
    goods_donations: list[dict[str, object]],
    applications: list[dict[str, object]],
) -> bool:
    scope = await _load_seed_scope(
        db,
        admin_email=admin_email,
        bank_name=bank_name,
    )
    if scope is None:
        return False

    bank, public_user, packages_by_name, changed = scope
    if await _sync_cash_donations(db, bank_id=bank.id, cash_donations=cash_donations):
        changed = True
    if await _sync_goods_donations(db, bank=bank, goods_donations=goods_donations):
        changed = True
    if await _sync_application_records(
        db,
        bank=bank,
        public_user=public_user,
        packages_by_name=packages_by_name,
        applications=applications,
    ):
        changed = True

    return changed


async def ensure_demo_admin_scope_records() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        # 这一层假设共享种子已经创建好这些范围内记录指向的
        # food bank、套餐和公开用户
        for seed in DEMO_SCOPED_ADMIN_SEEDS:
            if await _sync_admin_scope_seed(
                db,
                admin_email=str(seed["admin_email"]),
                bank_name=str(seed["bank_name"]),
                cash_donations=list(seed["cash_donations"]),
                goods_donations=list(seed["goods_donations"]),
                applications=list(seed["applications"]),
            ):
                changed = True

        if changed:
            await db.commit()
