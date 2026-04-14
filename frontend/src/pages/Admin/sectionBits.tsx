import { useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import { cx } from './classNames'
import { AdminButton, type AdminButtonTone } from './chrome'

export interface FoodBankOption { id: number; name: string }
export interface FilterOption { value: string; label: string }
export interface TableSearchConfig { value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }
export interface ToolbarButtonConfig { id?: string; label: string; tone?: AdminButtonTone; disabled?: boolean; onClick: () => void }
export type ToolbarFilterConfig =
  | { type: 'select'; key?: string; id?: string; value: string; options: FilterOption[]; placeholder: string; onChange: (value: string) => void; disabled?: boolean }
  | { type: 'food-bank'; key?: string; id: string; foodBankOptions?: FoodBankOption[]; selectedFoodBankId?: number | null; onFoodBankChange?: (foodBankId: number | null) => void }

type PaginationProps = { id: string; page: number; totalPages: number; onPageChange: (page: number) => void }
type FilterSelectProps = { id?: string; value: string; options: FilterOption[]; placeholder: string; onChange: (value: string) => void; disabled?: boolean }
type FoodBankFilterProps = { id: string; foodBankOptions?: FoodBankOption[]; selectedFoodBankId?: number | null; onFoodBankChange?: (foodBankId: number | null) => void }
type SectionShellProps = { errorMessage?: string; toolbar?: ReactNode; title: string; search?: TableSearchConfig; children: ReactNode }
type SummaryCardProps = { title: string; description?: ReactNode; details?: ReactNode; note?: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string; children?: ReactNode } & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'title'>

type AdminCardCollectionSectionProps<T> = { errorMessage?: string; toolbar?: ReactNode; title: string; search?: TableSearchConfig; gridId?: string; gridVariant?: 'default' | 'compact'; items: T[]; renderCard: (item: T) => ReactNode; emptyState?: ReactNode; hideEmptyState?: boolean }
type ConfigurableAdminCardSectionProps<T> = { errorMessage?: string; title: string; search?: TableSearchConfig; toolbarAction?: ToolbarButtonConfig; filters?: ToolbarFilterConfig[]; gridId?: string; gridVariant?: 'default' | 'compact'; items: T[]; renderCard: (item: T) => ReactNode; emptyStateTitle: string; emptyStateDescription?: string | null; emptyStateTone?: 'default' | 'warning'; hideEmptyState?: boolean }
type SelectionBatchBarProps = { selectAllId: string; countId: string; allSelected: boolean; disabled: boolean; selectedCount: number; onToggleAll: () => void; children: ReactNode }
type AdminTableSectionProps = { errorMessage?: string; toolbar?: ReactNode; title: string; search?: TableSearchConfig; header: ReactNode; batchActions?: ReactNode; body: ReactNode; paginationId: string; page: number; totalPages: number; onPageChange: (page: number) => void }

const renderTableSearch = (search?: TableSearchConfig) => search ? <TableSearchInput {...search} /> : undefined
const renderToolbarFilter = (filter: ToolbarFilterConfig) => filter.type === 'food-bank'
  ? <FoodBankFilterSelect key={filter.key ?? filter.id} id={filter.id} foodBankOptions={filter.foodBankOptions} selectedFoodBankId={filter.selectedFoodBankId} onFoodBankChange={filter.onFoodBankChange} />
  : <FilterSelect key={filter.key ?? filter.id ?? `${filter.placeholder}-${filter.value}`} id={filter.id} value={filter.value} options={filter.options} placeholder={filter.placeholder} onChange={filter.onChange} disabled={filter.disabled} />

function buildCompactPaginationTokens(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const pages = new Set<number>([1, totalPages, currentPage])
  for (let offset = -1; offset <= 1; offset += 1) {
    const page = currentPage + offset
    if (page >= 1 && page <= totalPages) pages.add(page)
  }
  const sortedPages = Array.from(pages).sort((left, right) => left - right)
  return sortedPages.flatMap((page, index) => sortedPages[index - 1] && page - sortedPages[index - 1] > 1 ? [`ellipsis-${sortedPages[index - 1]}-${page}`, page] : [page])
}

function AdminPagination({ id, page, totalPages, onPageChange }: PaginationProps) {
  const tokens = useMemo(() => buildCompactPaginationTokens(page, totalPages), [page, totalPages])
  return <div className="pagination" id={id}><button type="button" className="page-btn page-nav" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}><span className="page-btn-arrow">&#8249;</span><span className="page-btn-label">Previous</span></button><div className="pagination-pages">{tokens.map((token) => typeof token === 'number' ? <button key={`${id}-${token}`} type="button" className={`page-btn page-num${page === token ? ' active' : ''}`} onClick={() => onPageChange(token)}>{token}</button> : <span key={`${id}-${token}`} className="page-btn page-ellipsis" aria-hidden="true">...</span>)}</div><button type="button" className="page-btn page-nav" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}><span className="page-btn-label">Next</span><span className="page-btn-arrow">&#8250;</span></button></div>
}

function TableSearchInput({ value, onChange, placeholder, disabled = false }: TableSearchConfig) {
  return <div className="table-search-wrapper"><svg className="table-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg><input type="text" className="table-search-input" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} /></div>
}

export function FilterSelect({ id, value, options, placeholder, onChange, disabled = false }: FilterSelectProps) {
  return <select className="filter-select" id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">{placeholder}</option>{options.map((option) => <option key={`${id ?? 'filter'}-${option.value}`} value={option.value}>{option.label}</option>)}</select>
}

export function FoodBankFilterSelect({ id, foodBankOptions, selectedFoodBankId, onFoodBankChange }: FoodBankFilterProps) {
  if (!foodBankOptions) return null
  return <FilterSelect id={id} value={selectedFoodBankId == null ? '' : String(selectedFoodBankId)} options={foodBankOptions.map((foodBank) => ({ value: String(foodBank.id), label: foodBank.name }))} placeholder={foodBankOptions.length > 0 ? 'Choose a food bank' : 'No food banks available'} onChange={(value) => onFoodBankChange?.(value ? Number(value) : null)} disabled={foodBankOptions.length === 0} />
}

// eslint-disable-next-line react-refresh/only-export-components -- Exported render helpers are shared by multiple admin section modules.
export const renderToolbarAction = (action?: ToolbarButtonConfig) => action ? <AdminButton id={action.id} tone={action.tone} disabled={action.disabled} onClick={action.onClick}>{action.label}</AdminButton> : undefined
// eslint-disable-next-line react-refresh/only-export-components -- Exported render helpers are shared by multiple admin section modules.
export const renderToolbarFilters = (filters?: ToolbarFilterConfig[]) => filters?.length ? <>{filters.map(renderToolbarFilter)}</> : undefined

export function AdminFilterToolbar({ actions, filters, filterAlign = 'end' }: { actions?: ReactNode; filters?: ReactNode; filterAlign?: 'start' | 'end' }) {
  if (!actions && !filters) return null
  return <div className="section-actions">{actions}{filters ? <div className={cx('admin-toolbar-group', filterAlign === 'end' && 'admin-toolbar-group--end')}>{filters}</div> : null}</div>
}

function AdminSectionShell({ errorMessage = '', toolbar, title, search, children }: SectionShellProps) {
  return <div className="fade-in">{errorMessage ? <AdminFeedbackBanner tone="error" message={errorMessage} /> : null}{toolbar}<div className="record-header"><div className="record-title">{title}</div></div>{renderTableSearch(search)}{children}</div>
}

export function AdminCardCollectionSection<T>({ errorMessage = '', toolbar, title, search, gridId, gridVariant = 'default', items, renderCard, emptyState, hideEmptyState = false }: AdminCardCollectionSectionProps<T>) {
  return <AdminSectionShell errorMessage={errorMessage} toolbar={toolbar} title={title} search={search}><div className={cx('admin-card-grid', gridVariant === 'compact' && 'admin-card-grid--compact')} id={gridId}>{items.length > 0 ? items.map(renderCard) : hideEmptyState ? null : emptyState}</div></AdminSectionShell>
}

export function ConfigurableAdminCardSection<T>({ errorMessage = '', title, search, toolbarAction, filters, gridId, gridVariant = 'default', items, renderCard, emptyStateTitle, emptyStateDescription, emptyStateTone = 'default', hideEmptyState = false }: ConfigurableAdminCardSectionProps<T>) {
  return <AdminCardCollectionSection errorMessage={errorMessage} toolbar={<AdminFilterToolbar actions={renderToolbarAction(toolbarAction)} filters={renderToolbarFilters(filters)} />} title={title} search={search} gridId={gridId} gridVariant={gridVariant} items={items} renderCard={renderCard} hideEmptyState={hideEmptyState} emptyState={<AdminEmptyStateCard title={emptyStateTitle} description={emptyStateDescription} tone={emptyStateTone} />} />
}

export function AdminSummaryCard({ title, description, details, note, meta, actions, className, children, ...props }: SummaryCardProps) {
  return <div className={cx('card', 'admin-summary-card', className)} {...props}><div className="admin-summary-card-title">{title}</div>{description ? <p className="admin-summary-card-description">{description}</p> : null}{details}{children}{meta}{note}{actions}</div>
}

export const AdminSummaryCardDetails = ({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) => <div className="admin-summary-card-details">{rows.map((row) => <p key={row.label}><strong>{row.label}:</strong> {row.value}</p>)}</div>

export function SelectionBatchBar({ selectAllId, countId, allSelected, disabled, selectedCount, onToggleAll, children }: SelectionBatchBarProps) {
  return <div className="batch-actions"><div className="batch-left"><input id={selectAllId} type="checkbox" checked={allSelected} onChange={onToggleAll} disabled={disabled} /><label htmlFor={selectAllId} className="batch-select-label">Select All</label><span id={countId} className="batch-select-count">{selectedCount} selected</span></div><div className="batch-right">{children}</div></div>
}

export function AdminTableSection({ errorMessage = '', toolbar, title, search, header, batchActions, body, paginationId, page, totalPages, onPageChange }: AdminTableSectionProps) {
  return <AdminSectionShell errorMessage={errorMessage} toolbar={toolbar} title={title} search={search}><div className="table-wrapper"><div className="table-header-shell"><table className="data-table"><thead>{header}</thead></table></div>{batchActions}<div className="table-body-shell">{body}</div><AdminPagination id={paginationId} page={page} totalPages={totalPages} onPageChange={onPageChange} /></div></AdminSectionShell>
}

export function AdminEmptyStateCard({ title, description, tone = 'default' }: { title: string; description?: string | null; tone?: 'default' | 'warning' }) {
  return <div className={cx('card', 'admin-empty-state-card', tone === 'warning' && 'admin-empty-state-card--warning')}><h3 className="admin-empty-state-title">{title}</h3>{description ? <p className="admin-empty-state-description">{description}</p> : null}</div>
}

export const TABLE_PAGE_SIZE = 5
export const STATUS_TEXT_COLORS = { success: '#2E7D32', warning: '#F57C00', error: '#D32F2F', muted: '#6B7280' } as const
