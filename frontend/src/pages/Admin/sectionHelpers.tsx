import { cn } from "@/shared/lib/cn";
import { type AdminButtonTone } from "./chrome";
import adminStyles from "./admin.module.css";
import type { AdminTableRowAction } from "./adminFoodManagement.selectableTable.sections";
type RowActionConfig<Row> = {
  label: string;
  tone?: AdminButtonTone;
  className?: string;
  onClick: (row: Row) => void;
};
export type RowActionSet<Row> = {
  when?: (row: Row) => boolean;
  actions: RowActionConfig<Row>[];
};
export const DONATION_FILTER_DONOR_TYPE_OPTIONS = [
  { value: "supermarket", label: "Supermarket" },
  { value: "individual", label: "Individual" },
  { value: "organization", label: "Organization" },
];
export const DONATION_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "fulfilled", label: "Received / Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];
export const getStatusToneClasses = (tone?: string) =>
  cn(
    adminStyles["status-tone"],
    tone === "success"
      ? adminStyles["status-tone--success"]
      : tone === "warning"
        ? adminStyles["status-tone--warning"]
        : tone === "error"
          ? adminStyles["status-tone--error"]
          : tone === "active"
            ? adminStyles["status-tone--active"]
            : tone === "muted" || !tone
              ? adminStyles["status-tone--muted"]
              : adminStyles["status-tone--muted"],
  );
export const renderStatusDetail = (label: string, tone?: string) => (
  <span className={getStatusToneClasses(tone)}>{label}</span>
);
export const countSelectedRows = <Row extends { id: string }>(
  rows: Row[],
  selectedIds: ReadonlySet<string>,
  isMatch: (row: Row) => boolean = () => true,
) => rows.filter((row) => selectedIds.has(row.id) && isMatch(row)).length;
// Only the first matching action set is used so row states stay deterministic
// even when multiple conditions could theoretically apply.
export const buildRowActions = <Row,>(
  row: Row,
  actionSets: RowActionSet<Row>[],
): AdminTableRowAction[] =>
  (actionSets.find(({ when }) => !when || when(row))?.actions ?? []).map(
    (action) => ({
      label: action.label,
      tone: action.tone,
      className: action.className,
      onClick: () => action.onClick(row),
    }),
  );
