import { Plus, X, AlertCircle } from "@/shared/ui/InlineIcons";
import {
  Field,
  FormPanel,
  InlineFeedback,
} from "@/shared/ui/FormPrimitives";
import {
  ActionButton,
  PublicBanner,
} from "@/shared/ui/PublicPagePatterns";
import {
  type DonationRow,
  type LowStockItem,
  type SupermarketLowStockItem,
  type SupermarketPageModel,
} from "./Supermarket";
import styles from "./Supermarket.module.css";

interface LowStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SupermarketLowStockItem[];
  isLoading: boolean;
  onAddToForm: (item: SupermarketLowStockItem) => void;
  onDismissItem: (itemId: number) => void;
}

function LowStockModal({
  isOpen,
  onClose,
  items,
  isLoading,
  onAddToForm,
  onDismissItem,
}: LowStockModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Low stock items</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close low stock list"
          >
            <X size={24} />
          </button>
        </div>
        <div className={styles.body}>
          <div className={styles.stack}>
            {isLoading ? (
              <div className={styles.statusMessage}>
                Loading low stock items...
              </div>
            ) : null}
            {!isLoading && items.length === 0 ? (
              <div className={styles.statusMessage}>
                No low stock items right now.
              </div>
            ) : null}
            {!isLoading
              ? items.map((item) => (
                  <div key={item.id} className={styles.itemCard}>
                    <div>
                      <h3 className={styles.itemTitle}>{item.name}</h3>
                      <p className={styles.itemMeta}>
                        Current stock:{" "}
                        <span className={styles.criticalValue}>
                          {item.currentStock}
                        </span>
                        {item.unit ? ` ${item.unit}` : ""} (threshold{" "}
                        {item.threshold}
                        {item.unit ? ` ${item.unit}` : " units"})
                      </p>
                    </div>
                    <div className={styles.actionGroup}>
                      <button
                        type="button"
                        onClick={() => onAddToForm(item)}
                        className={`${styles.iconButton} ${styles.addButton}`}
                        title="Add this inventory item to the donation form"
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissItem(item.id)}
                        className={`${styles.iconButton} ${styles.dismissButton}`}
                        title="Hide this item from the current page"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <p className={styles.modalFooterText}>
            Click + to add a linked low-stock item to the donation form.
            Dismiss only hides an item on this page and does not change the
            database.
          </p>
        </div>
      </div>
    </div>
  );
}

interface LowStockBannerProps {
  items: SupermarketLowStockItem[];
  onViewFullList: () => void;
  onDismiss: () => void;
}

function LowStockBanner({
  items,
  onViewFullList,
  onDismiss,
}: LowStockBannerProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <PublicBanner
      tone="error"
      split
      className={styles.lowStockBanner}
      icon={<AlertCircle size={22} className={styles.bannerIcon} />}
      title="Low stock alert: items at your local food bank may need support"
      actions={
        <>
          <ActionButton
            onClick={onViewFullList}
            className={styles.viewButton}
          >
            View Full List
          </ActionButton>
          <ActionButton
            onClick={onDismiss}
            tone="ghost"
            className={styles.dismissAlertButton}
          >
            Dismiss Alert
          </ActionButton>
        </>
      }
      actionsClassName={styles.bannerActions}
    />
  );
}

function DonationRowEditor({
  row,
  items,
  canRemove,
  loading,
  onUpdateFoodName,
  onUpdateQuantity,
  onRemove,
}: {
  row: DonationRow;
  items: LowStockItem[];
  canRemove: boolean;
  loading: boolean;
  onUpdateFoodName: (foodName: string) => void;
  onUpdateQuantity: (quantity: string) => void;
  onRemove: () => void;
}) {
  const selectedItem =
    items.find((item) => item.id === row.inventoryItemId) ?? null;

  return (
    <div className={styles.rowEditor}>
      <Field
        label="Food Name"
        required
        className={styles.fieldGroup}
        labelClassName={styles.fieldLabel}
        requiredClassName={styles.requiredMark}
        helperText={
          selectedItem
            ? `Current stock ${selectedItem.current_stock}${selectedItem.unit}, threshold ${selectedItem.threshold}${selectedItem.unit}.`
            : "Use the low stock modal or enter the exact food name from inventory."
        }
        helperTextClassName={styles.fieldHelp}
      >
        <input
          type="text"
          value={row.foodName}
          onChange={(event) => onUpdateFoodName(event.target.value)}
          className={styles.fieldInput}
          placeholder="Use low stock list or exact food name"
          disabled={loading}
        />
      </Field>
      <Field
        label="Donation Quantity"
        required
        className={styles.fieldGroup}
        labelClassName={styles.fieldLabel}
        requiredClassName={styles.requiredMark}
      >
        <input
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          value={row.quantity}
          onChange={(event) => onUpdateQuantity(event.target.value)}
          className={styles.fieldInput}
          placeholder="Quantity"
          disabled={loading}
        />
      </Field>
      <div className={styles.removeButtonWrap}>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={loading}
            className={styles.removeButton}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SupermarketDonationForm({
  model,
}: {
  model: SupermarketPageModel;
}) {
  const {
    formError,
    isLoadingLowStock,
    isModalOpen,
    isSubmittingDonation,
    lowStockItems,
    modalItems,
    pageError,
    rows,
    showEmptyBanner,
    showLowStockBanner,
    addLowStockItemToForm,
    addRow,
    closeModal,
    dismissBanner,
    dismissModalItem,
    handleSubmit,
    openModal,
    removeRow,
    updateRowFoodName,
    updateRowQuantity,
  } = model;

  return (
    <>
      <div className={styles.pageContainer}>
        <div className={styles.card}>
          {showLowStockBanner ? (
            <LowStockBanner
              items={modalItems}
              onViewFullList={openModal}
              onDismiss={dismissBanner}
            />
          ) : null}
          {pageError ? (
            <InlineFeedback
              tone="error"
              message={pageError}
              role="alert"
              ariaLive="polite"
              className={styles.inlineBanner}
            />
          ) : null}
          <InlineFeedback
            tone="info"
            message="Submissions from this page are saved as pending supermarket donations. Your food bank admin will review and receive them from Inventory Management before stock is updated."
            role="status"
            ariaLive="polite"
            className={styles.inlineBanner}
          />
          {showEmptyBanner ? (
            <InlineFeedback
              tone="info"
              message="No low-stock items right now. You can still submit a donation using the exact food name and quantity."
              role="status"
              ariaLive="polite"
              className={styles.inlineBanner}
            />
          ) : null}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Donation Form</h1>
            <div className={styles.titleUnderline}></div>
          </div>
          {formError ? (
            <InlineFeedback
              tone="error"
              message={formError}
              role="alert"
              ariaLive="polite"
              className={styles.inlineBanner}
            />
          ) : null}
          <FormPanel onSubmit={handleSubmit} noValidate>
            <div className={styles.formStack}>
              {rows.map((row) => (
                <DonationRowEditor
                  key={row.id}
                  row={row}
                  items={lowStockItems}
                  canRemove={rows.length > 1}
                  loading={isSubmittingDonation}
                  onUpdateFoodName={(foodName) =>
                    updateRowFoodName(row.id, foodName)
                  }
                  onUpdateQuantity={(quantity) =>
                    updateRowQuantity(row.id, quantity)
                  }
                  onRemove={() => removeRow(row.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addRow}
              className={styles.addRowButton}
            >
              <Plus size={18} /> Add row
            </button>
            <p className={styles.tipText}>
              Tip: selecting from the low stock list links the row directly to
              the existing inventory record.
            </p>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmittingDonation}
            >
              {isSubmittingDonation ? "Submitting..." : "Submit Donation"}
            </button>
          </FormPanel>
        </div>
      </div>
      <LowStockModal
        isOpen={isModalOpen}
        onClose={closeModal}
        items={modalItems}
        isLoading={isLoadingLowStock}
        onAddToForm={addLowStockItemToForm}
        onDismissItem={dismissModalItem}
      />
    </>
  );
}
