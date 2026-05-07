import { useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import AdminFeedbackBanner from "@/features/admin/components/AdminFeedbackBanner";
import adminStyles from "./admin.module.css";
import {
  AdminFilterToolbar,
  TableSearchInput,
  renderToolbarAction,
  renderToolbarFilters,
  type TableSearchConfig,
  type ToolbarButtonConfig,
  type ToolbarFilterConfig,
} from "./sectionBits.filters";
type SummaryCardProps = {
  title: string;
  description?: ReactNode;
  details?: ReactNode;
  note?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "warning";
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "title" | "className">;
export function AdminSummaryCard({
  title,
  description,
  details,
  note,
  meta,
  actions,
  tone = "default",
  children,
  ...props
}: SummaryCardProps) {
  return (
    <div
      className={cn(
        adminStyles.card,
        adminStyles["admin-summary-card"],
        tone === "warning" && adminStyles["card-error"],
      )}
      {...props}
    >
      <div className={adminStyles["admin-summary-card-title"]}>{title}</div>
      {description ? (
        <p className={adminStyles["admin-summary-card-description"]}>
          {description}
        </p>
      ) : null}
      {details}
      {children}
      {meta}
      {note}
      {actions}
    </div>
  );
}
export const AdminSummaryCardDetails = ({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) => (
  <div className={adminStyles["admin-summary-card-details"]}>
    {rows.map((row) => (
      <p key={row.label}>
        <strong>{row.label}:</strong>
        {row.value}
      </p>
    ))}
  </div>
);

export function AdminSectionFeedback({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error" | "info";
  message: string;
  onClose?: () => void;
}) {
  return <AdminFeedbackBanner tone={tone} message={message} onClose={onClose} />;
}

function AdminEmptyStateCard({
  title,
  description,
  tone = "default",
}: {
  title: string;
  description?: string | null;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={cn(
        adminStyles.card,
        adminStyles["admin-empty-state-card"],
        tone === "warning" && adminStyles["admin-empty-state-card--warning"],
      )}
    >
      <h3 className={adminStyles["admin-empty-state-title"]}>{title}</h3>
      {description ? (
        <p className={adminStyles["admin-empty-state-description"]}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
type PaginationProps = {
  id: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};
type SelectionBatchBarProps = {
  selectAllId: string;
  countId: string;
  allSelected: boolean;
  disabled: boolean;
  selectedCount: number;
  onToggleAll: () => void;
  children: ReactNode;
};
// Large admin tables only show a compact window around the current page so the
// footer stays dense even when result counts grow substantially.
function buildCompactPaginationTokens(
  currentPage: number,
  totalPages: number,
): Array<number | string> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage]);
  for (let offset = -1; offset <= 1; offset += 1) {
    const page = currentPage + offset;
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }
  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  return sortedPages.flatMap((page, index) =>
    sortedPages[index - 1] && page - sortedPages[index - 1] > 1
      ? [`ellipsis-${sortedPages[index - 1]}-${page}`, page]
      : [page],
  );
}
function AdminTablePagination({
  id,
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const tokens = useMemo(
    () => buildCompactPaginationTokens(page, totalPages),
    [page, totalPages],
  );
  return (
    <div className={adminStyles.pagination} id={id}>
      <button
        type="button"
        className={cn(adminStyles["page-btn"], adminStyles["page-nav"])}
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <span>&#8249;</span>
        <span>Previous</span>
      </button>
      <div className={adminStyles["pagination-pages"]}>
        {tokens.map((token) =>
          typeof token === "number" ? (
            <button
              key={`${id}-${token}`}
              type="button"
              className={cn(
                adminStyles["page-btn"],
                adminStyles["page-num"],
                page === token && adminStyles.active,
              )}
              onClick={() => onPageChange(token)}
            >
              {token}
            </button>
          ) : (
            <span
              key={`${id}-${token}`}
              className={cn(
                adminStyles["page-btn"],
                adminStyles["page-ellipsis"],
              )}
              aria-hidden="true"
            >
              {" "}
              ...
            </span>
          ),
        )}
      </div>
      <button
        type="button"
        className={cn(adminStyles["page-btn"], adminStyles["page-nav"])}
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        <span>Next</span>
        <span>&#8250;</span>
      </button>
    </div>
  );
}
export function SelectionBatchBar({
  selectAllId,
  countId,
  allSelected,
  disabled,
  selectedCount,
  onToggleAll,
  children,
}: SelectionBatchBarProps) {
  return (
    <div className={adminStyles["batch-actions"]}>
      <div className={adminStyles["batch-left"]}>
        <input
          id={selectAllId}
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          disabled={disabled}
        />
        <label
          htmlFor={selectAllId}
          className={adminStyles["batch-select-label"]}
        >
          {" "}
          Select All
        </label>
        <span id={countId} className={adminStyles["batch-select-count"]}>
          {selectedCount} selected
        </span>
      </div>
      <div className={adminStyles["batch-right"]}>{children}</div>
    </div>
  );
}
type SectionShellProps = {
  errorMessage?: string;
  toolbar?: ReactNode;
  title: string;
  search?: TableSearchConfig;
  children: ReactNode;
};
const renderTableSearch = (search?: TableSearchConfig) =>
  search ? <TableSearchInput {...search} /> : undefined;
function AdminSectionShell({
  errorMessage = "",
  toolbar,
  title,
  search,
  children,
}: SectionShellProps) {
  return (
    <div className={adminStyles["fade-in"]}>
      {errorMessage ? (
        <AdminSectionFeedback tone="error" message={errorMessage} />
      ) : null}
      {toolbar}
      <div className={adminStyles["record-header"]}>
        <div className={adminStyles["record-title"]}>{title}</div>
      </div>
      {renderTableSearch(search)}
      {children}
    </div>
  );
}
type AdminTableSectionProps = {
  errorMessage?: string;
  toolbar?: ReactNode;
  title: string;
  search?: TableSearchConfig;
  header: ReactNode;
  batchActions?: ReactNode;
  body: ReactNode;
  paginationId: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};
export function AdminTableSection({
  errorMessage = "",
  toolbar,
  title,
  search,
  header,
  batchActions,
  body,
  paginationId,
  page,
  totalPages,
  onPageChange,
}: AdminTableSectionProps) {
  // Split header and body shells keep the column headings visible while the
  // scrollable table body can grow independently inside the section card.
  return (
    <AdminSectionShell
      errorMessage={errorMessage}
      toolbar={toolbar}
      title={title}
      search={search}
    >
      <div className={adminStyles["table-wrapper"]}>
        <div className={adminStyles["table-header-shell"]}>
          <table className={adminStyles["data-table"]}>
            <thead>{header}</thead>
          </table>
        </div>
        {batchActions}
        <div className={adminStyles["table-body-shell"]}>{body}</div>
        <AdminTablePagination
          id={paginationId}
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>
    </AdminSectionShell>
  );
}
type AdminCardCollectionSectionProps<T> = {
  errorMessage?: string;
  toolbar?: ReactNode;
  title: string;
  search?: TableSearchConfig;
  gridId?: string;
  gridVariant?: "default" | "compact";
  items: T[];
  renderCard: (item: T) => ReactNode;
  emptyState?: ReactNode;
  hideEmptyState?: boolean;
};
type ConfigurableAdminCardSectionProps<T> = {
  errorMessage?: string;
  title: string;
  search?: TableSearchConfig;
  toolbarAction?: ToolbarButtonConfig;
  filters?: ToolbarFilterConfig[];
  gridId?: string;
  gridVariant?: "default" | "compact";
  items: T[];
  renderCard: (item: T) => ReactNode;
  emptyStateTitle: string;
  emptyStateDescription?: string | null;
  emptyStateTone?: "default" | "warning";
  hideEmptyState?: boolean;
};
function AdminCardCollectionSection<T>({
  errorMessage = "",
  toolbar,
  title,
  search,
  gridId,
  gridVariant = "default",
  items,
  renderCard,
  emptyState,
  hideEmptyState = false,
}: AdminCardCollectionSectionProps<T>) {
  return (
    <AdminSectionShell
      errorMessage={errorMessage}
      toolbar={toolbar}
      title={title}
      search={search}
    >
      <div
        className={cn(
          adminStyles["admin-card-grid"],
          gridVariant === "compact" && adminStyles["admin-card-grid--compact"],
        )}
        id={gridId}
      >
        {items.length > 0
          ? items.map(renderCard)
          : hideEmptyState
            ? null
            : emptyState}
      </div>
    </AdminSectionShell>
  );
}
export function ConfigurableAdminCardSection<T>({
  errorMessage = "",
  title,
  search,
  toolbarAction,
  filters,
  gridId,
  gridVariant = "default",
  items,
  renderCard,
  emptyStateTitle,
  emptyStateDescription,
  emptyStateTone = "default",
  hideEmptyState = false,
}: ConfigurableAdminCardSectionProps<T>) {
  return (
    <AdminCardCollectionSection
      errorMessage={errorMessage}
      toolbar={
        <AdminFilterToolbar
          actions={renderToolbarAction(toolbarAction)}
          filters={renderToolbarFilters(filters)}
        />
      }
      title={title}
      search={search}
      gridId={gridId}
      gridVariant={gridVariant}
      items={items}
      renderCard={renderCard}
      hideEmptyState={hideEmptyState}
      emptyState={
        <AdminEmptyStateCard
          title={emptyStateTitle}
          description={emptyStateDescription}
          tone={emptyStateTone}
        />
      }
    />
  );
}

export const AdminPagination = AdminTablePagination;
