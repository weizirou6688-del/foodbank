import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/app/store/authStore";
import { adminAPI } from "@/shared/lib/api/admin";
import type { DashboardAnalyticsResponse } from "@/shared/lib/api/stats";
export type DashboardRange = "month" | "quarter" | "year";
export const rangeOptions: Array<{ value: DashboardRange; label: string }> = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];
export const rangeLabels: Record<DashboardRange, string> = {
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
};
export const trendGroupingCopy: Record<DashboardRange, string> = {
  month: "Trend charts are grouped by day within the current month.",
  quarter: "Trend charts are grouped by month within the selected range.",
  year: "Trend charts are grouped by month within the selected range.",
};
export const loadingKpiCount = 5;
export const chartPalette = {
  donationSource: ["#FFB703", "#FB8500", "#1976D2", "#7B1FA2"],
  donationTrend: { line: "#FFB703", fill: "rgba(255, 183, 3, 0.1)" },
  donationCategory: ["#FFB703", "#FB8500", "#1976D2", "#7B1FA2", "#2E7D32"],
  inventoryHealth: ["#2E7D32", "#F57C00", "#D32F2F"],
  inventoryCategory: "#1976D2",
  packageTrend: { line: "#1976D2", fill: "rgba(25, 118, 210, 0.1)" },
  status: ["#2E7D32", "#F57C00", "#D32F2F"],
  packageType: ["#FFB703", "#FB8500", "#1976D2"],
  expiryDistribution: ["#D32F2F", "#F57C00", "#2E7D32"],
  wastage: "#D32F2F",
  redemptionRate: { line: "#2E7D32", fill: "rgba(46, 125, 50, 0.1)" },
} as const;
type RangeBounds = { start: Date; end: Date };
const RANGE_BOUNDS: Record<DashboardRange, (today: Date) => RangeBounds> = {
  month: (today) => ({
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: today,
  }),
  quarter: (today) => ({
    start: new Date(
      today.getFullYear(),
      Math.floor(today.getMonth() / 3) * 3,
      1,
    ),
    end: today,
  }),
  year: (today) => ({ start: new Date(today.getFullYear(), 0, 1), end: today }),
};
const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());
const getRangeBounds = (range: DashboardRange) =>
  RANGE_BOUNDS[range](startOfDay(new Date()));
const formatSummaryDate = (value: Date) =>
  value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
function buildRangeSummary(range: DashboardRange) {
  const bounds = getRangeBounds(range);
  const quarterNote =
    range === "quarter" &&
    getRangeBounds("month").start.getTime() === bounds.start.getTime()
      ? "The current calendar quarter started this month, so month and quarter can match early in the quarter."
      : "";
  return [
    `Live range: ${formatSummaryDate(bounds.start)} to ${formatSummaryDate(bounds.end)}.`,
    quarterNote,
    trendGroupingCopy[range],
  ]
    .filter(Boolean)
    .join(" ");
}
export function useAdminDashboardData() {
  const accessToken = useAuthStore((state) => state.accessToken);
  // Monotonic request ids stop slower refreshes from overwriting a newer range
  // selection when admins switch filters in quick succession.
  const requestIdRef = useRef(0);
  const [range, setRange] = useState<DashboardRange>("month");
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const refreshDashboard = useCallback(
    async (nextRange = range) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (!accessToken) {
        setAnalytics(null);
        setLoadError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");
      try {
        const nextAnalytics = await adminAPI.getDashboardAnalytics(
          accessToken,
          nextRange,
          requestId,
        );

        if (requestIdRef.current !== requestId) {
          // Ignore late responses from superseded requests instead of flashing
          // stale charts for the previously selected range.
          return;
        }

        setAnalytics(nextAnalytics);
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard analytics.",
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [accessToken, range],
  );
  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);
  return {
    range,
    setRange,
    analytics,
    isLoading,
    loadError,
    setLoadError,
    refreshDashboard,
    rangeSummary: buildRangeSummary(range),
  };
}
