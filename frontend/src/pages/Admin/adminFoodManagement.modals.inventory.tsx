import type { ComponentProps } from 'react'
import type { InventoryItem } from '@/shared/types/inventory'
import { AdminButton } from './chrome'
import type { InventoryEditorDraft, InventoryStockInDraft, LotExpiryTarget, PackageEditorDraft, PackageEditorRowDraft, PackingStockCheckRow } from './adminFoodManagement.types'
import { InlineInput, InlineMessagePanel, InlineRepeaterField, InlineSelect, InlineSubmitEditor, renderModalField, renderModalFieldRow, type SelectFieldOption } from './modalBits'

type InventoryItemEditorModalProps = {
  id: string; isOpen: boolean; isEditing: boolean; draft: InventoryEditorDraft; error: string; submitting: boolean; categoryOptions: string[]
  onClose: () => void; onFieldChange: (field: keyof InventoryEditorDraft, value: string) => void; onSubmit: () => Promise<void>
}
type InventoryStockInModalProps = {
  isOpen: boolean; itemName: string; draft: InventoryStockInDraft; error: string; submitting: boolean
  onClose: () => void; onFieldChange: (field: keyof InventoryStockInDraft, value: string) => void; onSubmit: () => Promise<void>
}
type PackageEditorModalProps = {
  id: string; isOpen: boolean; isEditing: boolean; draft: PackageEditorDraft; inventoryItems: InventoryItem[]; error: string; submitting: boolean; categoryOptions: string[]
  onClose: () => void; onFieldChange: (field: keyof Omit<PackageEditorDraft, 'contents'>, value: string) => void
  onRowChange: (key: string, field: keyof Omit<PackageEditorRowDraft, 'key'>, value: string) => void; onAddRow: () => void; onRemoveRow: (key: string) => void; onSubmit: () => Promise<void>
}
type PackingModalProps = {
  isOpen: boolean; packages: Array<{ id: string | number; name: string }>; selectedPackageId: number | ''; quantity: string; stockCheckRows: PackingStockCheckRow[]; feedback: string
  loadingStockCheck: boolean; submitting: boolean; onClose: () => void; onPackageChange: (value: number | '') => void; onQuantityChange: (value: string) => void; onSubmit: () => Promise<void>
}
type LotExpiryModalProps = {
  isOpen: boolean; target: LotExpiryTarget | null; expiryValue: string; error: string; submitting: boolean
  onClose: () => void; onExpiryChange: (value: string) => void; onSubmit: () => Promise<void>
}
type PromiseSubmitEditorProps = Omit<ComponentProps<typeof InlineSubmitEditor>, 'onSubmit'> & { onSubmit: () => Promise<void> }

const PromiseSubmitEditor = ({ onSubmit, ...props }: PromiseSubmitEditorProps) => <InlineSubmitEditor {...props} onSubmit={() => void onSubmit()} />
const buildLabelOptions = (options: string[]): SelectFieldOption[] => options.map((option) => ({ value: option, label: option }))
const buildNamedOptions = (options: Array<{ id: string | number; name: string }>): SelectFieldOption[] => options.map((option) => ({ value: option.id, label: option.name }))
const bindDraftField = <TField extends string,>(onFieldChange: (field: TField, value: string) => void, field: TField) => (value: string) => onFieldChange(field, value)
const bindRowField = <TField extends string,>(onRowChange: (key: string, field: TField, value: string) => void, key: string, field: TField) => (value: string) => onRowChange(key, field, value)
const normalizeSelectNumber = (value: string) => { const nextValue = Number(value); return Number.isNaN(nextValue) || nextValue <= 0 ? '' : nextValue }
const renderPackingStockCheck = (loadingStockCheck: boolean, stockCheckRows: PackingStockCheckRow[]) => loadingStockCheck
  ? <p className="admin-inline-message-line">Loading package requirements...</p>
  : stockCheckRows.length === 0
    ? <p className="admin-inline-message-line">Select a package to review stock requirements.</p>
    : <>{stockCheckRows.map((row) => <p key={row.itemId} className="admin-inline-message-line">{row.name}: {row.availableQuantity} {row.unit} available / {row.requiredQuantity} required per pack</p>)}</>

function PackageContentsField({ rows, inventoryItems, disabled, onRowChange, onAddRow, onRemoveRow }: {
  rows: PackageEditorDraft['contents']; inventoryItems: InventoryItem[]; disabled: boolean
  onRowChange: PackageEditorModalProps['onRowChange']; onAddRow: () => void; onRemoveRow: (key: string) => void
}) {
  const inventoryOptions = buildNamedOptions(inventoryItems)
  return (
    <InlineRepeaterField label="Contents" rows={rows} rowClassName="package-item-row" addLabel="+ Add Row" addButtonId="add-package-item-btn" disabled={disabled} onAddRow={onAddRow} renderRow={(row) => (
      <>
        <InlineSelect value={row.itemId} onChange={(event) => bindRowField(onRowChange, row.key, 'itemId')(event.target.value)} disabled={disabled}>
          <option value="">Select item</option>
          {inventoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </InlineSelect>
        <InlineInput type="number" min={1} step={1} value={row.quantity} onChange={(event) => bindRowField(onRowChange, row.key, 'quantity')(event.target.value)} disabled={disabled} />
        <AdminButton tone="secondary" size="sm" className="remove-package-item-btn" onClick={() => onRemoveRow(row.key)} disabled={disabled || rows.length === 1}>Remove</AdminButton>
      </>
    )} />
  )
}

export function InventoryItemEditorModal({ id, isOpen, isEditing, draft, error, submitting, categoryOptions, onClose, onFieldChange, onSubmit }: InventoryItemEditorModalProps) {
  const selectOptions = buildLabelOptions(categoryOptions)
  return (
    <PromiseSubmitEditor id={id} isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Item' : 'Add New Item'} error={error} submitting={submitting} onSubmit={onSubmit} submitLabel={isEditing ? 'Save Item' : 'Add Item'} submittingLabel="Saving...">
      {renderModalField({ key: 'name', kind: 'text', label: 'Item Name', value: draft.name, onChange: bindDraftField(onFieldChange, 'name'), placeholder: 'e.g. Rice, Pasta', disabled: submitting })}
      {renderModalFieldRow([
        { key: 'category', kind: 'select', label: 'Category', value: draft.category, onChange: bindDraftField(onFieldChange, 'category'), options: selectOptions, placeholder: 'Select category', disabled: submitting },
        { key: 'unit', kind: 'text', label: 'Unit', value: draft.unit, onChange: bindDraftField(onFieldChange, 'unit'), placeholder: 'e.g. bags, cans, cartons', disabled: submitting },
      ])}
      {renderModalField({ key: 'threshold', kind: 'number', label: 'Safety Threshold', value: draft.threshold, onChange: bindDraftField(onFieldChange, 'threshold'), placeholder: '0', min: 0, step: 1, disabled: submitting })}
    </PromiseSubmitEditor>
  )
}

export function InventoryStockInModal({ isOpen, itemName, draft, error, submitting, onClose, onFieldChange, onSubmit }: InventoryStockInModalProps) {
  return (
    <PromiseSubmitEditor id="stock-in-editor" isOpen={isOpen} onClose={onClose} title="Stock In Item" error={error} submitting={submitting} onSubmit={onSubmit} submitLabel="Apply Stock In" submittingLabel="Saving...">
      {renderModalField({ key: 'itemName', kind: 'readonly', label: 'Item Name', value: itemName })}
      {renderModalFieldRow([
        { key: 'quantity', kind: 'number', label: 'Quantity', value: draft.quantity, onChange: bindDraftField(onFieldChange, 'quantity'), min: 1, step: 1, disabled: submitting },
        { key: 'expiryDate', kind: 'date', label: 'Expiry Date', value: draft.expiryDate, onChange: bindDraftField(onFieldChange, 'expiryDate'), placeholder: 'DD/MM/YYYY', inputMode: 'numeric', disabled: submitting },
      ])}
    </PromiseSubmitEditor>
  )
}

export function PackageEditorModal({ id, isOpen, isEditing, draft, inventoryItems, error, submitting, categoryOptions, onClose, onFieldChange, onRowChange, onAddRow, onRemoveRow, onSubmit }: PackageEditorModalProps) {
  const categorySelectOptions = buildLabelOptions(categoryOptions)
  return (
    <PromiseSubmitEditor id={id} isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Package' : 'Add New Package'} error={error} submitting={submitting} onSubmit={onSubmit} submitLabel={isEditing ? 'Save Package' : 'Add Package'} submittingLabel="Saving...">
      {renderModalField({ key: 'name', kind: 'text', label: 'Package Name', value: draft.name, onChange: bindDraftField(onFieldChange, 'name'), placeholder: 'e.g. Emergency Pack A', disabled: submitting })}
      {renderModalFieldRow([
        { key: 'category', kind: 'select', label: 'Category', value: draft.category, onChange: bindDraftField(onFieldChange, 'category'), options: categorySelectOptions, placeholder: 'Select category', disabled: submitting },
        { key: 'threshold', kind: 'number', label: 'Safety Threshold', value: draft.threshold, onChange: bindDraftField(onFieldChange, 'threshold'), min: 0, step: 1, disabled: submitting },
      ], true)}
      <PackageContentsField rows={draft.contents} inventoryItems={inventoryItems} disabled={submitting} onRowChange={onRowChange} onAddRow={onAddRow} onRemoveRow={onRemoveRow} />
    </PromiseSubmitEditor>
  )
}

export function PackingModal({ isOpen, packages, selectedPackageId, quantity, stockCheckRows, feedback, loadingStockCheck, submitting, onClose, onPackageChange, onQuantityChange, onSubmit }: PackingModalProps) {
  const packageOptions = buildNamedOptions(packages)
  return (
    <PromiseSubmitEditor id="packing-editor" isOpen={isOpen} onClose={onClose} title="Package Packing Operation" submitting={submitting} onSubmit={onSubmit} submitLabel="Submit Packing" submittingLabel="Packing...">
      {renderModalField({ key: 'packageId', kind: 'select', label: 'Select Package', value: selectedPackageId, onChange: (value) => onPackageChange(normalizeSelectNumber(value)), options: packageOptions, placeholder: 'Select a package', disabled: submitting })}
      <InlineMessagePanel tone="warning" title="Package Contents & Stock Check">{renderPackingStockCheck(loadingStockCheck, stockCheckRows)}</InlineMessagePanel>
      {renderModalField({ key: 'quantity', kind: 'number', label: 'Pack Quantity', value: quantity, onChange: onQuantityChange, min: 1, step: 1, disabled: submitting })}
      {feedback ? <InlineMessagePanel>{feedback}</InlineMessagePanel> : null}
    </PromiseSubmitEditor>
  )
}

export function LotExpiryModal({ isOpen, target, expiryValue, error, submitting, onClose, onExpiryChange, onSubmit }: LotExpiryModalProps) {
  if (!isOpen || !target) return null
  return (
    <PromiseSubmitEditor id="edit-lot-editor" isOpen={isOpen} onClose={onClose} title="Edit Lot Expiry" error={error} submitting={submitting} onSubmit={onSubmit} submitLabel="Save Expiry" submittingLabel="Saving...">
      {renderModalField({ key: 'itemName', kind: 'readonly', label: 'Item Name', value: target.itemName })}
      {renderModalFieldRow([
        { key: 'lotNumber', kind: 'readonly', label: 'Lot Number', value: target.lotNumber },
        { key: 'quantity', kind: 'readonly', label: 'Remaining Stock', value: String(target.quantity) },
      ])}
      {renderModalField({ key: 'expiryDate', kind: 'date', label: 'Expiry Date', value: expiryValue, onChange: onExpiryChange, inputMode: 'numeric', disabled: submitting })}
    </PromiseSubmitEditor>
  )
}
