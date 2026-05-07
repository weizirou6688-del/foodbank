/* eslint-disable react-refresh/only-export-components */
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { cn } from "@/shared/lib/cn";
import { AdminButton, type AdminButtonTone } from "./chrome";
import adminStyles from "./admin.module.css";
interface InlineEditorProps {
  id: string;
  isOpen: boolean;
  title: string;
  onClose: () => void;
  disableClose?: boolean;
  children: ReactNode;
}
type EditorActionTone = AdminButtonTone;
interface EditorAction {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tone?: EditorActionTone;
}
interface InlineConfirmModalProps {
  id: string;
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  submitting?: boolean;
  confirmTone?: "danger" | "primary";
}
type InlineSubmitEditorProps = Omit<
  InlineEditorProps,
  "children" | "onClose"
> & {
  error?: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  submitTone?: EditorActionTone;
  cancelLabel?: string;
  children: ReactNode;
};
export interface SelectFieldOption {
  value: string | number;
  label: string;
}
export const buildLabelOptions = (options: string[]): SelectFieldOption[] =>
  options.map((option) => ({ value: option, label: option }));
export const buildNamedOptions = (
  options: Array<{ id: string | number; name: string }>,
): SelectFieldOption[] =>
  options.map((option) => ({ value: option.id, label: option.name }));
// These binders let modal sections describe fields declaratively while still
// updating either flat drafts or repeater rows with the same input components.
export const bindDraftField =
  <TField extends string>(
    onFieldChange: (field: TField, value: string) => void,
    field: TField,
  ) =>
  (value: string) =>
    onFieldChange(field, value);
export const bindRowField =
  <TField extends string>(
    onRowChange: (key: string, field: TField, value: string) => void,
    key: string,
    field: TField,
  ) =>
  (value: string) =>
    onRowChange(key, field, value);
export const normalizeSelectNumber = (value: string) => {
  const nextValue = Number(value);
  return Number.isNaN(nextValue) || nextValue <= 0 ? "" : nextValue;
};
type InteractiveFieldConfig = {
  key: string;
  label: string;
  value: string | number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};
export type ModalFieldConfig =
  | (InteractiveFieldConfig & { kind: "text" | "email" })
  | (InteractiveFieldConfig & { kind: "number"; min?: number; step?: number })
  | (InteractiveFieldConfig & {
      kind: "date";
      inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
    })
  | (InteractiveFieldConfig & { kind: "select"; options: SelectFieldOption[] })
  | { key: string; kind: "readonly"; label: string; value: string };
export function AdminInlineFeedback({
  tone = "default",
  title,
  children,
}: {
  tone?: "default" | "success" | "warning" | "error";
  title?: string;
  children: ReactNode;
}) {
  if (tone === "error") {
    return (
      <div
        className={adminStyles["admin-plain-error"]}
        role="alert"
        aria-live="polite"
      >
        {title ? (
          <p className={adminStyles["admin-plain-error-title"]}>{title}</p>
        ) : null}
        <div className={adminStyles["admin-plain-error-body"]}>{children}</div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        adminStyles["admin-inline-message"],
        adminStyles[`admin-inline-message--${tone}`],
      )}
    >
      {title ? (
        <p className={adminStyles["admin-inline-message-title"]}>{title}</p>
      ) : null}
      <div className={adminStyles["admin-inline-message-body"]}>{children}</div>
    </div>
  );
}
function InlineErrorBanner({ message }: { message: string }) {
  return message ? (
    <AdminInlineFeedback tone="error">{message}</AdminInlineFeedback>
  ) : null;
}
export function EditorActions({
  actions,
  centered = false,
}: {
  actions: EditorAction[];
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        adminStyles["editor-actions"],
        centered && adminStyles["editor-actions--centered"],
      )}
    >
      {actions.map((action, index) => (
        <AdminButton
          key={`${action.tone ?? "primary"}-${action.label}-${index}`}
          tone={action.tone}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </AdminButton>
      ))}
    </div>
  );
}
function EditorSubmitActions({
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  submitTone = "primary",
  cancelLabel = "Cancel",
}: {
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  submitTone?: EditorActionTone;
  cancelLabel?: string;
}) {
  return (
    <EditorActions
      actions={[
        {
          label: cancelLabel,
          tone: "secondary",
          onClick: onClose,
          disabled: submitting,
        },
        {
          label: submitting ? submittingLabel : submitLabel,
          tone: submitTone,
          onClick: onSubmit,
          disabled: submitting,
        },
      ]}
    />
  );
}
export function AdminConfirmModalShell({
  id,
  isOpen,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  submitting = false,
  confirmTone = "danger",
}: InlineConfirmModalProps) {
  if (!isOpen) {
    return null;
  }
  return (
    <div
      id={id}
      className={cn(adminStyles["inline-confirm"], adminStyles.visible)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`} className={adminStyles["confirm-title"]}>
        {title}
      </h3>
      <p className={adminStyles["confirm-desc"]}>{description}</p>
      <EditorActions
        centered
        actions={[
          {
            label: "Cancel",
            tone: "secondary",
            onClick: onClose,
            disabled: submitting,
          },
          {
            label: submitting ? "Working..." : confirmLabel,
            tone: confirmTone,
            onClick: onConfirm,
            disabled: submitting,
          },
        ]}
      />
    </div>
  );
}
function InlineField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={adminStyles["form-group"]}>
      <label className={adminStyles["form-label"]}>
        {label}
        {required ? (
          <span className={adminStyles["required-mark"]}> *</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}
export function InlineInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "className">,
) {
  return <input {...props} className={adminStyles["form-input"]} />;
}
export function InlineSelect(
  props: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">,
) {
  return <select {...props} className={adminStyles["form-select"]} />;
}
type LabeledInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
};
function LabeledInputField({
  label,
  required = false,
  ...props
}: LabeledInputProps) {
  return (
    <InlineField label={label} required={required}>
      <InlineInput {...props} />
    </InlineField>
  );
}
function SelectField({
  label,
  required = false,
  options,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  required?: boolean;
  options: SelectFieldOption[];
  placeholder?: string;
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
  );
}
function ModalFieldGrid({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={
        compact ? adminStyles["inline-form-row"] : adminStyles["form-grid"]
      }
    >
      {children}
    </div>
  );
}
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <LabeledInputField
      type="text"
      label={label}
      value={value}
      disabled
      readOnly
    />
  );
}
function renderModalFieldContent(field: ModalFieldConfig) {
  // Date inputs stay as text fields with numeric hints because the admin UI
  // standardises on DD/MM/YYYY rather than browser-locale date pickers.
  if (field.kind === "readonly") {
    return <ReadonlyField label={field.label} value={field.value} />;
  }
  if (field.kind === "select") {
    return (
      <SelectField
        label={field.label}
        required={field.required}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        options={field.options}
        placeholder={field.placeholder}
        disabled={field.disabled}
      />
    );
  }
  const inputType =
    field.kind === "number"
      ? "number"
      : field.kind === "email"
        ? "email"
        : "text";
  return (
    <LabeledInputField
      type={inputType}
      label={field.label}
      required={field.required}
      value={field.value}
      onChange={(event) => field.onChange(event.target.value)}
      placeholder={field.placeholder}
      min={field.kind === "number" ? field.min : undefined}
      step={field.kind === "number" ? field.step : undefined}
      inputMode={field.kind === "date" ? field.inputMode : undefined}
      disabled={field.disabled}
    />
  );
}
export function InlineModalField({ field }: { field: ModalFieldConfig }) {
  return renderModalFieldContent(field);
}
export function InlineModalFieldRow({
  fields,
  compact = false,
}: {
  fields: ModalFieldConfig[];
  compact?: boolean;
}) {
  return (
    <ModalFieldGrid compact={compact}>
      {fields.map((field) => (
        <InlineModalField key={field.key} field={field} />
      ))}
    </ModalFieldGrid>
  );
}
export function InlineRepeaterField<T extends { key: string }>({
  label,
  rows,
  rowVariant,
  addLabel,
  addButtonId,
  disabled = false,
  onAddRow,
  renderRow,
}: {
  label: string;
  rows: T[];
  rowVariant: "donation" | "package";
  addLabel: string;
  addButtonId?: string;
  disabled?: boolean;
  onAddRow: () => void;
  renderRow: (row: T, index: number) => ReactNode;
}) {
  return (
    <InlineField label={label}>
      {rows.map((row, index) => (
        <div
          key={row.key}
          className={cn(
            adminStyles["content-row"],
            rowVariant === "donation" && adminStyles["donation-item-row"],
            rowVariant === "package" && adminStyles["package-item-row"],
          )}
        >
          {renderRow(row, index)}
        </div>
      ))}
      <AdminButton
        id={addButtonId}
        tone="secondary"
        size="sm"
        className={adminStyles["admin-inline-add-row-btn"]}
        onClick={onAddRow}
        disabled={disabled}
      >
        {addLabel}
      </AdminButton>
    </InlineField>
  );
}
interface InlineDetailsTableColumn<T> {
  header: string;
  renderCell: (row: T) => ReactNode;
}
export function AdminDetailsTable<T>({
  columns,
  rows,
  emptyMessage,
  rowKey,
}: {
  columns: InlineDetailsTableColumn<T>[];
  rows: T[];
  emptyMessage: string;
  rowKey: (row: T) => string;
}) {
  return (
    <div
      className={cn(
        adminStyles["table-wrapper"],
        adminStyles["admin-details-table"],
      )}
    >
      <table className={adminStyles["data-table"]}>
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
              <td
                colSpan={columns.length}
                className={adminStyles["admin-table-message-cell"]}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function AdminModalShell({
  id,
  isOpen,
  title,
  onClose,
  disableClose = false,
  children,
}: InlineEditorProps) {
  if (!isOpen) {
    return null;
  }
  return (
    <div
      id={id}
      className={cn(adminStyles["inline-editor"], adminStyles.visible)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <div className={adminStyles["editor-header"]}>
        <h3 id={`${id}-title`} className={adminStyles["editor-title"]}>
          {title}
        </h3>
        <button
          type="button"
          className={adminStyles["editor-close"]}
          onClick={onClose}
          disabled={disableClose}
          aria-label="Close editor"
        >
          &times;
        </button>
      </div>
      {children}
    </div>
  );
}
export function AdminSubmitModalShell({
  error = "",
  onClose,
  onSubmit,
  submitting,
  submitLabel,
  submittingLabel,
  submitTone,
  cancelLabel,
  children,
  ...props
}: InlineSubmitEditorProps) {
  return (
    <AdminModalShell {...props} onClose={onClose} disableClose={submitting}>
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
    </AdminModalShell>
  );
}

export const InlineMessagePanel = AdminInlineFeedback;
export const InlineConfirmModal = AdminConfirmModalShell;
export const InlineDetailsTable = AdminDetailsTable;
export const InlineEditor = AdminModalShell;
export const InlineSubmitEditor = AdminSubmitModalShell;
