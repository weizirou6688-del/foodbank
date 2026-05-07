import type { Dispatch, SetStateAction } from "react";
import type { FoodPackageDetailRecord } from "@/shared/lib/api/packages";
import type { AdminScopeMeta } from "@/shared/lib/adminScope";
export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type CancelGuard = () => boolean;
export type FoodBankOption = { id: number; name: string };
export interface UseAdminFoodManagementDataArgs {
  adminScope: AdminScopeMeta;
  selectedFoodBankId: number | null;
}
export interface AuthorizedLoadConfig<Result> {
  request: (token: string) => Promise<Result>;
  setLoading?: StateSetter<boolean>;
  setError?: StateSetter<string>;
  fallbackMessage: string;
  onSuccess?: (result: Result) => void;
  onError?: (message: string) => void;
}
export const extractFoodBanks = (
  response: { items?: FoodBankOption[] } | null | undefined,
) => (Array.isArray(response?.items) ? response.items : []);
export const sortNamedRows = <Row extends { name: string }>(rows: Row[]) =>
  [...rows].sort((left, right) => left.name.localeCompare(right.name));
export const mergePackageDetailsById = (
  current: Record<number, FoodPackageDetailRecord>,
  details: FoodPackageDetailRecord[],
) => {
  // Cache details opportunistically from both list and detail requests so the
  // package editor can reopen without an extra fetch when nothing changed.
  const next = { ...current };
  for (const detail of details) {
    next[detail.id] = detail;
  }
  return next;
};
