"""共用的规范化辅助函数,让分析查询走同一套规则。"""

from __future__ import annotations

from datetime import date, datetime, timezone


def as_utc_naive(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def event_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        # 分析分桶比较的是 UTC 日历日,所以带时区的时间戳统一压成
        # 历史记录里那种不带时区的 UTC 形式
        normalized = as_utc_naive(value)
        return normalized.date() if normalized is not None else None
    return value


def in_period(target: date | None, start: date, end: date) -> bool:
    return target is not None and start <= target < end


def normalize_donor_type(raw_value: str | None) -> str:
    normalized = (raw_value or "").strip().lower()
    if normalized == "supermarket":
        return "Supermarket"
    if normalized == "organization":
        return "Organization"
    if normalized == "individual":
        return "Individual"
    return "Unspecified"


def donor_identity(email: str | None, name: str | None) -> str | None:
    # 邮箱是稳定的捐赠人标识,姓名只是早期没有邮箱的记录的兜底匹配
    if email and email.strip():
        return email.strip().lower()
    if name and name.strip():
        return f"name:{name.strip().lower()}"
    return None


def is_bank_scoped_record(record: object) -> bool:
    # 有些分析辅助函数会处理无范围的全局元数据对象
    if not hasattr(record, "food_bank_id"):
        return True
    return getattr(record, "food_bank_id", None) is not None
