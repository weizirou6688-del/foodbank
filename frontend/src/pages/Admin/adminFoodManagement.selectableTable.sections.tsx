import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { AdminActionGroup, AdminButton, type AdminButtonTone } from "./chrome";
import adminStyles from "./admin.module.css";
import {
  AdminFilterToolbar,
  renderToolbarAction,
  renderToolbarFilters,
  TABLE_PAGE_SIZE,
  type ToolbarButtonConfig,
  type ToolbarFilterConfig,
} from "./sectionBits.filters";
import {
  AdminTableSection,
  SelectionBatchBar,
} from "./sectionBits.sections.cards";
type SelectableTableRowMeta = {
  dataAttributes?: Record<string, string | number | undefined>;
};
interface SelectableTableProps<Row, RowId extends string | number> {
  tableId: string;
  bodyId: string;
  rows: Row[];
  selectedRowIds: ReadonlySet<RowId>;
  getRowId: (row: Row) => RowId;
  onToggleRow: (rowId: RowId) => void;
  renderCells: (row: Row) => ReactNode;
  colSpan: number;
  isLoading: boolean;
  loadingMessage: string;
  emptyMessage: string;
  getRowMeta?: (row: Row, isSelected: boolean) => SelectableTableRowMeta;
}
export interface AdminTableRowAction {
  label: string;
  onClick: () => void;
  tone?: AdminButtonTone;
  className?: string;
  disabled?: boolean;
}
export interface TableColumn<Row> {
  header: string;
  renderCell: (row: Row) => ReactNode;
}
interface BatchButtonConfig extends ToolbarButtonConfig {
  busy?: boolean;
  busyLabel?: string;
}
interface ConfigurableSelectableTableSectionProps<
  Row,
  RowId extends string | number,
> {
  title: string;
  errorMessage: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchDisabled?: boolean;
  toolbarAction?: ToolbarButtonConfig;
  filters?: ToolbarFilterConfig[];
  selectAllId: string;
  countId: string;
  rows: Row[];
  selectedRowIds: ReadonlySet<RowId>;
  getRowId: (row: Row) => RowId;
  onToggleRow: (rowId: RowId) => void;
  onToggleAll: (rowIds?: RowId[]) => void;
  batchButtons: BatchButtonConfig[];
  isLoading: boolean;
  loadingMessage: string;
  emptyMessage: string;
  paginationId: string;
  tableId: string;
  bodyId: string;
  paginationKey: string;
  columns: TableColumn<Row>[];
  getRowMeta?: (row: Row) => SelectableTableRowMeta;
}
function usePagination<T>(rows: T[], pageSize: number, resetKey: string) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    // Search and filter changes should bounce back to page one so the user does
    // not land on an empty slice after narrowing the result set.
    setPage(1);
  }, [resetKey]);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, rows],
  );
  return { page, setPage, totalPages, pageRows };
}
function renderBatchLabel(button: BatchButtonConfig) {
  return button.busy ? (button.busyLabel ?? button.label) : button.label;
}
function BatchActionButtons({ buttons }: { buttons: BatchButtonConfig[] }) {
  return (
    <>
      {buttons.map((button) => (
        <AdminButton
          key={button.id ?? button.label}
          id={button.id}
          tone={button.tone}
          size="sm"
          onClick={button.onClick}
          disabled={button.disabled}
        >
          {renderBatchLabel(button)}
        </AdminButton>
      ))}
    </>
  );
}
export function AdminTableActionButtons({
  rowKey,
  actions,
}: {
  rowKey: string | number;
  actions: Array<AdminTableRowAction | false | null | undefined>;
}) {
  const visibleActions = actions.filter(Boolean) as AdminTableRowAction[];
  return (
    <AdminActionGroup>
      {visibleActions.map((action) => (
        <AdminButton
          key={`${rowKey}-${action.label}`}
          tone={action.tone}
          size="sm"
          className={action.className}
          disabled={action.disabled}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
          }}
        >
          {action.label}
        </AdminButton>
      ))}
    </AdminActionGroup>
  );
}
function TableMessageRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={adminStyles["admin-table-message-cell"]}>
        {message}
      </td>
    </tr>
  );
}
function renderTableMessage(
  rows: unknown[],
  isLoading: boolean,
  loadingMessage: string,
  emptyMessage: string,
  colSpan: number,
) {
  if (isLoading && rows.length === 0) {
    return <TableMessageRow colSpan={colSpan} message={loadingMessage} />;
  }
  if (rows.length === 0) {
    return <TableMessageRow colSpan={colSpan} message={emptyMessage} />;
  }
  return null;
}
function SelectableTable<Row, RowId extends string | number>({
  tableId,
  bodyId,
  rows,
  selectedRowIds,
  getRowId,
  onToggleRow,
  renderCells,
  colSpan,
  isLoading,
  loadingMessage,
  emptyMessage,
  getRowMeta,
}: SelectableTableProps<Row, RowId>) {
  const messageRow = renderTableMessage(
    rows,
    isLoading,
    loadingMessage,
    emptyMessage,
    colSpan,
  );
  return (
    <table className={adminStyles["data-table"]} id={tableId}>
      <tbody id={bodyId}>
        {messageRow ??
          rows.map((row) => {
            const rowId = getRowId(row);
            const isSelected = selectedRowIds.has(rowId);
            const rowMeta = getRowMeta?.(row, isSelected);
            return (
              <tr
                key={String(rowId)}
                className={cn(isSelected && adminStyles.selected)}
                onClick={() => onToggleRow(rowId)}
                {...rowMeta?.dataAttributes}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleRow(rowId)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </td>
                {renderCells(row)}
              </tr>
            );
          })}
      </tbody>
    </table>
  );
}
type AdminSelectableTableSectionProps<
  Row,
  RowId extends string | number,
> = Omit<ComponentProps<typeof AdminTableSection>, "body"> &
  SelectableTableProps<Row, RowId>;
function SelectableTableHeader({
  columns,
}: {
  columns: Array<{ header: string }>;
}) {
  return (
    <tr>
      <th className={adminStyles["table-checkbox-col"]} />
      {columns.map((column) => (
        <th key={column.header}>{column.header}</th>
      ))}
    </tr>
  );
}
function SelectableTableCells<Row, RowId extends string | number>({
  row,
  rowId,
  columns,
}: {
  row: Row;
  rowId: RowId;
  columns: ConfigurableSelectableTableSectionProps<Row, RowId>["columns"];
}) {
  return (
    <>
      {columns.map((column) => (
        <td key={`${String(rowId)}-${column.header}`}>
          {column.renderCell(row)}
        </td>
      ))}
    </>
  );
}
function AdminSelectableTableSection<Row, RowId extends string | number>({
  errorMessage,
  toolbar,
  title,
  search,
  header,
  batchActions,
  paginationId,
  page,
  totalPages,
  onPageChange,
  ...tableProps
}: AdminSelectableTableSectionProps<Row, RowId>) {
  return (
    <AdminTableSection
      errorMessage={errorMessage}
      toolbar={toolbar}
      title={title}
      search={search}
      header={header}
      batchActions={batchActions}
      body={<SelectableTable {...tableProps} />}
      paginationId={paginationId}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
}
export function AdminSelectableTableSectionShell<
  Row,
  RowId extends string | number,
>({
  title,
  errorMessage,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchDisabled = false,
  toolbarAction,
  filters,
  selectAllId,
  countId,
  rows,
  selectedRowIds,
  getRowId,
  onToggleRow,
  onToggleAll,
  batchButtons,
  isLoading,
  loadingMessage,
  emptyMessage,
  paginationId,
  tableId,
  bodyId,
  paginationKey,
  columns,
  getRowMeta,
}: ConfigurableSelectableTableSectionProps<Row, RowId>) {
  const { page, setPage, totalPages, pageRows } = usePagination(
    rows,
    TABLE_PAGE_SIZE,
    paginationKey,
  );
  const pageRowIds = pageRows.map(getRowId);
  // "Select all" is intentionally scoped to the visible page, while the badge
  // still reports the full cross-page selection stored by the parent view.
  const allSelected =
    pageRowIds.length > 0 &&
    pageRowIds.every((rowId) => selectedRowIds.has(rowId));
  return (
    <AdminSelectableTableSection
      errorMessage={errorMessage}
      toolbar={
        <AdminFilterToolbar
          actions={renderToolbarAction(toolbarAction)}
          filters={renderToolbarFilters(filters)}
        />
      }
      title={title}
      search={{
        value: searchValue,
        onChange: onSearchChange,
        placeholder: searchPlaceholder,
        disabled: searchDisabled,
      }}
      header={<SelectableTableHeader columns={columns} />}
      batchActions={
        <SelectionBatchBar
          selectAllId={selectAllId}
          countId={countId}
          allSelected={allSelected}
          disabled={pageRowIds.length === 0}
          selectedCount={selectedRowIds.size}
          onToggleAll={() => onToggleAll(pageRowIds)}
        >
          <BatchActionButtons buttons={batchButtons} />
        </SelectionBatchBar>
      }
      paginationId={paginationId}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      tableId={tableId}
      bodyId={bodyId}
      rows={pageRows}
      selectedRowIds={selectedRowIds}
      getRowId={getRowId}
      onToggleRow={onToggleRow}
      colSpan={columns.length + 1}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      emptyMessage={emptyMessage}
      getRowMeta={getRowMeta}
      renderCells={(row) => (
        <SelectableTableCells
          row={row}
          rowId={getRowId(row)}
          columns={columns}
        />
      )}
    />
  );
}

export const ConfigurableSelectableTableSection = AdminSelectableTableSectionShell;
