import type { InventoryItem } from "@/shared/types/inventory";
import adminStyles from "./admin.module.css";
import type {
  InventoryEditorDraft,
  InventoryStockInDraft,
  LotExpiryTarget,
  PackageEditorDraft,
  PackageEditorRowDraft,
  PackingStockCheckRow,
} from "./adminFoodManagement.types";
import { AdminButton } from "./chrome";
import {
  AdminInlineFeedback,
  AdminSubmitModalShell,
  bindDraftField,
  bindRowField,
  buildLabelOptions,
  buildNamedOptions,
  normalizeSelectNumber,
  InlineInput,
  InlineModalField,
  InlineModalFieldRow,
  InlineRepeaterField,
  InlineSelect,
} from "./modalBits.editors.containers";

function PackageContentsField({
  rows,
  inventoryItems,
  disabled,
  onRowChange,
  onAddRow,
  onRemoveRow,
}: {
  rows: PackageEditorDraft["contents"];
  inventoryItems: InventoryItem[];
  disabled: boolean;
  onRowChange: (
    key: string,
    field: keyof Omit<PackageEditorRowDraft, "key">,
    value: string,
  ) => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
}) {
  // Package contents stay in string form inside the draft until submit so the
  // repeater can treat selects and number inputs as one controlled shape.
  const inventoryOptions = buildNamedOptions(inventoryItems);

  return (
    <InlineRepeaterField
      label="Contents"
      rows={rows}
      rowVariant="package"
      addLabel="+ Add Row"
      addButtonId="add-package-item-btn"
      disabled={disabled}
      onAddRow={onAddRow}
      renderRow={(row) => (
        <>
          <InlineSelect
            value={row.itemId}
            onChange={(event) =>
              bindRowField(onRowChange, row.key, "itemId")(event.target.value)
            }
            disabled={disabled}
          >
            <option value="">Select item</option>
            {inventoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </InlineSelect>
          <InlineInput
            type="number"
            min={1}
            step={1}
            value={row.quantity}
            onChange={(event) =>
              bindRowField(onRowChange, row.key, "quantity")(event.target.value)
            }
            disabled={disabled}
          />
          <AdminButton
            tone="secondary"
            size="sm"
            className="remove-package-item-btn"
            onClick={() => onRemoveRow(row.key)}
            disabled={disabled || rows.length === 1}
          >
            {" "}
            Remove
          </AdminButton>
        </>
      )}
    />
  );
}

// The packing preview shows per-pack requirements so admins can still change
// the final quantity without the explanation text going stale on every keystroke.
const renderPackingStockCheck = (
  loadingStockCheck: boolean,
  stockCheckRows: PackingStockCheckRow[],
) =>
  loadingStockCheck ? (
    <p className={adminStyles["admin-inline-message-line"]}>
      {" "}
      Loading package requirements...
    </p>
  ) : stockCheckRows.length === 0 ? (
    <p className={adminStyles["admin-inline-message-line"]}>
      {" "}
      Select a package to review stock requirements.
    </p>
  ) : (
    <>
      {stockCheckRows.map((row) => (
        <p key={row.itemId} className={adminStyles["admin-inline-message-line"]}>
          {row.name}: {row.availableQuantity}
          {row.unit} available / {row.requiredQuantity} required per pack
        </p>
      ))}
    </>
  );

export function InventoryItemEditorModal({
  id,
  isOpen,
  isEditing,
  draft,
  error,
  submitting,
  categoryOptions,
  onClose,
  onFieldChange,
  onSubmit,
}: {
  id: string;
  isOpen: boolean;
  isEditing: boolean;
  draft: InventoryEditorDraft;
  error: string;
  submitting: boolean;
  categoryOptions: string[];
  onClose: () => void;
  onFieldChange: (field: keyof InventoryEditorDraft, value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const selectOptions = buildLabelOptions(categoryOptions);

  return (
    <AdminSubmitModalShell
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Item" : "Add New Item"}
      error={error}
      submitting={submitting}
      onSubmit={onSubmit}
      submitLabel={isEditing ? "Save Item" : "Add Item"}
      submittingLabel="Saving..."
    >
      <InlineModalField
        field={{
          key: "name",
          kind: "text",
          label: "Item Name",
          value: draft.name,
          onChange: bindDraftField(onFieldChange, "name"),
          placeholder: "e.g. Rice, Pasta",
          disabled: submitting,
        }}
      />
      <InlineModalFieldRow
        fields={[
          {
            key: "category",
            kind: "select",
            label: "Category",
            value: draft.category,
            onChange: bindDraftField(onFieldChange, "category"),
            options: selectOptions,
            placeholder: "Select category",
            disabled: submitting,
          },
          {
            key: "unit",
            kind: "text",
            label: "Unit",
            value: draft.unit,
            onChange: bindDraftField(onFieldChange, "unit"),
            placeholder: "e.g. bags, cans, cartons",
            disabled: submitting,
          },
        ]}
      />
      <InlineModalField
        field={{
          key: "threshold",
          kind: "number",
          label: "Safety Threshold",
          value: draft.threshold,
          onChange: bindDraftField(onFieldChange, "threshold"),
          placeholder: "0",
          min: 0,
          step: 1,
          disabled: submitting,
        }}
      />
    </AdminSubmitModalShell>
  );
}

export function InventoryStockInModal({
  isOpen,
  itemName,
  draft,
  error,
  submitting,
  onClose,
  onFieldChange,
  onSubmit,
}: {
  isOpen: boolean;
  itemName: string;
  draft: InventoryStockInDraft;
  error: string;
  submitting: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof InventoryStockInDraft, value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <AdminSubmitModalShell
      id="stock-in-editor"
      isOpen={isOpen}
      onClose={onClose}
      title="Stock In Item"
      error={error}
      submitting={submitting}
      onSubmit={onSubmit}
      submitLabel="Apply Stock In"
      submittingLabel="Saving..."
    >
      <InlineModalField
        field={{
          key: "itemName",
          kind: "readonly",
          label: "Item Name",
          value: itemName,
        }}
      />
      <InlineModalFieldRow
        fields={[
          {
            key: "quantity",
            kind: "number",
            label: "Quantity",
            value: draft.quantity,
            onChange: bindDraftField(onFieldChange, "quantity"),
            min: 1,
            step: 1,
            disabled: submitting,
          },
          {
            key: "expiryDate",
            kind: "date",
            label: "Expiry Date",
            value: draft.expiryDate,
            onChange: bindDraftField(onFieldChange, "expiryDate"),
            placeholder: "DD/MM/YYYY",
            inputMode: "numeric",
            disabled: submitting,
          },
        ]}
      />
    </AdminSubmitModalShell>
  );
}

export function LotExpiryModal({
  isOpen,
  target,
  expiryValue,
  error,
  submitting,
  onClose,
  onExpiryChange,
  onSubmit,
}: {
  isOpen: boolean;
  target: LotExpiryTarget | null;
  expiryValue: string;
  error: string;
  submitting: boolean;
  onClose: () => void;
  onExpiryChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  if (!isOpen || !target) {
    return null;
  }

  return (
    <AdminSubmitModalShell
      id="edit-lot-editor"
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Lot Expiry"
      error={error}
      submitting={submitting}
      onSubmit={onSubmit}
      submitLabel="Save Expiry"
      submittingLabel="Saving..."
    >
      <InlineModalField
        field={{
          key: "itemName",
          kind: "readonly",
          label: "Item Name",
          value: target.itemName,
        }}
      />
      <InlineModalFieldRow
        fields={[
          {
            key: "lotNumber",
            kind: "readonly",
            label: "Lot Number",
            value: target.lotNumber,
          },
          {
            key: "quantity",
            kind: "readonly",
            label: "Remaining Stock",
            value: String(target.quantity),
          },
        ]}
      />
      <InlineModalField
        field={{
          key: "expiryDate",
          kind: "date",
          label: "Expiry Date",
          value: expiryValue,
          onChange: onExpiryChange,
          inputMode: "numeric",
          disabled: submitting,
        }}
      />
    </AdminSubmitModalShell>
  );
}

export function PackageEditorModal({
  id,
  isOpen,
  isEditing,
  draft,
  inventoryItems,
  error,
  submitting,
  categoryOptions,
  onClose,
  onFieldChange,
  onRowChange,
  onAddRow,
  onRemoveRow,
  onSubmit,
}: {
  id: string;
  isOpen: boolean;
  isEditing: boolean;
  draft: PackageEditorDraft;
  inventoryItems: InventoryItem[];
  error: string;
  submitting: boolean;
  categoryOptions: string[];
  onClose: () => void;
  onFieldChange: (
    field: keyof Omit<PackageEditorDraft, "contents">,
    value: string,
  ) => void;
  onRowChange: (
    key: string,
    field: keyof Omit<PackageEditorRowDraft, "key">,
    value: string,
  ) => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const categorySelectOptions = buildLabelOptions(categoryOptions);

  return (
    <AdminSubmitModalShell
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Package" : "Add New Package"}
      error={error}
      submitting={submitting}
      onSubmit={onSubmit}
      submitLabel={isEditing ? "Save Package" : "Add Package"}
      submittingLabel="Saving..."
    >
      <InlineModalField
        field={{
          key: "name",
          kind: "text",
          label: "Package Name",
          value: draft.name,
          onChange: bindDraftField(onFieldChange, "name"),
          placeholder: "e.g. Emergency Pack A",
          disabled: submitting,
        }}
      />
      <InlineModalFieldRow
        fields={[
          {
            key: "category",
            kind: "select",
            label: "Category",
            value: draft.category,
            onChange: bindDraftField(onFieldChange, "category"),
            options: categorySelectOptions,
            placeholder: "Select category",
            disabled: submitting,
          },
          {
            key: "threshold",
            kind: "number",
            label: "Safety Threshold",
            value: draft.threshold,
            onChange: bindDraftField(onFieldChange, "threshold"),
            min: 0,
            step: 1,
            disabled: submitting,
          },
        ]}
        compact
      />
      <PackageContentsField
        rows={draft.contents}
        inventoryItems={inventoryItems}
        disabled={submitting}
        onRowChange={onRowChange}
        onAddRow={onAddRow}
        onRemoveRow={onRemoveRow}
      />
    </AdminSubmitModalShell>
  );
}

export function PackingModal({
  isOpen,
  packages,
  selectedPackageId,
  quantity,
  stockCheckRows,
  feedback,
  loadingStockCheck,
  submitting,
  onClose,
  onPackageChange,
  onQuantityChange,
  onSubmit,
}: {
  isOpen: boolean;
  packages: Array<{ id: string | number; name: string }>;
  selectedPackageId: number | "";
  quantity: string;
  stockCheckRows: PackingStockCheckRow[];
  feedback: string;
  loadingStockCheck: boolean;
  submitting: boolean;
  onClose: () => void;
  onPackageChange: (value: number | "") => void;
  onQuantityChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const packageOptions = buildNamedOptions(packages);

  return (
    <AdminSubmitModalShell
      id="packing-editor"
      isOpen={isOpen}
      onClose={onClose}
      title="Package Packing Operation"
      submitting={submitting}
      onSubmit={onSubmit}
      submitLabel="Submit Packing"
      submittingLabel="Packing..."
    >
      <InlineModalField
        field={{
          key: "packageId",
          kind: "select",
          label: "Select Package",
          value: selectedPackageId,
          onChange: (value) => onPackageChange(normalizeSelectNumber(value)),
          options: packageOptions,
          placeholder: "Select a package",
          disabled: submitting,
        }}
      />
      <AdminInlineFeedback tone="warning" title="Package Contents & Stock Check">
        {renderPackingStockCheck(loadingStockCheck, stockCheckRows)}
      </AdminInlineFeedback>
      <InlineModalField
        field={{
          key: "quantity",
          kind: "number",
          label: "Pack Quantity",
          value: quantity,
          onChange: onQuantityChange,
          min: 1,
          step: 1,
          disabled: submitting,
        }}
      />
      {feedback ? (
        <p className={adminStyles["admin-plain-feedback"]}>{feedback}</p>
      ) : null}
    </AdminSubmitModalShell>
  );
}
