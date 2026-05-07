import type { DonationListRow } from "@/shared/types/donations";
import adminStyles from "./admin.module.css";
import type {
  DonationEditorDraft,
  DonationEditorItemDraft,
} from "./adminFoodManagement.types";
import { AdminButton } from "./chrome";
import { buildDonationDisplayId } from "./formatting";
import {
  buildDonationDetailsRows,
  getDonationDonorTypeLabel,
  getDonationStatusLabel,
} from "./rules";
import {
  AdminDetailsTable,
  AdminModalShell,
  AdminSubmitModalShell,
  bindDraftField,
  bindRowField,
  buildLabelOptions,
  EditorActions,
  InlineInput,
  InlineModalFieldRow,
  InlineRepeaterField,
  InlineSelect,
  type ModalFieldConfig,
  type SelectFieldOption,
} from "./modalBits.editors.containers";

const DONOR_TYPE_OPTIONS: SelectFieldOption[] = [
  { value: "supermarket", label: "Supermarket" },
  { value: "individual", label: "Individual" },
  { value: "organization", label: "Organization" },
];

// Reuse the same display helpers as the table view so cash and goods donations
// keep consistent labels across summary rows and detail modals.
const buildDonationSummaryRows = (
  donation: DonationListRow,
): ModalFieldConfig[][] => [
  [
    {
      key: "donationId",
      kind: "readonly",
      label: "Donation ID",
      value: buildDonationDisplayId(donation),
    },
    {
      key: "status",
      kind: "readonly",
      label: "Status",
      value: getDonationStatusLabel(donation),
    },
  ],
  [
    {
      key: "donorType",
      kind: "readonly",
      label: "Donor Type",
      value: getDonationDonorTypeLabel(donation),
    },
    {
      key: "donorName",
      kind: "readonly",
      label: "Donor Name",
      value: donation.donor_name ?? "Anonymous",
    },
  ],
];

function DonationDetailsSummary({ donation }: { donation: DonationListRow }) {
  return (
    <>
      {buildDonationSummaryRows(donation).map((fields, rowIndex) => (
        <InlineModalFieldRow
          key={`donation-details-${rowIndex}`}
          fields={fields}
        />
      ))}
    </>
  );
}

function DonationDetailsItems({ donation }: { donation: DonationListRow }) {
  const detailRows = buildDonationDetailsRows(donation);

  return (
    <div className={adminStyles["form-group"]}>
      <label className={adminStyles["form-label"]}>Donation Items</label>
      <AdminDetailsTable
        columns={[
          { header: "Item Name", renderCell: (row) => row.name },
          { header: "Quantity", renderCell: (row) => row.quantityLabel },
          { header: "Expiry Date", renderCell: (row) => row.expiryLabel },
        ]}
        rows={detailRows}
        emptyMessage="No item rows."
        rowKey={(row) => `${row.name}-${row.quantityLabel}`}
      />
    </div>
  );
}

function DonationEditorFields({
  draft,
  submitting,
  onFieldChange,
}: {
  draft: DonationEditorDraft;
  submitting: boolean;
  onFieldChange: (
    field: keyof Omit<DonationEditorDraft, "items">,
    value: string,
  ) => void;
}) {
  return (
    <>
      <InlineModalFieldRow
        fields={[
          {
            key: "donorType",
            kind: "select",
            label: "Donor Type",
            required: true,
            value: draft.donorType,
            placeholder: "Select donor type",
            options: DONOR_TYPE_OPTIONS,
            onChange: bindDraftField(onFieldChange, "donorType"),
            disabled: submitting,
          },
          {
            key: "donorName",
            kind: "text",
            label: "Donor Name",
            required: true,
            value: draft.donorName,
            placeholder: "Donor full name",
            onChange: bindDraftField(onFieldChange, "donorName"),
            disabled: submitting,
          },
        ]}
      />
      <InlineModalFieldRow
        fields={[
          {
            key: "donorEmail",
            kind: "email",
            label: "Contact Email",
            required: true,
            value: draft.donorEmail,
            placeholder: "Email address",
            onChange: bindDraftField(onFieldChange, "donorEmail"),
            disabled: submitting,
          },
          {
            key: "receivedDate",
            kind: "date",
            label: "Received Date",
            required: true,
            value: draft.receivedDate,
            placeholder: "DD/MM/YYYY",
            onChange: bindDraftField(onFieldChange, "receivedDate"),
            inputMode: "numeric",
            disabled: submitting,
          },
        ]}
      />
    </>
  );
}

function DonationItemRow({
  item,
  index,
  itemCount,
  itemOptions,
  disabled,
  onItemChange,
  onRemoveItem,
}: {
  item: DonationEditorItemDraft;
  index: number;
  itemCount: number;
  itemOptions: string[];
  disabled: boolean;
  onItemChange: (
    key: string,
    field: keyof Omit<DonationEditorItemDraft, "key">,
    value: string,
  ) => void;
  onRemoveItem: (key: string) => void;
}) {
  const options = buildLabelOptions(itemOptions);

  return (
    <>
      <InlineSelect
        value={item.itemName}
        onChange={(event) =>
          bindRowField(onItemChange, item.key, "itemName")(event.target.value)
        }
        disabled={disabled}
      >
        <option value="">Select item</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </InlineSelect>
      <InlineInput
        aria-label={`Quantity ${index + 1}`}
        type="number"
        min={1}
        step={1}
        value={item.quantity}
        onChange={(event) =>
          bindRowField(onItemChange, item.key, "quantity")(event.target.value)
        }
        disabled={disabled}
      />
      <InlineInput
        aria-label={`Expiry Date ${index + 1}`}
        type="text"
        value={item.expiryDate}
        onChange={(event) =>
          bindRowField(onItemChange, item.key, "expiryDate")(event.target.value)
        }
        placeholder="DD/MM/YYYY"
        inputMode="numeric"
        disabled={disabled}
      />
      <AdminButton
        tone="secondary"
        size="sm"
        className="remove-item-btn"
        onClick={() => onRemoveItem(item.key)}
        disabled={disabled || itemCount === 1}
      >
        {" "}
        Remove
      </AdminButton>
    </>
  );
}

function DonationItemsField({
  items,
  itemOptions,
  disabled,
  onItemChange,
  onAddItem,
  onRemoveItem,
}: {
  items: DonationEditorDraft["items"];
  itemOptions: string[];
  disabled: boolean;
  onItemChange: (
    key: string,
    field: keyof Omit<DonationEditorItemDraft, "key">,
    value: string,
  ) => void;
  onAddItem: () => void;
  onRemoveItem: (key: string) => void;
}) {
  // Manual intake stays item-name based because staff may record goods before
  // they are mapped into a specific inventory catalogue entry.
  return (
    <InlineRepeaterField
      label="Donation Items"
      rows={items}
      rowVariant="donation"
      addLabel="+ Add Row"
      addButtonId="add-item-btn"
      disabled={disabled}
      onAddRow={onAddItem}
      renderRow={(item, index) => (
        <DonationItemRow
          item={item}
          index={index}
          itemCount={items.length}
          itemOptions={itemOptions}
          disabled={disabled}
          onItemChange={onItemChange}
          onRemoveItem={onRemoveItem}
        />
      )}
    />
  );
}

export function DonationDetailsModal({
  donation,
  isOpen,
  onClose,
}: {
  donation: DonationListRow | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !donation) {
    return null;
  }

  return (
    <AdminModalShell
      id="view-donation-editor"
      isOpen={isOpen}
      onClose={onClose}
      title="Donation Details"
    >
      <DonationDetailsSummary donation={donation} />
      <DonationDetailsItems donation={donation} />
      <EditorActions
        actions={[{ label: "Close", tone: "secondary", onClick: onClose }]}
      />
    </AdminModalShell>
  );
}

export function DonationEditorModal({
  isOpen,
  isEditing,
  draft,
  itemOptions,
  error,
  submitting,
  onClose,
  onFieldChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSubmit,
}: {
  isOpen: boolean;
  isEditing: boolean;
  draft: DonationEditorDraft;
  itemOptions: string[];
  error: string;
  submitting: boolean;
  onClose: () => void;
  onFieldChange: (
    field: keyof Omit<DonationEditorDraft, "items">,
    value: string,
  ) => void;
  onItemChange: (
    key: string,
    field: keyof Omit<DonationEditorItemDraft, "key">,
    value: string,
  ) => void;
  onAddItem: () => void;
  onRemoveItem: (key: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <AdminSubmitModalShell
      id="new-donation-editor"
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Donation" : "New Donation"}
      error={error}
      submitting={submitting}
      onSubmit={onSubmit}
      submitLabel={isEditing ? "Save Donation" : "Submit Donation"}
      submittingLabel="Saving..."
    >
      <DonationEditorFields
        draft={draft}
        submitting={submitting}
        onFieldChange={onFieldChange}
      />
      <DonationItemsField
        items={draft.items}
        itemOptions={itemOptions}
        disabled={submitting}
        onItemChange={onItemChange}
        onAddItem={onAddItem}
        onRemoveItem={onRemoveItem}
      />
    </AdminSubmitModalShell>
  );
}
