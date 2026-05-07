export type MockPublicImpactMetric = {
  key: string;
  change: string;
  value: string;
  label: string;
  note: string;
  positive: boolean;
};

export const DEFAULT_PUBLIC_IMPACT_METRICS: MockPublicImpactMetric[] = [
  {
    key: "units",
    change: "+6.4%",
    value: "4,860",
    label: "Network Food Units Distributed",
    note: "Platform Total",
    positive: true,
  },
  {
    key: "households",
    change: "+24 households",
    value: "410",
    label: "Households Supported Across the Network",
    note: "Platform Total",
    positive: true,
  },
  {
    key: "pickups",
    change: "+9 pickups",
    value: "96",
    label: "Completed Food Pickups Across the Network",
    note: "This Month",
    positive: true,
  },
  {
    key: "goods",
    change: "+7.5%",
    value: "2,140",
    label: "Goods Donation Units Coordinated",
    note: "This Year",
    positive: true,
  },
];

export function clonePublicImpactMetrics(
  metrics: MockPublicImpactMetric[] = DEFAULT_PUBLIC_IMPACT_METRICS,
): MockPublicImpactMetric[] {
  return metrics.map((metric) => ({ ...metric }));
}
