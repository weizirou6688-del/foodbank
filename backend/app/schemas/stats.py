from pydantic import BaseModel


class StockGapPackageOut(BaseModel):
    package_id: int
    package_name: str
    stock: int
    threshold: int
    gap: int
