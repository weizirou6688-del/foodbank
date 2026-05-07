import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { AdminButton, type AdminButtonTone } from "./chrome";
import type { FoodBankOption } from "./adminFoodManagement.data.shared";
import adminStyles from "./admin.module.css";
export interface FilterOption {
  value: string;
  label: string;
}
// Deduplicate and sort once at the boundary so filter dropdowns stay stable
// across refreshes and independently authored admin sections.
export const buildFilterOptions = (values: Iterable<string>) =>
  Array.from(new Set(values))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value, label: value }));
export interface TableSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}
export interface ToolbarButtonConfig {
  id?: string;
  label: string;
  tone?: AdminButtonTone;
  disabled?: boolean;
  onClick: () => void;
}
export type ToolbarFilterConfig =
  | {
      type: "select";
      key?: string;
      id?: string;
      value: string;
      options: FilterOption[];
      placeholder: string;
      emptyValue?: string;
      onChange: (value: string) => void;
      disabled?: boolean;
    }
  | {
      type: "food-bank";
      key?: string;
      id: string;
      foodBankOptions?: FoodBankOption[];
      selectedFoodBankId?: number | null;
      onFoodBankChange?: (foodBankId: number | null) => void;
    };
export const TABLE_PAGE_SIZE = 5;
type FilterSelectProps = {
  id?: string;
  value: string;
  options: FilterOption[];
  placeholder: string;
  emptyValue?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};
type FoodBankFilterProps = {
  id: string;
  foodBankOptions?: FoodBankOption[];
  selectedFoodBankId?: number | null;
  onFoodBankChange?: (foodBankId: number | null) => void;
};
function FilterSelect({
  id,
  value,
  options,
  placeholder,
  emptyValue = "",
  onChange,
  disabled = false,
}: FilterSelectProps) {
  return (
    <select
      className={adminStyles["filter-select"]}
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      <option value={emptyValue}>{placeholder}</option>
      {options.map((option) => (
        <option key={`${id ?? "filter"}-${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
function FoodBankFilterSelect({
  id,
  foodBankOptions,
  selectedFoodBankId,
  onFoodBankChange,
}: FoodBankFilterProps) {
  if (!foodBankOptions) {
    return null;
  }
  return (
    <FilterSelect
      id={id}
      value={selectedFoodBankId == null ? "" : String(selectedFoodBankId)}
      options={foodBankOptions.map((foodBank) => ({
        value: String(foodBank.id),
        label: foodBank.name,
      }))}
      placeholder={
        foodBankOptions.length > 0
          ? "Choose a food bank"
          : "No food banks available"
      }
      onChange={(value) => onFoodBankChange?.(value ? Number(value) : null)}
      disabled={foodBankOptions.length === 0}
    />
  );
}
function ToolbarFilterControl({
  filter,
}: {
  filter: ToolbarFilterConfig;
}): ReactNode {
  return filter.type === "food-bank" ? (
    <FoodBankFilterSelect
      id={filter.id}
      foodBankOptions={filter.foodBankOptions}
      selectedFoodBankId={filter.selectedFoodBankId}
      onFoodBankChange={filter.onFoodBankChange}
    />
  ) : (
    <FilterSelect
      id={filter.id}
      value={filter.value}
      options={filter.options}
      placeholder={filter.placeholder}
      emptyValue={filter.emptyValue}
      onChange={filter.onChange}
      disabled={filter.disabled}
    />
  );
}
// Stable keys prevent controlled selects from remounting whenever their current
// value changes as a result of search, scope, or server refreshes.
const getToolbarFilterKey = (filter: ToolbarFilterConfig) =>
  filter.type === "food-bank"
    ? (filter.key ?? filter.id)
    : (filter.key ?? filter.id ?? `${filter.placeholder}-${filter.value}`);
export function TableSearchInput({
  value,
  onChange,
  placeholder,
  disabled = false,
}: TableSearchConfig) {
  return (
    <div className={adminStyles["table-search-wrapper"]}>
      <Search className={adminStyles["table-search-icon"]} aria-hidden="true" />
      <input
        type="text"
        className={adminStyles["table-search-input"]}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
export const renderToolbarAction = (action?: ToolbarButtonConfig) =>
  action ? (
    <AdminButton
      id={action.id}
      tone={action.tone}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </AdminButton>
  ) : undefined;
export const renderToolbarFilters = (filters?: ToolbarFilterConfig[]) =>
  filters?.length ? (
    <>
      {filters.map((filter) => (
        <ToolbarFilterControl
          key={getToolbarFilterKey(filter)}
          filter={filter}
        />
      ))}
    </>
  ) : undefined;
export function AdminFilterToolbar({
  actions,
  filters,
  filterAlign = "end",
}: {
  actions?: ReactNode;
  filters?: ReactNode;
  filterAlign?: "start" | "end";
}) {
  if (!actions && !filters) {
    return null;
  }
  return (
    <div className={adminStyles["section-actions"]}>
      {actions}
      {filters ? (
        <div
          className={cn(
            adminStyles["admin-toolbar-group"],
            filterAlign === "end" && adminStyles["admin-toolbar-group--end"],
          )}
        >
          {filters}
        </div>
      ) : null}
    </div>
  );
}
