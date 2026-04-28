import secrets


CANONICAL_REDEMPTION_CODE_PATTERN = r"^[A-Z0-9]{4}-[A-Z0-9]{4}$"
SUPPORTED_REDEMPTION_CODE_PATTERN = CANONICAL_REDEMPTION_CODE_PATTERN
# 略掉容易看混的字符,这样打印出来的兑换码用邮件或电话念都能看清
REDEMPTION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_redemption_code() -> str:
    left = "".join(secrets.choice(REDEMPTION_CODE_ALPHABET) for _ in range(4))
    right = "".join(secrets.choice(REDEMPTION_CODE_ALPHABET) for _ in range(4))
    return f"{left}-{right}"


def normalize_redemption_code(raw_code: str) -> str:
    # 用户经常粘贴时漏掉横杠,先把标准形态补回来,
    # 后面的校验或比较才不会出岔子
    stripped = raw_code.strip().upper()
    compact = "".join(char for char in stripped if char.isalnum())
    if len(compact) == 8 and "-" not in stripped:
        return f"{compact[:4]}-{compact[4:]}"
    return stripped
