import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import type { DonationListRow } from '@/shared/types/donations'
import type { AdminButtonTone } from './chrome'
import { buildDonationDisplayId, buildDonationTotalLabel, formatUkDate } from './formatting'
import {
  AdminTableActionButtons,
  ConfigurableSelectableTableSection,
  type AdminTableRowAction,
  type TableColumn,
} from './adminFoodManagement.selectableTable'
import { STATUS_TEXT_COLORS, type FilterOption } from './sectionBits'
import type { DonationDonorType, DonationStatusFilter } from './adminFoodManagement.types'
import {
  canEditDonation,
  canVoidApplication,
  getApplicationPackageLabel,
  getApplicationStatusLabel,
  getApplicationStatusTone,
  getDonationDateLabel,
  getDonationDonorTypeLabel,
  getDonationStatusLabel,
  isPendingGoodsDonation,
} from './rules'

interface AdminDonationsSectionProps {
  search: string
  donorTypeFilter: DonationDonorType | 'all'
  statusFilter: DonationStatusFilter
  donations: DonationListRow[]
  selectedDonationIds: ReadonlySet<string>
  isLoadingDonations: boolean
  donationError: string
  onSearchChange: (value: string) => void
  onDonorTypeFilterChange: (value: DonationDonorType | 'all') => void
  onStatusFilterChange: (value: DonationStatusFilter) => void
  onNewDonation: () => void
  onToggleDonationSelection: (donationId: string) => void
  onToggleAllDonations: (donationIds?: string[]) => void
  onViewDonation: (donation: DonationListRow) => void
  onEditDonation: (donation: DonationListRow) => void
  onReceiveDonation: (donation: DonationListRow) => void
  onDeleteDonation: (donation: DonationListRow) => void
  onBatchDelete: () => void
  onBatchReceive: () => void
  isBatchDeleteBusy: boolean
  isBatchReceiveBusy: boolean
  heading?: string
}

interface AdminCodesSectionProps {
  search: string
  applications: AdminApplicationRecord[]
  selectedCodeIds: ReadonlySet<string>
  isLoadingApplications: boolean
  applicationsError: string
  onSearchChange: (value: string) => void
  onOpenVerify: () => void
  onToggleCodeSelection: (applicationId: string) => void
  onToggleAllCodes: (applicationIds?: string[]) => void
  onViewCode: (record: AdminApplicationRecord) => void
  onVoidCode: (record: AdminApplicationRecord) => void
  onBatchVoid: () => void
  isBatchVoidBusy: boolean
  heading?: string
}

type RowActionConfig<Row> = { label: string; tone?: AdminButtonTone; className?: string; onClick: (row: Row) => void }
type RowActionSet<Row> = { when?: (row: Row) => boolean; actions: RowActionConfig<Row>[] }

const DONOR_TYPE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Donor Types' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'individual', label: 'Individual' },
  { value: 'organization', label: 'Organization' },
]

const DONATION_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

const renderStatusDetail = (label: string, tone: keyof typeof STATUS_TEXT_COLORS) => <span style={{ color: STATUS_TEXT_COLORS[tone], fontWeight: 600 }}>{label}</span>
const countSelectedRows = <Row extends { id: string }>(rows: Row[], selectedIds: ReadonlySet<string>, isMatch: (row: Row) => boolean = () => true) => rows.filter((row) => selectedIds.has(row.id) && isMatch(row)).length
const buildRowActions = <Row,>(row: Row, actionSets: RowActionSet<Row>[]): AdminTableRowAction[] => (actionSets.find(({ when }) => !when || when(row))?.actions ?? []).map((action) => ({ label: action.label, tone: action.tone, className: action.className, onClick: () => action.onClick(row) }))
const renderActionCell = <Row,>(rowKey: string, row: Row, actionSets: RowActionSet<Row>[]) => <AdminTableActionButtons rowKey={rowKey} actions={buildRowActions(row, actionSets)} />

const createDonationActionSets = (handlers: Pick<AdminDonationsSectionProps, 'onViewDonation' | 'onEditDonation' | 'onReceiveDonation' | 'onDeleteDonation'>): RowActionSet<DonationListRow>[] => [
  {
    when: isPendingGoodsDonation,
    actions: [
      { label: 'Receive', className: 'receive-donation-btn', onClick: handlers.onReceiveDonation },
      { label: 'Delete', tone: 'danger', className: 'delete-donation-btn', onClick: handlers.onDeleteDonation },
    ],
  },
  {
    when: canEditDonation,
    actions: [
      { label: 'View', tone: 'secondary', className: 'view-donation-btn', onClick: handlers.onViewDonation },
      { label: 'Edit', tone: 'secondary', className: 'edit-donation-btn', onClick: handlers.onEditDonation },
    ],
  },
  {
    actions: [
      { label: 'View', tone: 'secondary', className: 'view-donation-btn', onClick: handlers.onViewDonation },
      { label: 'Delete', tone: 'danger', className: 'delete-donation-btn', onClick: handlers.onDeleteDonation },
    ],
  },
]

const createCodeActionSets = (handlers: Pick<AdminCodesSectionProps, 'onViewCode' | 'onVoidCode'>): RowActionSet<AdminApplicationRecord>[] => [
  { when: canVoidApplication, actions: [{ label: 'Void', tone: 'danger', className: 'void-code-btn', onClick: handlers.onVoidCode }] },
  { actions: [{ label: 'View', tone: 'secondary', className: 'view-code-btn', onClick: handlers.onViewCode }] },
]

const createDonationColumns = (actionSets: RowActionSet<DonationListRow>[]): TableColumn<DonationListRow>[] => [
  { header: 'Donation ID', renderCell: buildDonationDisplayId },
  { header: 'Donor Type', renderCell: getDonationDonorTypeLabel },
  { header: 'Donor Name', renderCell: (donation) => donation.donor_name ?? 'Anonymous' },
  { header: 'Date', renderCell: getDonationDateLabel },
  { header: 'Total Items', renderCell: buildDonationTotalLabel },
  { header: 'Status', renderCell: getDonationStatusLabel },
  { header: 'Actions', renderCell: (donation) => renderActionCell(donation.id, donation, actionSets) },
]

const createCodeColumns = (actionSets: RowActionSet<AdminApplicationRecord>[]): TableColumn<AdminApplicationRecord>[] => [
  { header: 'Redemption Code', renderCell: (record) => record.redemption_code },
  { header: 'Package', renderCell: getApplicationPackageLabel },
  { header: 'Generated At', renderCell: (record) => formatUkDate(record.created_at) },
  { header: 'Status', renderCell: (record) => renderStatusDetail(getApplicationStatusLabel(record), getApplicationStatusTone(record)) },
  { header: 'Redeemed At', renderCell: (record) => formatUkDate(record.redeemed_at) },
  { header: 'Actions', renderCell: (record) => renderActionCell(record.id, record, actionSets) },
]

export function AdminDonationsSection({ search, donorTypeFilter, statusFilter, donations, selectedDonationIds, isLoadingDonations, donationError, onSearchChange, onDonorTypeFilterChange, onStatusFilterChange, onNewDonation, onToggleDonationSelection, onToggleAllDonations, onViewDonation, onEditDonation, onReceiveDonation, onDeleteDonation, onBatchDelete, onBatchReceive, isBatchDeleteBusy, isBatchReceiveBusy, heading = 'Donation Intake & Recording' }: AdminDonationsSectionProps) {
  const actionSets = createDonationActionSets({ onViewDonation, onEditDonation, onReceiveDonation, onDeleteDonation })

  return (
    <ConfigurableSelectableTableSection
      title={heading}
      errorMessage={donationError}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search donation records"
      toolbarAction={{ label: '+ New Donation', onClick: onNewDonation }}
      filters={[
        { type: 'select', value: donorTypeFilter, options: DONOR_TYPE_OPTIONS, placeholder: 'All Donor Types', onChange: (value) => onDonorTypeFilterChange(value as DonationDonorType | 'all') },
        { type: 'select', value: statusFilter, options: DONATION_STATUS_OPTIONS, placeholder: 'All Status', onChange: (value) => onStatusFilterChange(value as DonationStatusFilter) },
      ]}
      selectAllId="select-all-donations"
      countId="donation-selected-count"
      rows={donations}
      selectedRowIds={selectedDonationIds}
      getRowId={(donation) => donation.id}
      onToggleRow={onToggleDonationSelection}
      onToggleAll={onToggleAllDonations}
      batchButtons={[
        { id: 'batch-delete-donations', label: 'Delete Selected', busyLabel: 'Deleting...', tone: 'secondary', busy: isBatchDeleteBusy, disabled: selectedDonationIds.size === 0 || isBatchDeleteBusy, onClick: onBatchDelete },
        { id: 'batch-receive-donations', label: 'Mark as Received', busyLabel: 'Working...', busy: isBatchReceiveBusy, disabled: countSelectedRows(donations, selectedDonationIds, isPendingGoodsDonation) === 0 || isBatchReceiveBusy, onClick: onBatchReceive },
      ]}
      isLoading={isLoadingDonations}
      loadingMessage="Loading donation records..."
      emptyMessage="No donation records found."
      paginationId="donation-pagination"
      tableId="donation-table"
      bodyId="donation-table-body"
      paginationKey={`${search}|${donorTypeFilter}|${statusFilter}`}
      columns={createDonationColumns(actionSets)}
      getRowMeta={(donation) => ({ dataAttributes: { 'data-id': donation.id, 'data-kind': donation.donation_type } })}
    />
  )
}

export function AdminCodesSection({ search, applications, selectedCodeIds, isLoadingApplications, applicationsError, onSearchChange, onOpenVerify, onToggleCodeSelection, onToggleAllCodes, onViewCode, onVoidCode, onBatchVoid, isBatchVoidBusy, heading = 'Redemption Code Verification' }: AdminCodesSectionProps) {
  const actionSets = createCodeActionSets({ onViewCode, onVoidCode })

  return (
    <ConfigurableSelectableTableSection
      title={heading}
      errorMessage={applicationsError}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search redemption code records"
      toolbarAction={{ id: 'verify-code-btn', label: 'Verify Redemption Code', onClick: onOpenVerify }}
      selectAllId="select-all-codes"
      countId="code-selected-count"
      rows={applications}
      selectedRowIds={selectedCodeIds}
      getRowId={(record) => record.id}
      onToggleRow={onToggleCodeSelection}
      onToggleAll={onToggleAllCodes}
      batchButtons={[{ id: 'batch-void-codes', label: 'Void Selected', busyLabel: 'Voiding...', tone: 'danger', busy: isBatchVoidBusy, disabled: countSelectedRows(applications, selectedCodeIds, canVoidApplication) === 0 || isBatchVoidBusy, onClick: onBatchVoid }]}
      isLoading={isLoadingApplications}
      loadingMessage="Loading redemption codes..."
      emptyMessage="No redemption code records found."
      paginationId="code-pagination"
      tableId="code-table"
      bodyId="code-table-body"
      paginationKey={search}
      columns={createCodeColumns(actionSets)}
      getRowMeta={(record) => ({ dataAttributes: { 'data-id': record.id } })}
    />
  )
}
