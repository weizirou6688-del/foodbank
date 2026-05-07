import { adminAPI } from "@/shared/lib/api/admin";
import { createStore } from "@/shared/lib/store";
import { createPublicFoodBankStoreActions } from "./foodBankStore.public";
import {
  getRequiredAccessToken,
  normalizeInventoryItem,
} from "./foodBankStore.shared";
import type {
  FoodBankState,
  FoodBankStateSetter,
  FoodBankStoreActionFactoryResult,
} from "./foodBankStore.types";
type AdminFoodBankStoreActions = Pick<
  FoodBankStoreActionFactoryResult,
  "loadInventory" | "deleteItem"
>;
// 管理端库存写操作集中在这个小切片里,避免把页面级的管理编排逻辑拉进共享 store
function createAdminFoodBankStoreActions(
  set: FoodBankStateSetter,
): AdminFoodBankStoreActions {
  return {
    loadInventory: async () => {
      try {
        const inventoryResponse = await adminAPI.getInventoryItems(
          getRequiredAccessToken(),
        );
        set({ inventory: inventoryResponse.items.map(normalizeInventoryItem) });
      } catch (error) {
        console.error("Failed to load inventory:", error);
        throw error instanceof Error
          ? error
          : new Error("Failed to load inventory");
      }
    },
    deleteItem: async (itemId) => {
      await adminAPI.deleteInventoryItem(itemId, getRequiredAccessToken());
      set((state) => ({
        inventory: state.inventory.filter((item) => item.id !== itemId),
      }));
    },
  };
}
// 一个共享 store 同时支持公众流程和管理端库存页面,各自的 action 在上方的工厂函数中按职责拆分
export const useFoodBankStore = createStore<FoodBankState>((set, get) => ({
  searchResults: [],
  searchedLocation: null,
  hasSearched: false,
  isSearching: false,
  searchError: null,
  selectedFoodBank: null,
  packages: [],
  inventory: [],
  availableItems: [],
  userApplications: [],
  weeklyCollected: 0,
  selectFoodBank: (foodBank) => set({ selectedFoodBank: foodBank }),
  ...createPublicFoodBankStoreActions(set, get),
  ...createAdminFoodBankStoreActions(set),
}));

