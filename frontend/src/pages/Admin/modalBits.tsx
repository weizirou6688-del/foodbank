import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { AdminButton, type AdminButtonTone } from './chrome'
import { cx } from './classNames'

export interface SelectFieldOption {
  value: string | number
  label: string
}

type InteractiveFieldConfig = {
  key: string
  label: string
  value: string | number
  required?: boolean
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
}

export type ModalFieldConfig =
  | (InteractiveFieldConfig & { kind: 'text' | 'email' })
  | (InteractiveFieldConfig & { kind: 'number'; min?: number; step?: number })
  | (InteractiveFieldConfig & { kind: 'date'; inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'] })
  | (InteractiveFieldConfig & { kind: 'select'; options: SelectFieldOption[] })
  | { key: string; kind: 'readonly'; label: string; value: string }

interface InlineEditorProps {
  id: string
  isOpen: boolean
  title: string
  onClose: () => void
  disableClose?: boolean
  children: ReactNode
}

export function InlineEditor({ id, isOpen, title, onClose, disableClose = false, children }: InlineEditorProps) {
  if (!isOpen) return null

  return (
    <div id={id} className="inline-editor visible" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div className="editor-header">
        <h3 id={`${id}-title`} className="editor-title">
          {title}
        </h3>
        <button
          type="button"
          className="editor-close"
          onClick={onClose}
          disabled={disableClose}
          aria-label="Close editor"
        >
          &times;
        </button>
      </div>
      {children}
    </div>
  )
}

interface InlineConfirmModalProps {
  id: string
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
  submitting?: boolean
  confirmTone?: 'danger' | 'primary'
}

export function InlineConfirmModal({
  id,
  isOpen,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  submitting = false,
  confirmTone = 'danger',
}: InlineConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div id={id} className="inline-confirm visible" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="confirm-title">
        {title}
      </h3>
      <p className="confirm-desc">{description}</p>
      <EditorActions
        centered
        actions={[
          { label: 'Cancel', tone: 'secondary', onClick: onClose, disabled: submitting },
          { label: submitting ? 'Working...' : confirmLabel, tone: confirmTone, onClick: onConfirm, disabled: submitting },
        ]}
      />
    </div>
  )
}

function InlineField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {required ? <span style={{ color: 'var(--color-error)' }}> *</span> : null}
      </label>
      {children}
    </div>
  )
}

function ModalFieldGrid({ compact = false, children }: { compact?: boolean; children: ReactNode }) {
  return <div className={compact ? 'inline-form-row' : 'form-grid'}>{children}</div>
}

export function InlineInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`form-input ${props.className ?? ''}`.trim()} />
}

export function InlineSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`form-select ${props.className ?? ''}`.trim()} />
}

type LabeledInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  required?: boolean
}

function LabeledInputField({ label, required = false, ...props }: LabeledInputProps) {
  return (
    <InlineField label={label} required={required}>
      <InlineInput {...props} />
    </InlineField>
  )
}

function SelectField({
  label,
  required = false,
  options,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  required?: boolean
  options: SelectFieldOption[]
  placeholder?: string
}) {
  return (
    <InlineField label={label} required={required}>
      <InlineSelect {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={`${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </InlineSelect>
    </InlineField>
  )
}

export function InlineMessagePanel({
  tone = 'default',
  title,
  children,
  className,
}: {
  tone?: 'default' | 'success' | 'warning' | 'error'
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('admin-inline-message', `admin-inline-message--${tone}`, className)}>
      {title ? <p className="admin-inline-message-title">{title}</p> : null}
      <div className="admin-inline-message-body">{children}</div>
    </div>
  )
}

export function InlineErrorBanner({ message }: { message: string }) {
  return message ? <InlineMessagePanel tone="error">{message}</InlineMessagePanel> : null
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return <LabeledInputField type="text" label={label} value={value} disabled readOnly />
}

// eslint-disable-next-line react-refresh/only-export-components -- Shared JSX helpers keep the modal call sites small without affecting runtime behavior.
export function renderModalField(field: ModalFieldConfig) {
  if (field.kind === 'readonly') return <ReadonlyField key={field.key} label={field.label} value={field.value} />
  if (field.kind === 'select') return <SelectField key={field.key} label={field.label} required={field.required} value={field.value} onChange={(event) => field.onChange(event.target.value)} options={field.options} placeholder={field.placeholder} disabled={field.disabled} />
  const inputType = field.kind === 'number' ? 'number' : field.kind === 'email' ? 'email' : 'text'
  return <LabeledInputField key={field.key} type={inputType} label={field.label} required={field.required} value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder={field.placeholder} min={field.kind === 'number' ? field.min : undefined} step={field.kind === 'number' ? field.step : undefined} inputMode={field.kind === 'date' ? field.inputMode : undefined} disabled={field.disabled} />
}

// eslint-disable-next-line react-refresh/only-export-components -- Shared JSX helpers keep the modal call sites small without affecting runtime behavior.
export const renderModalFieldRow = (fields: ModalFieldConfig[], compact = false) => <ModalFieldGrid compact={compact}>{fields.map(renderModalField)}</ModalFieldGrid>

type EditorActionTone = AdminButtonTone

interface EditorAction {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: EditorActionTone
}

export function EditorActions({ actions, centered = false }: { actions: EditorAction[]; centered?: boolean }) {
  return (
    <div className="editor-actions" style={centered ? { justifyContent: 'center' } : undefined}>
      {actions.map((action, index) => (
        <AdminButton
          key={`${action.tone ?? 'primary'}-${action.label}-${index}`}
          tone={action.tone}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </AdminButton>
      ))}
    </div>
  )
}

export function EditorSubmitActions({
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  submitTone = 'primary',
  cancelLabel = 'Cancel',
}: {
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
  submitLabel: string
  submittingLabel: string
  submitTone?: EditorActionTone
  cancelLabel?: string
}) {
  return (
    <EditorActions
      actions={[
        { label: cancelLabel, tone: 'secondary', onClick: onClose, disabled: submitting },
        { label: submitting ? submittingLabel : submitLabel, tone: submitTone, onClick: onSubmit, disabled: submitting },
      ]}
    />
  )
}

export function InlineSubmitEditor({
  error = '',
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  submitTone,
  cancelLabel,
  children,
  ...props
}: Omit<InlineEditorProps, 'children' | 'onClose'> & {
  error?: string
  onClose: () => void
  onSubmit: () => void
  submitting: boolean
  submitLabel: string
  submittingLabel: string
  submitTone?: EditorActionTone
  cancelLabel?: string
  children: ReactNode
}) {
  return (
    <InlineEditor {...props} onClose={onClose} disableClose={submitting}>
      <InlineErrorBanner message={error} />
      {children}
      <EditorSubmitActions
        onClose={onClose}
        onSubmit={onSubmit}
        submitting={submitting}
        submitLabel={submitLabel}
        submittingLabel={submittingLabel}
        submitTone={submitTone}
        cancelLabel={cancelLabel}
      />
    </InlineEditor>
  )
}

export function InlineRepeaterField<T extends { key: string }>({
  label,
  rows,
  rowClassName,
  addLabel,
  addButtonId,
  disabled = false,
  onAddRow,
  renderRow,
}: {
  label: string
  rows: T[]
  rowClassName: string
  addLabel: string
  addButtonId?: string
  disabled?: boolean
  onAddRow: () => void
  renderRow: (row: T, index: number) => ReactNode
}) {
  return (
    <InlineField label={label}>
      {rows.map((row, index) => (
        <div key={row.key} className={cx('content-row', rowClassName)}>
          {renderRow(row, index)}
        </div>
      ))}
      <AdminButton
        id={addButtonId}
        tone="secondary"
        size="sm"
        className="admin-inline-add-row-btn"
        onClick={onAddRow}
        disabled={disabled}
      >
        {addLabel}
      </AdminButton>
    </InlineField>
  )
}

interface InlineDetailsTableColumn<T> {
  header: string
  renderCell: (row: T) => ReactNode
}

export function InlineDetailsTable<T>({
  columns,
  rows,
  emptyMessage,
  rowKey,
}: {
  columns: InlineDetailsTableColumn<T>[]
  rows: T[]
  emptyMessage: string
  rowKey: (row: T) => string
}) {
  return (
    <div className="table-wrapper admin-details-table">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.header}>{column.renderCell(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="admin-table-message-cell">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
