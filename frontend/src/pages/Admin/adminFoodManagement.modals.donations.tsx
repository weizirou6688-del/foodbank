import { Fragment } from 'react'
import type { DonationListRow } from '@/shared/types/donations'
import { AdminButton } from './chrome'
import { buildDonationDisplayId } from './formatting'
import type { DonationEditorDraft, DonationEditorItemDraft } from './adminFoodManagement.types'
import { buildDonationDetailsRows, getDonationDonorTypeLabel, getDonationStatusLabel } from './rules'
import {
  EditorActions,
  InlineDetailsTable,
  InlineEditor,
  InlineInput,
  InlineRepeaterField,
  InlineSelect,
  InlineSubmitEditor,
  renderModalFieldRow,
  type ModalFieldConfig,
  type SelectFieldOption,
} from './modalBits'

interface DonationEditorModalProps {
  isOpen: boolean
  isEditing: boolean
  draft: DonationEditorDraft
  itemOptions: string[]
  error: string
  submitting: boolean
  onClose: () => void
  onFieldChange: (field: keyof Omit<DonationEditorDraft, 'items'>, value: string) => void
  onItemChange: (key: string, field: keyof Omit<DonationEditorItemDraft, 'key'>, value: string) => void
  onAddItem: () => void
  onRemoveItem: (key: string) => void
  onSubmit: () => Promise<void>
}

interface DonationDetailsModalProps {
  donation: DonationListRow | null
  isOpen: boolean
  onClose: () => void
}

const DONOR_TYPE_OPTIONS: SelectFieldOption[] = [
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'individual', label: 'Individual' },
  { value: 'organization', label: 'Organization' },
]

function DonationItemRow({ item, index, itemOptions, itemCount, disabled, onItemChange, onRemoveItem }: {
  item: DonationEditorItemDraft
  index: number
  itemOptions: string[]
  itemCount: number
  disabled: boolean
  onItemChange: DonationEditorModalProps['onItemChange']
  onRemoveItem: DonationEditorModalProps['onRemoveItem']
}) {
  return (
    <>
      <InlineSelect value={item.itemName} onChange={(event) => onItemChange(item.key, 'itemName', event.target.value)} disabled={disabled}>
        <option value="">Select item</option>
        {itemOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </InlineSelect>
      <InlineInput aria-label={`Quantity ${index + 1}`} type="number" min={1} step={1} value={item.quantity} onChange={(event) => onItemChange(item.key, 'quantity', event.target.value)} disabled={disabled} />
      <InlineInput aria-label={`Expiry Date ${index + 1}`} type="text" value={item.expiryDate} onChange={(event) => onItemChange(item.key, 'expiryDate', event.target.value)} placeholder="DD/MM/YYYY" inputMode="numeric" disabled={disabled} />
      <AdminButton tone="secondary" size="sm" className="remove-item-btn" onClick={() => onRemoveItem(item.key)} disabled={disabled || itemCount === 1}>Remove</AdminButton>
    </>
  )
}

function DonationDetailsSection({ donation }: { donation: DonationListRow }) {
  const summaryRows: ModalFieldConfig[][] = [
    [
      { key: 'donationId', kind: 'readonly', label: 'Donation ID', value: buildDonationDisplayId(donation) },
      { key: 'status', kind: 'readonly', label: 'Status', value: getDonationStatusLabel(donation) },
    ],
    [
      { key: 'donorType', kind: 'readonly', label: 'Donor Type', value: getDonationDonorTypeLabel(donation) },
      { key: 'donorName', kind: 'readonly', label: 'Donor Name', value: donation.donor_name ?? 'Anonymous' },
    ],
  ]
  const detailRows = buildDonationDetailsRows(donation)

  return (
    <>
      {summaryRows.map((fields, rowIndex) => <Fragment key={`donation-details-${rowIndex}`}>{renderModalFieldRow(fields)}</Fragment>)}
      <div className="form-group">
        <label className="form-label">Donation Items</label>
        <InlineDetailsTable columns={[
          { header: 'Item Name', renderCell: (row) => row.name },
          { header: 'Quantity', renderCell: (row) => row.quantityLabel },
          { header: 'Expiry Date', renderCell: (row) => row.expiryLabel },
        ]} rows={detailRows} emptyMessage="No item rows." rowKey={(row) => `${row.name}-${row.quantityLabel}`} />
      </div>
    </>
  )
}

const buildEditorFieldRows = (draft: DonationEditorDraft, onFieldChange: DonationEditorModalProps['onFieldChange']): ModalFieldConfig[][] => [
  [
    { key: 'donorType', kind: 'select', label: 'Donor Type', required: true, value: draft.donorType, placeholder: 'Select donor type', options: DONOR_TYPE_OPTIONS, onChange: (value) => onFieldChange('donorType', value) },
    { key: 'donorName', kind: 'text', label: 'Donor Name', required: true, value: draft.donorName, placeholder: 'Donor full name', onChange: (value) => onFieldChange('donorName', value) },
  ],
  [
    { key: 'donorEmail', kind: 'email', label: 'Contact Email', required: true, value: draft.donorEmail, placeholder: 'Email address', onChange: (value) => onFieldChange('donorEmail', value) },
    { key: 'receivedDate', kind: 'date', label: 'Received Date', required: true, value: draft.receivedDate, placeholder: 'DD/MM/YYYY', onChange: (value) => onFieldChange('receivedDate', value), inputMode: 'numeric' },
  ],
]

export function DonationEditorModal({ isOpen, isEditing, draft, itemOptions, error, submitting, onClose, onFieldChange, onItemChange, onAddItem, onRemoveItem, onSubmit }: DonationEditorModalProps) {
  return (
    <InlineSubmitEditor id="new-donation-editor" isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Donation' : 'New Donation'} error={error} submitting={submitting} onSubmit={() => void onSubmit()} submitLabel={isEditing ? 'Save Donation' : 'Submit Donation'} submittingLabel="Saving...">
      {buildEditorFieldRows(draft, onFieldChange).map((fields, rowIndex) => <Fragment key={`donation-field-row-${rowIndex}`}>{renderModalFieldRow(fields)}</Fragment>)}
      <InlineRepeaterField
        label="Donation Items"
        rows={draft.items}
        rowClassName="donation-item-row"
        addLabel="+ Add Row"
        addButtonId="add-item-btn"
        disabled={submitting}
        onAddRow={onAddItem}
        renderRow={(item, index) => <DonationItemRow item={item} index={index} itemOptions={itemOptions} itemCount={draft.items.length} disabled={submitting} onItemChange={onItemChange} onRemoveItem={onRemoveItem} />}
      />
    </InlineSubmitEditor>
  )
}

export function DonationDetailsModal({ donation, isOpen, onClose }: DonationDetailsModalProps) {
  if (!isOpen || !donation) return null
  return (
    <InlineEditor id="view-donation-editor" isOpen={isOpen} onClose={onClose} title="Donation Details">
      <DonationDetailsSection donation={donation} />
      <EditorActions actions={[{ label: 'Close', tone: 'secondary', onClick: onClose }]} />
    </InlineEditor>
  )
}
