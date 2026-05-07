import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useAuthStore } from "@/app/store/authStore";
import { adminAPI } from "@/shared/lib/api/admin";
import { donationsAPI } from "@/shared/lib/api/donations";
import { cn } from "@/shared/lib/cn";
import PublicPageShell from "@/shared/ui/PublicPageShell";
import shellStyles from "@/shared/ui/PublicPageShell.module.css";
import { SupermarketDonationForm } from "./Supermarket.sections";
import styles from "./Supermarket.module.css";

export interface DonationRow {
  id: string;
  foodName: string;
  quantity: string;
  inventoryItemId: number | null;
}

export interface LowStockItem {
  id: number;
  name: string;
  current_stock: number;
  threshold: number;
  unit: string;
}

export interface SupermarketLowStockItem {
  id: number;
  name: string;
  currentStock: number;
  threshold: number;
  unit?: string;
}

const makeId = () =>
  `row_${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

const createRow = (
  foodName = "",
  inventoryItemId: number | null = null,
): DonationRow => ({
  id: makeId(),
  foodName,
  quantity: "",
  inventoryItemId,
});

const asArray = <T,>(value: unknown) =>
  Array.isArray(value) ? (value as T[]) : [];

function useSupermarketPageModel() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [rows, setRows] = useState<DonationRow[]>([createRow()]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [dismissedItemIds, setDismissedItemIds] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false);
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  const clearFormError = () => {
    if (formError) {
      setFormError("");
    }
  };

  const loadLowStock = useCallback(async () => {
    if (!accessToken) {
      setLowStockItems([]);
      return;
    }

    setIsLoadingLowStock(true);
    setPageError("");
    try {
      const data = await adminAPI.getLowStockItems(accessToken);
      setLowStockItems(asArray<LowStockItem>(data));
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Failed to load low stock items.",
      );
      setLowStockItems([]);
    } finally {
      setIsLoadingLowStock(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadLowStock();
  }, [loadLowStock]);

  useEffect(() => {
    if (lowStockItems.length > 0) {
      setIsBannerVisible(true);
    }
    setDismissedItemIds((prev) =>
      prev.filter((itemId) => lowStockItems.some((item) => item.id === itemId)),
    );
  }, [lowStockItems]);

  const visibleLowStockItems = useMemo(
    () => lowStockItems.filter((item) => !dismissedItemIds.includes(item.id)),
    [dismissedItemIds, lowStockItems],
  );

  const modalItems: SupermarketLowStockItem[] = visibleLowStockItems.map(
    (item) => ({
      id: item.id,
      name: item.name,
      currentStock: item.current_stock,
      threshold: item.threshold,
      unit: item.unit,
    }),
  );

  const updateRow = (id: string, updates: Partial<DonationRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
    clearFormError();
  };

  const addRow = () => {
    setRows((prev) => [...prev, createRow()]);
    clearFormError();
  };

  const removeRow = (id: string) => {
    setRows((prev) =>
      prev.length === 1 ? [createRow()] : prev.filter((row) => row.id !== id),
    );
    clearFormError();
  };

  const addLowStockItemToForm = (item: SupermarketLowStockItem) => {
    setRows((prev) => {
      const emptyRow = prev.find((row) => row.foodName.trim() === "");
      // 优先填充现有的空白行,避免快速添加操作打乱或重复
      // 超市用户已经开始编辑的行。
      return emptyRow
        ? prev.map((row) =>
            row.id === emptyRow.id
              ? {
                  ...row,
                  foodName: item.name,
                  inventoryItemId: item.id,
                }
              : row,
          )
        : [...prev, createRow(item.name, item.id)];
    });
    setFormError("");
    setIsModalOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!accessToken) {
      setFormError("Please log in again before submitting donations.");
      return;
    }

    const invalidRowIndex = rows.findIndex((row) => {
      const hasAnyValue =
        row.foodName.trim() !== "" || row.quantity.trim() !== "";
      if (!hasAnyValue) {
        return false;
      }

      const quantity = Number(row.quantity);
      return !row.foodName.trim() || !Number.isFinite(quantity) || quantity <= 0;
    });

    if (invalidRowIndex !== -1) {
      setFormError(
        `Row ${invalidRowIndex + 1}: enter a food name and a quantity greater than 0.`,
      );
      return;
    }

    const items = rows
      .map((row) => ({
        inventory_item_id: row.inventoryItemId ?? undefined,
        item_name: row.foodName.trim() || undefined,
        quantity: Number(row.quantity),
      }))
      .filter(
        (row) =>
          row.item_name && Number.isFinite(row.quantity) && row.quantity > 0,
      );

    if (!items.length) {
      setFormError("Add at least one item before submitting your donation.");
      return;
    }

    setIsSubmittingDonation(true);
    try {
      await donationsAPI.submitSupermarketDonation(
        {
          // 这条备注用于在进入管理员审核后区分超市来源的实物捐赠
          // 与公开实物捐赠流程。
          notes: "Submitted from supermarket dashboard",
          items,
        },
        accessToken,
      );

      setRows([createRow()]);
      setDismissedItemIds([]);
      await loadLowStock();
      window.alert(
        "Donation submitted successfully. It is now pending review in Inventory Management.",
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to submit supermarket donation.",
      );
    } finally {
      setIsSubmittingDonation(false);
    }
  };

  return {
    formError,
    isLoadingLowStock,
    isModalOpen,
    isSubmittingDonation,
    lowStockItems,
    modalItems,
    pageError,
    rows,
    showEmptyBanner: !lowStockItems.length && !pageError && !isLoadingLowStock,
    showLowStockBanner: isBannerVisible && visibleLowStockItems.length > 0,
    addLowStockItemToForm,
    addRow,
    closeModal: () => setIsModalOpen(false),
    dismissBanner: () => setIsBannerVisible(false),
    dismissModalItem: (itemId: number) =>
      setDismissedItemIds((prev) =>
        prev.includes(itemId) ? prev : [...prev, itemId],
      ),
    handleSubmit,
    openModal: () => setIsModalOpen(true),
    removeRow,
    updateRowFoodName: (id: string, foodName: string) =>
      updateRow(id, { foodName, inventoryItemId: null }),
    updateRowQuantity: (id: string, quantity: string) =>
      updateRow(id, { quantity }),
  };
}

export type SupermarketPageModel = ReturnType<typeof useSupermarketPageModel>;

export default function Supermarket() {
  const model = useSupermarketPageModel();

  return (
    <PublicPageShell
      variant="supermarket"
      className={styles.pageShell}
      mainClassName={cn(shellStyles.pageRoot, styles.pageMain)}
    >
      <SupermarketDonationForm model={model} />
    </PublicPageShell>
  );
}
