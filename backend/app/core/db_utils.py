from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import TypeVar

from sqlalchemy.ext.asyncio import AsyncSession


T = TypeVar("T")
K = TypeVar("K")
ChildT = TypeVar("ChildT")


async def fetch_scalars(db: AsyncSession, query) -> list[T]:
    return list((await db.execute(query)).scalars().all())


async def fetch_rows(db: AsyncSession, query) -> list[tuple]:
    return list((await db.execute(query)).all())


async def fetch_one_or_none(db: AsyncSession, query) -> T | None:
    scalar = getattr(db, "scalar", None)
    if callable(scalar):
        result = await scalar(query)
        if hasattr(db, "scalar_values") or result is not None or not callable(getattr(db, "execute", None)):
            return result
    return (await db.execute(query)).scalar_one_or_none()


async def flush_refresh(db: AsyncSession, instance: T) -> T:
    await db.flush()
    await db.refresh(instance)
    return instance


def sync_model_fields(
    instance: object,
    field_values: Mapping[str, object],
    *,
    current_normalizers: Mapping[str, Callable[[object], object]] | None = None,
) -> bool:
    changed = False
    normalizers = current_normalizers or {}

    for field, value in field_values.items():
        current_value = getattr(instance, field)
        normalizer = normalizers.get(field)
        if normalizer is not None:
            current_value = normalizer(current_value)
        if current_value != value:
            setattr(instance, field, value)
            changed = True

    return changed


async def sync_keyed_quantity_children(
    db: AsyncSession,
    *,
    existing_items: Sequence[ChildT],
    desired_quantities: Mapping[K, int],
    key_getter: Callable[[ChildT], K],
    build_child: Callable[[K, int], object],
) -> bool:
    changed = False
    existing_items_by_key = {key_getter(item): item for item in existing_items}

    for key, quantity in desired_quantities.items():
        existing_item = existing_items_by_key.get(key)
        if existing_item is None:
            db.add(build_child(key, quantity))
            changed = True
        elif sync_model_fields(existing_item, {"quantity": quantity}):
            changed = True

    for existing_item in existing_items:
        if key_getter(existing_item) not in desired_quantities:
            await db.delete(existing_item)
            changed = True

    return changed
