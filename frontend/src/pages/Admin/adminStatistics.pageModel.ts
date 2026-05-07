import type { ComponentProps } from "react";
import type {
  DashboardAnalyticsResponse,
  DashboardChartData,
  DashboardDisplayCard,
} from "@/shared/lib/api/stats";
import type { ChartConfig } from "./chartRenderer";
import {
  DonationSection,
  DistributionSection,
  InventorySection,
  StatsKpiSection,
  VerificationSection,
  WasteSection,
  type ChartLegendConfig,
  type ChartLegendItem,
  type ChartLegendSwatchTone,
  type ChartPanel,
} from "./statsSections.analytics";
import { getPageMeta } from "./AdminLayout";
import {
  chartPalette as palette,
  useAdminDashboardData,
} from "./useAdminDashboardData";

type StatsKpiSectionProps = ComponentProps<typeof StatsKpiSection>;
type DonationSectionProps = ComponentProps<typeof DonationSection>;
type InventorySectionProps = ComponentProps<typeof InventorySection>;
type DistributionSectionProps = ComponentProps<typeof DistributionSection>;
type WasteSectionProps = ComponentProps<typeof WasteSection>;
type VerificationSectionProps = ComponentProps<typeof VerificationSection>;

type Analytics = DashboardAnalyticsResponse | null | undefined;
type AxisConfig = { beginAtZero?: boolean; min?: number; max?: number };

type PanelSpec = {
  title: string;
  loadingId: string;
  chartId: string;
  data: (analytics: Analytics) => DashboardChartData | null | undefined;
  build: (data: DashboardChartData) => ChartConfig;
  legend?: (
    analytics: Analytics,
    data: DashboardChartData,
  ) => ChartLegendConfig | undefined;
};

export type AdminStatisticsPageModel = {
  pageMeta: ReturnType<typeof getPageMeta>;
  loadError: string;
  clearLoadError: () => void;
  kpiSectionProps: StatsKpiSectionProps;
  donationSectionProps: DonationSectionProps;
  inventorySectionProps: InventorySectionProps;
  distributionSectionProps: DistributionSectionProps;
  wasteSectionProps: WasteSectionProps;
  verificationSectionProps: VerificationSectionProps;
};

const DEFAULT_CARDS = {
  averageDonation: {
    title: "Average Donation Value",
    value: "--",
    subtitle: "Per completed cash donation",
    trend: "Loading live trend...",
  },
  averageSupport: {
    title: "Average Family Support Duration",
    value: "--",
    subtitle: "Weeks",
  },
  itemsPerPackage: {
    title: "Items Per Package",
    value: "--",
    subtitle: "Loading live calculation...",
  },
} satisfies Record<string, DashboardDisplayCard>;

const donationSourceSwatches: ChartLegendSwatchTone[] = [
  "brand",
  "brand-dark",
  "blue",
  "purple",
];
const Y_SCALE = { beginAtZero: true };

const buildRadialChart = (
  type: "doughnut" | "pie",
  data: DashboardChartData,
  colors: string[],
): ChartConfig => ({
  type,
  labels: data.labels,
  values: data.data,
  colors: colors.length ? colors : ["#1976D2"],
});

const normalizeColors = (values: number[], color: string | string[]) =>
  Array.isArray(color)
    ? values.map((_, index) => color[index % color.length])
    : values.map(() => color);

const hasChartData = (
  data?: DashboardChartData | null,
): data is DashboardChartData => Boolean(data?.labels.length && data.data.length);

const pickChartData = (
  data?: DashboardChartData | null,
): DashboardChartData | undefined => (hasChartData(data) ? data : undefined);

const makeDoughnutChart = (
  data: DashboardChartData,
  colors: string[],
  showLegend = true,
): ChartConfig => {
  void showLegend;
  return buildRadialChart("doughnut", data, colors);
};

const makePieChart = (
  data: DashboardChartData,
  colors: string[],
  showLegend = true,
): ChartConfig => {
  void showLegend;
  return buildRadialChart("pie", data, colors);
};

const makeLineChart = (
  data: DashboardChartData,
  label: string,
  borderColor: string,
  backgroundColor: string,
  yScaleOverrides?: AxisConfig,
): ChartConfig => ({
  type: "line",
  labels: data.labels,
  values: data.data,
  label,
  lineColor: borderColor,
  fillColor: backgroundColor,
  yAxis: { ...Y_SCALE, ...(yScaleOverrides ?? {}) },
});

const makeBarChart = (
  data: DashboardChartData,
  label: string,
  backgroundColor: string | string[],
): ChartConfig => ({
  type: "bar",
  labels: data.labels,
  values: data.data,
  label,
  colors: normalizeColors(data.data, backgroundColor),
  yAxis: { ...Y_SCALE },
});

const buildChart = <T,>(
  data: T | undefined,
  builder: (value: T) => ChartConfig,
) => (data ? builder(data) : null);

const panel = (
  title: string,
  loadingId: string,
  chartId: string,
  data: PanelSpec["data"],
  build: PanelSpec["build"],
  legend?: PanelSpec["legend"],
): PanelSpec => ({
  title,
  loadingId,
  chartId,
  data,
  build,
  legend,
});

const pickCard = (
  card: DashboardDisplayCard | null | undefined,
  fallback: DashboardDisplayCard,
): DashboardDisplayCard => card ?? fallback;

const formatCount = (value: number, unit: string) => {
  const amount = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });

  return `${amount} ${unit}${Math.abs(value) === 1 ? "" : "s"}`;
};

const getChartValue = (
  data: DashboardChartData | null | undefined,
  label: string,
) => {
  const index = data?.labels.indexOf(label) ?? -1;
  return index >= 0 ? (data?.data[index] ?? 0) : 0;
};

function buildDonationLegend(
  source?: DashboardChartData | null,
  donorType?: DashboardChartData | null,
) {
  // Keep the donor-type split in the legend so we can add context without
  // introducing another standalone chart for a small breakdown.
  if (!source) {
    return undefined;
  }

  const items = source.labels.map<ChartLegendItem>((label, index) => ({
    label,
    value: formatCount(source.data[index] ?? 0, "donation"),
    swatchTone: donationSourceSwatches[index % donationSourceSwatches.length],
    ...(label === "Individual" && donorType
      ? {
          description:
            "Individual source totals are split by donor loyalty below.",
          details: [
            {
              label: "Regular Donors",
              value: formatCount(
                getChartValue(donorType, "Regular Donors"),
                "donor",
              ),
            },
            {
              label: "One-Time Donors",
              value: formatCount(
                getChartValue(donorType, "One-Time Donors"),
                "donor",
              ),
            },
          ],
        }
      : {}),
  }));

  if (donorType) {
    items.push({
      label: "Corporate Partners",
      value: formatCount(
        getChartValue(donorType, "Corporate Partners"),
        "partner",
      ),
      description:
        "Unique partner donors across Supermarket and Organization sources.",
    });
  }

  return items.length ? ({ items } satisfies ChartLegendConfig) : undefined;
}

const buildPanel = (analytics: Analytics, spec: PanelSpec): ChartPanel => {
  const data = pickChartData(spec.data(analytics));

  return {
    title: spec.title,
    loadingId: spec.loadingId,
    chartId: spec.chartId,
    chartConfig: buildChart(data, spec.build),
    legend: data ? spec.legend?.(analytics, data) : undefined,
  };
};

const buildPanels = (analytics: Analytics, specs: readonly PanelSpec[]) =>
  specs.map((spec) => buildPanel(analytics, spec));

const wastageLabel = (data: DashboardChartData) =>
  (data as DashboardChartData & { label?: string }).label || "Wastage";

// Drive the dashboard from config objects rather than hand-written chart markup
// so the view layer only cares about ready-to-render panel props.
const PANELS = {
  donation: {
    primary: [
      panel(
        "Donation Source Distribution",
        "donation-source-loading",
        "donation-source-chart",
        (analytics) => analytics?.donation.source,
        (data) => makeDoughnutChart(data, [...palette.donationSource], false),
        (analytics, data) =>
          buildDonationLegend(
            data,
            pickChartData(analytics?.donation.donorType),
          ),
      ),
      panel(
        "Goods Donation Trend",
        "donation-trend-loading",
        "donation-trend-chart",
        (analytics) => analytics?.donation.trend,
        (data) =>
          makeLineChart(
            data,
            "Donations",
            palette.donationTrend.line,
            palette.donationTrend.fill,
          ),
      ),
    ],
    secondary: [
      panel(
        "Donation Category Distribution",
        "donation-category-loading",
        "donation-category-chart",
        (analytics) => analytics?.donation.category,
        (data) => makeBarChart(data, "Items", [...palette.donationCategory]),
      ),
    ],
  },
  inventory: [
    panel(
      "Inventory Health Status",
      "inventory-health-loading",
      "inventory-health-chart",
      (analytics) => analytics?.inventory.health,
      (data) => makeDoughnutChart(data, [...palette.inventoryHealth]),
    ),
    panel(
      "Stock by Category",
      "inventory-category-loading",
      "inventory-category-chart",
      (analytics) => analytics?.inventory.category,
      (data) => makeBarChart(data, "Stock", palette.inventoryCategory),
    ),
  ],
  package: {
    primary: [
      panel(
        "Aid Package Distribution Trend",
        "package-trend-loading",
        "package-trend-chart",
        (analytics) => analytics?.package.trend,
        (data) =>
          makeLineChart(
            data,
            "Packages",
            palette.packageTrend.line,
            palette.packageTrend.fill,
          ),
      ),
      panel(
        "Redemption Code Status",
        "redemption-status-loading",
        "redemption-status-chart",
        (analytics) => analytics?.package.redemption,
        (data) => makeDoughnutChart(data, [...palette.status]),
      ),
    ],
    packageType: panel(
      "Package Type Distribution",
      "package-type-loading",
      "package-type-chart",
      (analytics) => analytics?.package.packageType,
      (data) => makePieChart(data, [...palette.packageType]),
    ),
  },
  expiry: [
    panel(
      "Lot Expiry Distribution",
      "expiry-distribution-loading",
      "expiry-distribution-chart",
      (analytics) => analytics?.expiry.distribution,
      (data) => makeDoughnutChart(data, [...palette.expiryDistribution]),
    ),
    panel(
      "Food Wastage Trend",
      "wastage-trend-loading",
      "wastage-trend-chart",
      (analytics) => analytics?.expiry.wastage,
      (data) => makeBarChart(data, wastageLabel(data), palette.wastage),
    ),
  ],
  redemption: [
    panel(
      "Redemption Rate Trend",
      "redemption-rate-loading",
      "redemption-rate-chart",
      (analytics) => analytics?.redemption.rateTrend,
      (data) =>
        makeLineChart(
          data,
          "Redemption Rate (%)",
          palette.redemptionRate.line,
          palette.redemptionRate.fill,
          { min: 0, max: 100 },
        ),
    ),
    panel(
      "Verification Outcome Breakdown",
      "verification-breakdown-loading",
      "verification-breakdown-chart",
      (analytics) => analytics?.redemption.breakdown,
      (data) => makeDoughnutChart(data, [...palette.status]),
    ),
  ],
} as const;

const makeDonationView = (analytics?: DashboardAnalyticsResponse | null) => ({
  primaryPanels: buildPanels(analytics, PANELS.donation.primary),
  secondaryPanels: buildPanels(analytics, PANELS.donation.secondary),
  averageDonationCard: pickCard(
    analytics?.donation.averageValue,
    DEFAULT_CARDS.averageDonation,
  ),
});

const makeInventoryView = (analytics?: DashboardAnalyticsResponse | null) => ({
  panels: buildPanels(analytics, PANELS.inventory),
});

const makePackageView = (analytics?: DashboardAnalyticsResponse | null) => ({
  primaryPanels: buildPanels(analytics, PANELS.package.primary),
  packageTypePanel: buildPanel(analytics, PANELS.package.packageType),
  averageSupportCard: pickCard(
    analytics?.package.averageSupportDuration,
    DEFAULT_CARDS.averageSupport,
  ),
  itemsPerPackageCard: pickCard(
    analytics?.package.itemsPerPackage,
    DEFAULT_CARDS.itemsPerPackage,
  ),
});

const makeExpiryView = (analytics?: DashboardAnalyticsResponse | null) => ({
  panels: buildPanels(analytics, PANELS.expiry),
  expiringLots: analytics?.expiry.expiringLots ?? [],
});

const makeRedemptionView = (analytics?: DashboardAnalyticsResponse | null) => ({
  panels: buildPanels(analytics, PANELS.redemption),
  recentVerificationRecords:
    analytics?.redemption.recentVerificationRecords ?? [],
});

export function useAdminStatisticsPageModel(): AdminStatisticsPageModel {
  const pageMeta = getPageMeta("statistics");
  const {
    range,
    setRange,
    analytics,
    isLoading,
    loadError,
    setLoadError,
    refreshDashboard,
    rangeSummary,
  } = useAdminDashboardData();

  const {
    primaryPanels: donationPrimaryPanels,
    secondaryPanels: donationSecondaryPanels,
    averageDonationCard,
  } = makeDonationView(analytics);
  const { panels: inventoryPanels } = makeInventoryView(analytics);
  const {
    primaryPanels: packagePrimaryPanels,
    packageTypePanel,
    averageSupportCard,
    itemsPerPackageCard,
  } = makePackageView(analytics);
  const { panels: expiryPanels, expiringLots } = makeExpiryView(analytics);
  const { panels: redemptionPanels, recentVerificationRecords } =
    makeRedemptionView(analytics);

  return {
    pageMeta,
    loadError,
    clearLoadError: () => setLoadError(""),
    kpiSectionProps: {
      range,
      setRange,
      isLoading,
      refreshDashboard,
      rangeSummary,
      analytics,
    },
    donationSectionProps: {
      primaryPanels: donationPrimaryPanels,
      secondaryPanels: donationSecondaryPanels,
      averageDonationCard,
      isLoading,
    },
    inventorySectionProps: {
      panels: inventoryPanels,
      isLoading,
    },
    distributionSectionProps: {
      primaryPanels: packagePrimaryPanels,
      packageTypePanel,
      averageSupportCard,
      itemsPerPackageCard,
      isLoading,
    },
    wasteSectionProps: {
      panels: expiryPanels,
      expiringLots,
      isLoading,
    },
    verificationSectionProps: {
      panels: redemptionPanels,
      verificationRows: recentVerificationRecords,
      isLoading,
    },
  };
}
