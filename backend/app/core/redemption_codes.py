import re
import secrets


CANONICAL_REDEMPTION_CODE_PATTERN = r"^[A-Z0-9]{4}-[A-Z0-9]{4}$"
LEGACY_DASHED_REDEMPTION_CODE_PATTERN = r"^[A-Z]{2}-[A-Z0-9]{6}$"
LEGACY_DIGIT_REDEMPTION_CODE_PATTERN = r"^[A-Z]{2}\d{8}$"
SUPPORTED_REDEMPTION_CODE_PATTERN = (
    r"^(?:[A-Z0-9]{4}-[A-Z0-9]{4}|[A-Z]{2}-[A-Z0-9]{6}|[A-Z]{2}\d{8})$"
)
REDEMPTION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_redemption_code() -> str:
    left = "".join(secrets.choice(REDEMPTION_CODE_ALPHABET) for _ in range(4))
    right = "".join(secrets.choice(REDEMPTION_CODE_ALPHABET) for _ in range(4))
    return f"{left}-{right}"


def normalize_redemption_code(raw_code: str) -> str:
    stripped = raw_code.strip().upper()
    compact = "".join(char for char in stripped if char.isalnum())
    if len(compact) == 8:
        return f"{compact[:4]}-{compact[4:]}"
    if len(compact) == 10 and compact[:2].isalpha() and compact[2:].isdigit():
        return compact
    return stripped


def is_canonical_redemption_code(code: str) -> bool:
    return re.fullmatch(CANONICAL_REDEMPTION_CODE_PATTERN, code) is not None


def redemption_code_lookup_candidates(raw_code: str) -> list[str]:
    normalized = normalize_redemption_code(raw_code)
    stripped = raw_code.strip().upper()
    candidates = [normalized]

    if stripped and stripped not in candidates:
        candidates.append(stripped)

    compact = "".join(char for char in stripped if char.isalnum())
    if len(compact) == 8:
        legacy_dashed = f"{compact[:2]}-{compact[2:]}"
        if legacy_dashed not in candidates:
            candidates.append(legacy_dashed)

    return candidates
