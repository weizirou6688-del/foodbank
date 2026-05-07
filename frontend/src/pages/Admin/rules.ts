import type { AdminApplicationRecord } from "@/shared/lib/api/applications";
import type { DonationListRow } from "@/shared/types/donations";
import {
  buildDonationDisplayId,
  buildDonationTotalLabel,
  donationStatusLabel,
  donorTypeLabelMap,
  formatUkDate,
  getCodeStatusMeta,
  inferDonationDonorType,
} from "./formatting";
import type {
  DonationDonorType,
  DonationStatusFilter,
  PackageRow,
} from "./adminFoodManagement.types";
import type {
  CancelGuard,
  StateSetter,
} from "./adminFoodManagement.data.shared";
interface ManagedRequestOptions<Result> {
  request: () => Promise<Result>;
  fallbackMessage: string;
  setLoading?: StateSetter<boolean>;
  setError?: StateSetter<string>;
  onSuccess?: (result: Result) => void;
  onError?: (message: string) => void;
  isCancelled?: CancelGuard;
  rethrow?: boolean;
}
const runIfActive = (isCancelled: CancelGuard | undefined, action: () => void) => {
  if (!isCancelled?.()) {
    action();
  }
};
export const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
export const captureRequestError = async (
  request: () => Promise<unknown>,
  fallbackMessage: string,
) => {
  try {
    await request();
    return "";
  } catch (error) {
    return toErrorMessage(error, fallbackMessage);
  }
};
export const runManagedRequest = async <Result>({
  request,
  fallbackMessage,
  setLoading,
  setError,
  onSuccess,
  onError,
  isCancelled,
  rethrow = false,
}: ManagedRequestOptions<Result>) => {
  // Keep async state updates on one guarded path so late responses do not write
  // loading or error state back into views that have already unmounted.
  runIfActive(isCancelled, () => {
    setLoading?.(true);
    setError?.("");
  });
  try {
    const result = await request();
    runIfActive(isCancelled, () => onSuccess?.(result));
    return "";
  } catch (error) {
    const message = toErrorMessage(error, fallbackMessage);
    runIfActive(isCancelled, () => {
      setError?.(message);
      onError?.(message);
    });
    if (rethrow) {
      throw error;
    }
    return message;
  } finally {
    runIfActive(isCancelled, () => setLoading?.(false));
  }
};
export const extractApplications = (
  data: unknown,
): AdminApplicationRecord[] => {
  if (Array.isArray(data)) {
    return data as AdminApplicationRecord[];
  }
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown[] }).items)
  ) {
    return (data as { items: AdminApplicationRecord[] }).items;
  }
  return [];
};
type SearchFragment = string | number | null | undefined;
export const normalizeSearch = (value: string) => value.trim().toLowerCase();
export const matchesSearch = (needle: string, ...values: SearchFragment[]) =>
  !needle || values.join(" ").toLowerCase().includes(needle);
const toTimestamp = (value?: string | null) => {
  const timestamp = Date.parse(value ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
export const findPackagesReferencingItem = (
  packageRows: PackageRow[],
  itemId: number,
  itemName: string,
) => {
  const normalizedItemName = itemName.trim().toLowerCase();
  // Package snapshots can survive inventory renames, so match on both the
  // canonical item id and the normalized display name before allowing deletion.
  return packageRows
    .filter((pkg) =>
      pkg.contents.some((content) => {
        const normalizedContentName = content.name.trim().toLowerCase();
        return (
          content.itemId === itemId ||
          normalizedContentName === normalizedItemName
        );
      }),
    )
    .map((pkg) => pkg.name);
};
type ApplicationStatusFilter = "pending" | "redeemed" | "expired" | "void";
const getApplicationStatusValue = (
  record: AdminApplicationRecord,
): ApplicationStatusFilter => {
  if (record.is_voided) {
    return "void";
  }
  if (record.status === "collected") {
    return "redeemed";
  }
  if (record.status === "expired") {
    return "expired";
  }
  return "pending";
};
export const sortApplications = (rows: AdminApplicationRecord[]) =>
  [...rows].sort(
    (left, right) =>
      toTimestamp(right.created_at) - toTimestamp(left.created_at),
  );
export const getApplicationStatusLabel = (record: AdminApplicationRecord) =>
  getCodeStatusMeta(record).label;
export const getApplicationStatusTone = (record: AdminApplicationRecord) => {
  switch (getApplicationStatusValue(record)) {
    case "redeemed":
      return "success";
    case "expired":
      return "warning";
    case "void":
      return "error";
    default:
      return "muted";
  }
};
export const getApplicationPackageLabel = (record: AdminApplicationRecord) => {
  if (record.package_name?.trim()) {
    return record.package_name.trim();
  }
  if (record.items.length === 0) {
    return "Package unavailable";
  }
  if (record.items.length === 1) {
    return record.items[0].name;
  }
  return `${record.items[0].name} +${record.items.length - 1} more`;
};
export const canVoidApplication = (record: AdminApplicationRecord) =>
  !record.is_voided && record.status === "pending";
export const canRedeemApplication = (record: AdminApplicationRecord) =>
  !record.is_voided && record.status === "pending";
export const filterApplications = (
  applications: AdminApplicationRecord[],
  search: string,
) => {
  const needle = normalizeSearch(search);
  return applications.filter((record) =>
    matchesSearch(
      needle,
      record.redemption_code,
      getApplicationPackageLabel(record),
      getApplicationStatusLabel(record),
      formatUkDate(record.created_at),
      formatUkDate(record.redeemed_at),
      ...record.items.map((item) => item.name),
    ),
  );
};
export const sortDonations = (rows: DonationListRow[]) =>
  [...rows].sort(
    (left, right) =>
      toTimestamp(right.pickup_date ?? right.created_at) -
      toTimestamp(left.pickup_date ?? left.created_at),
  );
export const getDonationDonorType = (row: DonationListRow): DonationDonorType =>
  inferDonationDonorType(row);
export const getDonationDonorTypeLabel = (row: DonationListRow) =>
  donorTypeLabelMap[getDonationDonorType(row)];
export const getDonationDateLabel = (row: DonationListRow) =>
  formatUkDate(row.pickup_date || row.created_at);
export const getDonationStatusLabel = (row: DonationListRow) =>
  donationStatusLabel(row.status);
export const isPendingGoodsDonation = (row: DonationListRow) =>
  row.donation_type === "goods" && row.status === "pending";
export const canEditDonation = (row: DonationListRow) =>
  row.donation_type === "goods" && !isPendingGoodsDonation(row);
export const buildDonationDetailsRows = (row: DonationListRow) => {
  if (row.donation_type === "cash") {
    return [
      {
        name:
          row.donation_frequency === "monthly"
            ? "Monthly Cash Donation"
            : "One-Time Cash Donation",
        quantityLabel: buildDonationTotalLabel(row),
        expiryLabel: "-",
      },
    ];
  }
  return (row.items ?? []).map((item) => ({
    name: item.item_name,
    quantityLabel: String(item.quantity),
    expiryLabel: formatUkDate(item.expiry_date),
  }));
};
export const filterDonations = (
  donations: DonationListRow[],
  search: string,
  donorTypeFilter: DonationDonorType | "all",
  statusFilter: DonationStatusFilter,
) => {
  const needle = normalizeSearch(search);
  return donations.filter((row) => {
    if (
      donorTypeFilter !== "all" &&
      getDonationDonorType(row) !== donorTypeFilter
    ) {
      return false;
    }
    const status = row.status ?? "pending";
    // Cash and goods donations share one filter bar, so translate backend
    // status variants into the UI buckets expected by the admin table.
    const matchesStatusFilter =
      statusFilter === "all"
        ? true
        : statusFilter === "fulfilled"
          ? status === "received" || status === "completed"
          : status === statusFilter;
    if (!matchesStatusFilter) {
      return false;
    }
    return matchesSearch(
      needle,
      buildDonationDisplayId(row),
      getDonationDonorTypeLabel(row),
      row.donor_name,
      row.donor_email,
      row.donor_phone,
      getDonationDateLabel(row),
      getDonationStatusLabel(row),
      buildDonationTotalLabel(row),
      row.donation_frequency === "monthly" ? "monthly" : "one-time",
      row.subscription_reference,
      ...(row.items ?? []).map((item) => item.item_name),
    );
  });
};
