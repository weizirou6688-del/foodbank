"""幂等地植入共享的 demo 用户、food bank、库存和套餐。"""

from datetime import date, timedelta

from sqlalchemy import select

from app.core.config import settings
from app.core.bootstrap_demo_legacy import (
    cleanup_legacy_demo_shared_records,
    demo_seed_batch_reference,
    demo_seed_batch_reference_candidates,
)
from app.core.bootstrap_seed import (
    DEMO_FOOD_BANKS,
    DEMO_INVENTORY_ITEMS,
    DEMO_PACKAGES,
    DEMO_SCOPED_INVENTORY_ITEMS,
    DEMO_USERS,
    canonical_demo_food_bank_name,
    canonical_demo_inventory_item_name,
    canonical_demo_package_name,
    demo_food_bank_lookup_names,
    demo_inventory_item_lookup_names,
    demo_package_lookup_names,
)
from app.core.database import AsyncSessionLocal
from app.core.db_utils import (
    fetch_one_or_none,
    fetch_scalars,
    sync_keyed_quantity_children,
    sync_model_fields,
)
from app.core.security import get_password_hash, verify_password
from app.models.food_bank import FoodBank
from app.models.food_package import FoodPackage
from app.models.inventory_item import InventoryItem
from app.models.inventory_lot import InventoryLot
from app.models.inventory_waste_event import InventoryWasteEvent
from app.models.package_item import PackageItem
from app.models.user import User


def _resolve_demo_notification_email(default_email: str | None) -> str | None:
    configured_operations_email = settings.operations_fallback_email
    normalized_default = (default_email or "").strip()
    normalized_lower = normalized_default.lower()

    # 占位的 demo 域名会被替换成配置里的运维邮箱,让种子 food bank
    # 在测试数据之外仍然有一个真正能收信的通知地址
    if normalized_default and not normalized_lower.endswith(
        ("@foodbank.com", "@example.com")
    ):
        return normalized_default

    return configured_operations_email or default_email


async def _find_existing_demo_food_bank(
    db,
    food_bank_name: str,
) -> FoodBank | None:
    for lookup_name in demo_food_bank_lookup_names(food_bank_name):
        existing = await fetch_one_or_none(
            db,
            select(FoodBank).where(FoodBank.name == lookup_name),
        )
        if existing is not None:
            return existing
    return None


async def _find_existing_demo_inventory_item(
    db,
    *,
    food_bank_id: int,
    item_name: str,
) -> InventoryItem | None:
    for lookup_name in demo_inventory_item_lookup_names(item_name):
        existing = await fetch_one_or_none(
            db,
            select(InventoryItem).where(
                InventoryItem.name == lookup_name,
                InventoryItem.food_bank_id == food_bank_id,
            ),
        )
        if existing is not None:
            return existing
    return None


async def _find_existing_demo_inventory_lot(
    db,
    *,
    inventory_item_id: int,
    item_name: str,
    food_bank_id: int,
) -> InventoryLot | None:
    for lookup_name in demo_inventory_item_lookup_names(item_name):
        existing = await fetch_one_or_none(
            db,
            select(InventoryLot).where(
                InventoryLot.inventory_item_id == inventory_item_id,
                InventoryLot.batch_reference.in_(
                    demo_seed_batch_reference_candidates(
                        lookup_name,
                        food_bank_id,
                    )
                ),
            ),
        )
        if existing is not None:
            return existing
    return None


async def _find_existing_demo_food_package(
    db,
    *,
    food_bank_id: int,
    package_name: str,
) -> FoodPackage | None:
    for lookup_name in demo_package_lookup_names(package_name):
        existing = await fetch_one_or_none(
            db,
            select(FoodPackage).where(
                FoodPackage.name == lookup_name,
                FoodPackage.food_bank_id == food_bank_id,
            ),
        )
        if existing is not None:
            return existing
    return None


async def ensure_demo_users() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        # 重新植入时应该原地修复已知的 demo 账号,而不是
        # 一旦角色、范围或密码有变化就建一份重复的
        for demo_user in DEMO_USERS:
            food_bank_id = None
            food_bank_name = demo_user.get("food_bank_name")
            if food_bank_name:
                food_bank = await _find_existing_demo_food_bank(
                    db,
                    str(food_bank_name),
                )
                if food_bank is not None:
                    food_bank_id = food_bank.id

            existing = await fetch_one_or_none(
                db,
                select(User).where(User.email == demo_user["email"]),
            )

            if existing is None:
                db.add(
                    User(
                        name=demo_user["name"],
                        email=demo_user["email"],
                        password_hash=get_password_hash(demo_user["password"]),
                        role=demo_user["role"],
                        food_bank_id=food_bank_id,
                    )
                )
                changed = True
                continue

            profile_changed = sync_model_fields(
                existing,
                {
                    "name": demo_user["name"],
                    "role": demo_user["role"],
                    "food_bank_id": food_bank_id,
                },
            )
            password_changed = not verify_password(
                demo_user["password"],
                existing.password_hash,
            )
            if profile_changed or password_changed:
                if password_changed:
                    existing.password_hash = get_password_hash(demo_user["password"])
                changed = True

        if changed:
            await db.commit()


async def ensure_demo_food_banks() -> None:
    async with AsyncSessionLocal() as db:
        changed = False

        for demo_bank in DEMO_FOOD_BANKS:
            notification_email = _resolve_demo_notification_email(
                demo_bank.get("notification_email")
            )
            existing = await _find_existing_demo_food_bank(
                db,
                str(demo_bank["name"]),
            )

            if existing is None:
                db.add(
                    FoodBank(
                        name=demo_bank["name"],
                        address=demo_bank["address"],
                        lat=demo_bank["lat"],
                        lng=demo_bank["lng"],
                        notification_email=notification_email,
                    )
                )
                changed = True
                continue

            if sync_model_fields(
                existing,
                {
                    "name": demo_bank["name"],
                    "address": demo_bank["address"],
                    "lat": demo_bank["lat"],
                    "lng": demo_bank["lng"],
                    "notification_email": notification_email,
                },
                current_normalizers={"lat": float, "lng": float},
            ):
                changed = True

        if changed:
            await db.commit()


async def ensure_demo_inventory_and_packages() -> None:
    async with AsyncSessionLocal() as db:
        changed = False
        food_banks_by_name: dict[str, FoodBank] = {}
        inventory_items_by_scope: dict[tuple[str, str], InventoryItem] = {}

        # 用标准化名字预加载所有被引用的 food bank,后续同步步骤可以更新
        # 改过名的 demo 记录,而不是又拷贝一份相同的种子数据
        for bank_name in (
            {
                canonical_demo_food_bank_name(str(bank["name"]))
                for bank in DEMO_FOOD_BANKS
            }
            | {
                canonical_demo_food_bank_name(str(package["food_bank_name"]))
                for package in DEMO_PACKAGES
            }
            | {
                canonical_demo_food_bank_name(str(item["food_bank_name"]))
                for item in DEMO_INVENTORY_ITEMS
            }
            | {
                canonical_demo_food_bank_name(str(item["food_bank_name"]))
                for item in DEMO_SCOPED_INVENTORY_ITEMS
            }
        ):
            bank = await _find_existing_demo_food_bank(db, bank_name)
            if bank is not None:
                food_banks_by_name[bank_name] = bank

        for item_data in [*DEMO_INVENTORY_ITEMS, *DEMO_SCOPED_INVENTORY_ITEMS]:
            bank_name = canonical_demo_food_bank_name(
                str(item_data["food_bank_name"])
            )
            item_name = canonical_demo_inventory_item_name(str(item_data["name"]))
            bank = food_banks_by_name.get(bank_name)
            if bank is None:
                continue

            existing_item = await _find_existing_demo_inventory_item(
                db,
                food_bank_id=bank.id,
                item_name=item_name,
            )

            if existing_item is None:
                existing_item = InventoryItem(
                    name=item_name,
                    category=item_data["category"],
                    unit=item_data["unit"],
                    threshold=item_data["threshold"],
                    food_bank_id=bank.id,
                )
                db.add(existing_item)
                await db.flush()
                changed = True
            else:
                if sync_model_fields(
                    existing_item,
                    {
                        "name": item_name,
                        "category": item_data["category"],
                        "unit": item_data["unit"],
                        "threshold": item_data["threshold"],
                        "food_bank_id": bank.id,
                    },
                ):
                    changed = True

            inventory_items_by_scope[(bank_name, item_name)] = existing_item

            batch_reference = demo_seed_batch_reference(item_name, bank.id)
            existing_lot = await _find_existing_demo_inventory_lot(
                db,
                inventory_item_id=existing_item.id,
                item_name=item_name,
                food_bank_id=bank.id,
            )
            expiry_date = date.today() + timedelta(
                days=int(item_data.get("expiry_days", 365))
            )

            # batch reference 是种子库存的稳定身份,反复运行时会原地刷新
            # 数量和过期时间,而不是堆出一堆重复批次
            if existing_lot is None:
                db.add(
                    InventoryLot(
                        inventory_item_id=existing_item.id,
                        quantity=item_data["quantity"],
                        received_date=date.today(),
                        expiry_date=expiry_date,
                        batch_reference=batch_reference,
                    )
                )
                changed = True
            else:
                if sync_model_fields(
                    existing_lot,
                    {
                        "quantity": item_data["quantity"],
                        "received_date": date.today(),
                        "expiry_date": expiry_date,
                        "batch_reference": batch_reference,
                        "deleted_at": None,
                    },
                ):
                    changed = True
                for waste_event in await fetch_scalars(
                    db,
                    select(InventoryWasteEvent).where(
                        InventoryWasteEvent.inventory_lot_id == existing_lot.id
                    ),
                ):
                    if sync_model_fields(
                        waste_event,
                        {"batch_reference": batch_reference},
                    ):
                        changed = True

        expected_package_names_by_bank = {
            bank_name: {
                canonical_demo_package_name(str(package["name"]))
                for package in DEMO_PACKAGES
                if canonical_demo_food_bank_name(str(package["food_bank_name"]))
                == bank_name
            }
            for bank_name in {
                canonical_demo_food_bank_name(str(package["food_bank_name"]))
                for package in DEMO_PACKAGES
            }
            if bank_name in food_banks_by_name
        }

        for package_data in DEMO_PACKAGES:
            bank_name = canonical_demo_food_bank_name(
                str(package_data["food_bank_name"])
            )
            package_name = canonical_demo_package_name(str(package_data["name"]))
            bank = food_banks_by_name.get(bank_name)
            if bank is None:
                continue

            existing_package = await _find_existing_demo_food_package(
                db,
                food_bank_id=bank.id,
                package_name=package_name,
            )

            if existing_package is None:
                existing_package = FoodPackage(
                    name=package_name,
                    category=package_data["category"],
                    description=package_data["description"],
                    stock=package_data["stock"],
                    threshold=package_data["threshold"],
                    applied_count=0,
                    image_url=package_data["image_url"],
                    food_bank_id=bank.id,
                    is_active=True,
                )
                db.add(existing_package)
                await db.flush()
                changed = True
            else:
                if sync_model_fields(
                    existing_package,
                    {
                        "name": package_name,
                        "category": package_data["category"],
                        "description": package_data["description"],
                        "stock": package_data["stock"],
                        "threshold": package_data["threshold"],
                        "image_url": package_data["image_url"],
                        "food_bank_id": bank.id,
                        "is_active": True,
                    },
                ):
                    changed = True

            existing_items = await fetch_scalars(
                db,
                select(PackageItem).where(PackageItem.package_id == existing_package.id),
            )
            desired_quantities = {
                inventory_items_by_scope[
                    (
                        bank_name,
                        canonical_demo_inventory_item_name(
                            str(content["item_name"])
                        ),
                    )
                ].id: content["quantity"]
                for content in package_data["contents"]
            }
            if await sync_keyed_quantity_children(
                db,
                existing_items=existing_items,
                desired_quantities=desired_quantities,
                key_getter=lambda item: item.inventory_item_id,
                build_child=lambda inventory_item_id, quantity: PackageItem(
                    package_id=existing_package.id,
                    inventory_item_id=inventory_item_id,
                    quantity=quantity,
                ),
            ):
                changed = True

        for bank_name, bank in food_banks_by_name.items():
            expected_names = expected_package_names_by_bank.get(bank_name, set())
            for existing_package in await fetch_scalars(
                db,
                select(FoodPackage).where(FoodPackage.food_bank_id == bank.id),
            ):
                # 当前种子里缺失的套餐是停用而不是删除,
                # 这样历史申请仍然能指向可读的套餐记录
                if (
                    existing_package.name not in expected_names
                    and existing_package.is_active
                ):
                    existing_package.is_active = False
                    changed = True

        # 旧版共享 demo 记录早于 food bank 范围概念,如果留着和带范围的种子
        # 共存,捐赠或库存就会被重复计数
        changed = await cleanup_legacy_demo_shared_records(db) or changed

        if changed:
            await db.commit()
