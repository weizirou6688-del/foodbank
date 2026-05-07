import { useEffect, useRef, useState } from "react";
import { useFoodBankStore } from "@/app/store/foodBankStore";
import { useAuthStore } from "@/app/store/authStore";
export const WEEKLY_COLLECTION_LIMIT = 3;
export const MAX_INDIVIDUAL = 5;
const ITEMS_PER_PAGE = 6;
interface Selection {
  packageId: number;
  qty: number;
}
interface ItemSelection {
  itemId: number;
  qty: number;
}
export function useFoodPackagesPageModel() {
  const { user } = useAuthStore();
  const {
    selectedFoodBank,
    packages,
    availableItems,
    userApplications,
    weeklyCollected,
    loadUserCollections,
    loadPackages,
    loadAvailableItems,
    applyPackages,
  } = useFoodBankStore();
  const [pkgQty, setPkgQty] = useState<Record<number, number>>({});
  const [foodSel, setFoodSel] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 登录用户进页面立即拉申请历史
    if (user) {
      void loadUserCollections();
    }
  }, [user, loadUserCollections]);
  useEffect(() => {
    let cancelled = false;
    setIsBootstrapping(true);
    Promise.allSettled([loadPackages(), loadAvailableItems()]).then(
      (results) => {
        if (cancelled) {
          return;
        }
        const firstFailure = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (firstFailure) {
          const reason = firstFailure.reason;
          setErrorMsg(
            reason instanceof Error
              ? reason.message
              : "Failed to load food support options",
          );
        }
        setIsBootstrapping(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedFoodBank?.id, loadPackages, loadAvailableItems]);
  useEffect(() => {
    const categoryExists = availableItems.some(
      (item) => item.category === category,
    );
    if (category !== "All" && !categoryExists) {
      setCategory("All");
      setPage(1);
    }
  }, [availableItems, category]);
  const remainingPackageSlots = Math.max(
    0,
    WEEKLY_COLLECTION_LIMIT - weeklyCollected,
  );
  useEffect(() => {
    if (showSuccess) {
      return;
    }
    // 将套餐选择与实时库存及每周限额对比校正,
    // 防止过期数量在新数据到达后仍然保留。
    setPkgQty((prev) => {
      const packagesById = new Map(packages.map((pkg) => [pkg.id, pkg]));
      let remainingSlots = remainingPackageSlots;
      let changed = false;
      const next: Record<number, number> = {};
      for (const [rawId, rawQty] of Object.entries(prev)) {
        const packageId = Number(rawId);
        const pkg = packagesById.get(packageId);
        if (!pkg || pkg.stock <= 0 || remainingSlots <= 0) {
          changed = true;
          continue;
        }
        const cappedQty = Math.min(rawQty, pkg.stock, remainingSlots);
        if (cappedQty !== rawQty) {
          changed = true;
        }
        if (cappedQty > 0) {
          next[packageId] = cappedQty;
          remainingSlots -= cappedQty;
        }
      }
      return changed ? next : prev;
    });
  }, [packages, remainingPackageSlots, showSuccess]);
  useEffect(() => {
    if (showSuccess) {
      return;
    }
    setFoodSel((prev) => {
      const itemsById = new Map(
        availableItems.map((item) => [String(item.id), item]),
      );
      let selectedTypes = 0;
      let changed = false;
      const next: Record<string, number> = {};
      for (const [itemId, rawQty] of Object.entries(prev)) {
        const item = itemsById.get(itemId);
        if (!item || item.stock <= 0 || selectedTypes >= MAX_INDIVIDUAL) {
          changed = true;
          continue;
        }
        const cappedQty = Math.min(rawQty, item.stock, MAX_INDIVIDUAL);
        if (cappedQty !== rawQty) {
          changed = true;
        }
        if (cappedQty > 0) {
          next[itemId] = cappedQty;
          selectedTypes += 1;
        }
      }
      return changed ? next : prev;
    });
  }, [availableItems, showSuccess]);
  useEffect(() => {
    if (errorMsg && !showSuccess) {
      setErrorMsg("");
    }
  }, [pkgQty, foodSel, errorMsg, showSuccess]);
  const foodBank = selectedFoodBank;
  // 在排序前先按当前食物银行过滤历史记录,
  // 确保内联状态面板与用户正在浏览的目录一致。
  const recentUserApplications = (foodBank
    ? userApplications.filter(
        (application) => application.food_bank_id === foodBank.id,
      )
    : userApplications
  )
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, 5);
  const displayPackages = packages;
  const categories = [
    "All",
    ...Array.from(new Set(availableItems.map((item) => item.category))),
  ];
  const totalPkgs = Object.values(pkgQty).reduce((sum, qty) => sum + qty, 0);
  const remaining = remainingPackageSlots;
  const totalFoods = Object.keys(foodSel).length;
  const totalFoodUnits = Object.values(foodSel).reduce(
    (sum, qty) => sum + qty,
    0,
  );
  const atFoodLimit = totalFoods >= MAX_INDIVIDUAL;
  const packageLimitReached = remainingPackageSlots === 0;
  const interactionsDisabled = isBootstrapping || loading || showSuccess;
  const filteredFoods =
    category === "All"
      ? availableItems
      : availableItems.filter((item) => item.category === category);
  const totalPages = Math.ceil(filteredFoods.length / ITEMS_PER_PAGE);
  const pagedFoods = filteredFoods.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const hasAny = totalPkgs > 0 || totalFoods > 0;
  useEffect(() => {
    if (totalPages === 0 && page !== 1) {
      setPage(1);
      return;
    }
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  useEffect(() => {
    if (!showSuccess) {
      return;
    }
    const handle = window.setTimeout(() => {
      successRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
    return () => {
      window.clearTimeout(handle);
    };
  }, [showSuccess]);
  const changePkgQty = (id: number, delta: number, maxStock: number) => {
    if (interactionsDisabled) {
      return;
    }
    setPkgQty((prev) => {
      const currentQty = prev[id] || 0;
      const currentTotal = Object.values(prev).reduce(
        (sum, qty) => sum + qty,
        0,
      );
      if (
        delta > 0 &&
        (currentQty >= maxStock || currentTotal >= remainingPackageSlots)
      ) {
        return prev;
      }
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: nextQty };
    });
  };
  const toggleFood = (id: string) => {
    if (interactionsDisabled) {
      return;
    }
    setFoodSel((prev) => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (Object.keys(prev).length >= MAX_INDIVIDUAL) {
        return prev;
      }
      return { ...prev, [id]: 1 };
    });
  };
  const changeFoodQty = (id: string, delta: number, max: number) => {
    if (interactionsDisabled) {
      return;
    }
    setFoodSel((prev) => {
      const currentQty = prev[id] || 0;
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (nextQty > MAX_INDIVIDUAL || nextQty > max) {
        return prev;
      }
      return { ...prev, [id]: nextQty };
    });
  };
  const handleApply = async () => {
    setErrorMsg("");
    if (interactionsDisabled) {
      return;
    }
    if (!user?.email) {
      setErrorMsg("Please sign in to submit an application.");
      return;
    }
    if (!hasAny) {
      setErrorMsg("Please select at least one package or item.");
      return;
    }
    if (totalPkgs > remainingPackageSlots) {
      setErrorMsg(
        `You can only request ${remainingPackageSlots} more package${remainingPackageSlots === 1 ? "" : "s"} this week.`,
      );
      return;
    }
    const packageSelections: Selection[] = Object.entries(pkgQty).map(
      ([id, qty]) => ({ packageId: Number(id), qty }),
    );
    const itemSelections: ItemSelection[] = Object.entries(foodSel).map(
      ([id, qty]) => ({ itemId: Number(id), qty }),
    );
    setLoading(true);
    try {
      // 套餐与散装单品合并提交,因为后端针对合并请求只返回一个申请和一个兑换码。
      const result = await applyPackages(
        packageSelections,
        undefined,
        itemSelections,
      );
      if (!result.success) {
        setErrorMsg(result.message);
        return;
      }
      if (!result.code) {
        setErrorMsg(
          "Application succeeded but no redemption code was returned.",
        );
        return;
      }
      setShowSuccess(true);
      setRedemptionCode(result.code);
    } catch (error) {
      setErrorMsg(
        error instanceof Error ? error.message : "Application failed",
      );
    } finally {
      setLoading(false);
    }
  };
  const handleNewApplication = () => {
    setShowSuccess(false);
    setRedemptionCode("");
    setPkgQty({});
    setFoodSel({});
    setErrorMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  let summaryTxt = "";
  if (totalPkgs > 0) {
    summaryTxt += `${totalPkgs} package${totalPkgs > 1 ? "s" : ""}`;
  }
  if (totalPkgs > 0 && totalFoods > 0) {
    summaryTxt += " + ";
  }
  if (totalFoods > 0) {
    summaryTxt += `${totalFoods} item type${totalFoods > 1 ? "s" : ""}`;
    if (totalFoodUnits > totalFoods) {
      summaryTxt += ` (${totalFoodUnits} units)`;
    }
  }
  return {
    availableItems,
    categories,
    category,
    displayPackages,
    errorMsg,
    foodBank,
    foodSel,
    hasAny,
    interactionsDisabled,
    isBootstrapping,
    loading,
    packageLimitReached,
    page,
    pagedFoods,
    pkgQty,
    redemptionCode,
    recentUserApplications,
    remaining,
    remainingPackageSlots,
    showSuccess,
    successRef,
    summaryTxt,
    totalFoods,
    totalFoodUnits,
    totalPages,
    totalPkgs,
    weeklyCollected,
    atFoodLimit,
    changeCategory: (nextCategory: string) => {
      setCategory(nextCategory);
      setPage(1);
    },
    changeFoodQty,
    changePkgQty,
    goToPage: setPage,
    handleApply,
    handleNewApplication,
    toggleFood,
  };
}
export type FoodPackagesPageModel = ReturnType<typeof useFoodPackagesPageModel>;
