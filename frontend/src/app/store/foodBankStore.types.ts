import type { UserApplicationRecord } from "@/shared/lib/api/applications";
import type { FoodBank } from "@/shared/types/foodBanks";
import type { InventoryItem } from "@/shared/types/inventory";
export interface FoodPackage {
  id: number;
  name: string;
  category: string;
  description: string;
  items: Array<{ name: string; qty: number }>;
  stock: number;
  threshold: number;
  appliedCount: number;
  image: string;
}
export type RawPackage = {
  id: number | string;
  name: string;
  category: string;
  description?: string | null;
  items?: Array<{ name: string; qty?: number }>;
  contents?: Array<{ item_id: number; quantity: number }>;
  stock?: number;
  threshold?: number;
  applied_count?: number;
  appliedCount?: number;
  image_url?: string | null;
  image?: string | null;
};
export interface FoodBankState {
  searchResults: FoodBank[];
  searchedLocation: { lat: number; lng: number } | null;
  hasSearched: boolean;
  isSearching: boolean;
  searchError: string | null;
  selectedFoodBank: FoodBank | null;
  packages: FoodPackage[];
  inventory: InventoryItem[];
  availableItems: InventoryItem[];
  // 保留完整记录,以便公众端能渲染状态历史,而不只是汇总成每周套餐数量
  userApplications: UserApplicationRecord[];
  weeklyCollected: number;
  searchFoodBanks: (postcode: string) => Promise<void>;
  selectFoodBank: (fb: FoodBank) => void;
  applyPackages: (
    selections: { packageId: number; qty: number }[],
    weekStart?: string,
    itemSelections?: { itemId: number; qty: number }[],
  ) => Promise<{ success: boolean; message: string; code?: string }>;
  loadUserCollections: (weekStart?: string) => Promise<void>;
  loadPackages: () => Promise<void>;
  loadAvailableItems: () => Promise<void>;
  loadInventory: () => Promise<void>;
  deleteItem: (itemId: number) => Promise<void>;
}
export type FoodBankStateSetter = (
  updater:
    | Partial<FoodBankState>
    | ((state: FoodBankState) => Partial<FoodBankState>),
) => void;
export type FoodBankStateGetter = () => FoodBankState;
export type FoodBankStoreActionFactoryResult = Pick<
  FoodBankState,
  | "loadPackages"
  | "loadAvailableItems"
  | "searchFoodBanks"
  | "loadUserCollections"
  | "applyPackages"
  | "loadInventory"
  | "deleteItem"
>;
