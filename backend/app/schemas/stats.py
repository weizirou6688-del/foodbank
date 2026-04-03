from pydantic import BaseModel


class StockGapPackageOut(BaseModel):
    package_id: int
    package_name: str
    stock: int
    threshold: int
    gap: int


class DashboardChartOut(BaseModel):
    labels: list[str]
    data: list[float]


class DashboardImpactMetricOut(BaseModel):
    key: str
    value: str
    label: str


class PublicImpactMetricOut(BaseModel):
    key: str
    change: str
    value: str
    label: str
    note: str
    positive: bool = True


class PublicImpactMetricsOut(BaseModel):
    impactMetrics: list[PublicImpactMetricOut]


class DashboardKpiTrendsOut(BaseModel):
    donation: str
    package: str
    lowStock: str
    wastage: str


class DashboardKpiOut(BaseModel):
    totalDonation: int
    totalSku: int
    totalPackageDistributed: int
    lowStockCount: int
    expiringLotCount: int
    redemptionRate: float
    trends: DashboardKpiTrendsOut


class DashboardDisplayCardOut(BaseModel):
    title: str
    value: str
    subtitle: str
    trend: str | None = None


class DashboardLowStockAlertOut(BaseModel):
    item_name: str
    category: str
    current_stock: int
    current_stock_label: str
    threshold: int
    threshold_label: str
    deficit: int
    status: str
    status_tone: str


class DashboardExpiringLotOut(BaseModel):
    item_name: str
    lot_number: str
    expiry_date: str
    remaining_stock: int
    remaining_stock_label: str
    days_until_expiry: int
    status_tone: str


class DashboardVerificationRecordOut(BaseModel):
    redemption_code: str
    package_type: str
    verified_at: str
    status: str
    status_tone: str


class DashboardDonationAnalyticsOut(BaseModel):
    source: DashboardChartOut
    trend: DashboardChartOut
    category: DashboardChartOut
    donorType: DashboardChartOut
    averageValue: DashboardDisplayCardOut


class DashboardInventoryAnalyticsOut(BaseModel):
    health: DashboardChartOut
    category: DashboardChartOut
    lowStockAlerts: list[DashboardLowStockAlertOut]


class DashboardPackageAnalyticsOut(BaseModel):
    trend: DashboardChartOut
    redemption: DashboardChartOut
    packageType: DashboardChartOut
    averageSupportDuration: DashboardDisplayCardOut
    itemsPerPackage: DashboardDisplayCardOut


class DashboardExpiryChartOut(DashboardChartOut):
    label: str = "Wastage"


class DashboardExpiryAnalyticsOut(BaseModel):
    distribution: DashboardChartOut
    wastage: DashboardExpiryChartOut
    expiringLots: list[DashboardExpiringLotOut]


class DashboardRedemptionAnalyticsOut(BaseModel):
    rateTrend: DashboardChartOut
    breakdown: DashboardChartOut
    recentVerificationRecords: list[DashboardVerificationRecordOut]


class DashboardAnalyticsOut(BaseModel):
    impactMetrics: list[DashboardImpactMetricOut]
    kpi: DashboardKpiOut
    donation: DashboardDonationAnalyticsOut
    inventory: DashboardInventoryAnalyticsOut
    package: DashboardPackageAnalyticsOut
    expiry: DashboardExpiryAnalyticsOut
    redemption: DashboardRedemptionAnalyticsOut

