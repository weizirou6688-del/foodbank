import type { ComponentProps, ReactNode } from 'react'
import { AdminActionGroup, AdminButton, type AdminButtonTone } from './chrome'
import { cx } from './classNames'
import { usePagination } from './listHelpers'
import { AdminFilterToolbar, AdminTableSection, SelectionBatchBar, TABLE_PAGE_SIZE, renderToolbarAction, renderToolbarFilters, type ToolbarButtonConfig, type ToolbarFilterConfig } from './sectionBits'

interface SelectableTableRowMeta { className?: string; dataAttributes?: Record<string, string | number | undefined> }
interface SelectableTableProps<Row, RowId extends string | number> { tableId: string; bodyId: string; rows: Row[]; selectedRowIds: ReadonlySet<RowId>; getRowId: (row: Row) => RowId; onToggleRow: (rowId: RowId) => void; renderCells: (row: Row) => ReactNode; colSpan: number; isLoading: boolean; loadingMessage: string; emptyMessage: string; getRowMeta?: (row: Row, isSelected: boolean) => SelectableTableRowMeta }
export interface AdminTableRowAction { label: string; onClick: () => void; tone?: AdminButtonTone; className?: string; disabled?: boolean }
export interface TableColumn<Row> { header: string; width?: string; renderCell: (row: Row) => ReactNode }
export interface BatchButtonConfig extends ToolbarButtonConfig { busy?: boolean; busyLabel?: string }
export interface ConfigurableSelectableTableSectionProps<Row, RowId extends string | number> { title: string; errorMessage: string; searchValue: string; onSearchChange: (value: string) => void; searchPlaceholder: string; searchDisabled?: boolean; toolbarAction?: ToolbarButtonConfig; filters?: ToolbarFilterConfig[]; selectAllId: string; countId: string; rows: Row[]; selectedRowIds: ReadonlySet<RowId>; getRowId: (row: Row) => RowId; onToggleRow: (rowId: RowId) => void; onToggleAll: (rowIds?: RowId[]) => void; batchButtons: BatchButtonConfig[]; isLoading: boolean; loadingMessage: string; emptyMessage: string; paginationId: string; tableId: string; bodyId: string; paginationKey: string; columns: TableColumn<Row>[]; getRowMeta?: (row: Row) => { dataAttributes?: Record<string, string | number | undefined> } }

type AdminSelectableTableSectionProps<Row, RowId extends string | number> = Omit<ComponentProps<typeof AdminTableSection>, 'body'> & SelectableTableProps<Row, RowId>

const TableMessageRow = ({ colSpan, message }: { colSpan: number; message: string }) => <tr><td colSpan={colSpan} className="admin-table-message-cell">{message}</td></tr>
const renderTableMessage = (rows: unknown[], isLoading: boolean, loadingMessage: string, emptyMessage: string, colSpan: number) => isLoading && rows.length === 0 ? <TableMessageRow colSpan={colSpan} message={loadingMessage} /> : rows.length === 0 ? <TableMessageRow colSpan={colSpan} message={emptyMessage} /> : null
const renderBatchButtons = (buttons: BatchButtonConfig[]) => buttons.map((button) => <AdminButton key={button.id ?? button.label} id={button.id} tone={button.tone} size="sm" onClick={button.onClick} disabled={button.disabled}>{button.busy ? button.busyLabel ?? button.label : button.label}</AdminButton>)

export function AdminTableActionButtons({ rowKey, actions }: { rowKey: string | number; actions: Array<AdminTableRowAction | false | null | undefined> }) {
  const visibleActions = actions.filter(Boolean) as AdminTableRowAction[]
  return <AdminActionGroup>{visibleActions.map((action) => <AdminButton key={`${rowKey}-${action.label}`} tone={action.tone} size="sm" className={action.className} disabled={action.disabled} onClick={(event) => { event.stopPropagation(); action.onClick() }}>{action.label}</AdminButton>)}</AdminActionGroup>
}

export function SelectableTable<Row, RowId extends string | number>({ tableId, bodyId, rows, selectedRowIds, getRowId, onToggleRow, renderCells, colSpan, isLoading, loadingMessage, emptyMessage, getRowMeta }: SelectableTableProps<Row, RowId>) {
  const messageRow = renderTableMessage(rows, isLoading, loadingMessage, emptyMessage, colSpan)
  return <table className="data-table" id={tableId}><tbody id={bodyId}>{messageRow ?? rows.map((row) => { const rowId = getRowId(row); const isSelected = selectedRowIds.has(rowId); const rowMeta = getRowMeta?.(row, isSelected); return <tr key={String(rowId)} className={cx(isSelected && 'selected', rowMeta?.className)} onClick={() => onToggleRow(rowId)} {...rowMeta?.dataAttributes}><td><input type="checkbox" className="row-checkbox" checked={isSelected} onChange={() => onToggleRow(rowId)} onClick={(event) => event.stopPropagation()} /></td>{renderCells(row)}</tr> })}</tbody></table>
}

export function AdminSelectableTableSection<Row, RowId extends string | number>({ errorMessage, toolbar, title, search, header, batchActions, paginationId, page, totalPages, onPageChange, ...tableProps }: AdminSelectableTableSectionProps<Row, RowId>) {
  return <AdminTableSection errorMessage={errorMessage} toolbar={toolbar} title={title} search={search} header={header} batchActions={batchActions} body={<SelectableTable {...tableProps} />} paginationId={paginationId} page={page} totalPages={totalPages} onPageChange={onPageChange} />
}

export function ConfigurableSelectableTableSection<Row, RowId extends string | number>({ title, errorMessage, searchValue, onSearchChange, searchPlaceholder, searchDisabled = false, toolbarAction, filters, selectAllId, countId, rows, selectedRowIds, getRowId, onToggleRow, onToggleAll, batchButtons, isLoading, loadingMessage, emptyMessage, paginationId, tableId, bodyId, paginationKey, columns, getRowMeta }: ConfigurableSelectableTableSectionProps<Row, RowId>) {
  const { page, setPage, totalPages, pageRows } = usePagination(rows, TABLE_PAGE_SIZE, paginationKey)
  const pageRowIds = pageRows.map(getRowId)
  const allSelected = pageRowIds.length > 0 && pageRowIds.every((rowId) => selectedRowIds.has(rowId))
  return <AdminSelectableTableSection errorMessage={errorMessage} toolbar={<AdminFilterToolbar actions={renderToolbarAction(toolbarAction)} filters={renderToolbarFilters(filters)} />} title={title} search={{ value: searchValue, onChange: onSearchChange, placeholder: searchPlaceholder, disabled: searchDisabled }} header={<tr><th style={{ width: '40px' }} />{columns.map((column) => <th key={column.header} style={column.width ? { width: column.width } : undefined}>{column.header}</th>)}</tr>} batchActions={<SelectionBatchBar selectAllId={selectAllId} countId={countId} allSelected={allSelected} disabled={pageRowIds.length === 0} selectedCount={selectedRowIds.size} onToggleAll={() => onToggleAll(pageRowIds)}>{renderBatchButtons(batchButtons)}</SelectionBatchBar>} paginationId={paginationId} page={page} totalPages={totalPages} onPageChange={setPage} tableId={tableId} bodyId={bodyId} rows={pageRows} selectedRowIds={selectedRowIds} getRowId={getRowId} onToggleRow={onToggleRow} colSpan={columns.length + 1} isLoading={isLoading} loadingMessage={loadingMessage} emptyMessage={emptyMessage} getRowMeta={getRowMeta} renderCells={(row) => <>{columns.map((column) => <td key={`${String(getRowId(row))}-${column.header}`}>{column.renderCell(row)}</td>)}</>} />
}
