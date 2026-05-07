import { foodBanksAPI } from "@/shared/lib/api/foodBanks";
import type { FoodBank } from "@/shared/types/foodBanks";
import type { InventoryItem } from "@/shared/types/inventory";
import { useAuthStore } from "./authStore";
import type {
  FoodBankStateGetter,
  FoodBankStateSetter,
  FoodPackage,
  RawPackage,
} from "./foodBankStore.types";
const normalizeFoodBank = (bank: {
  id: number | string;
  name: string;
  address: string;
  notification_email?: string | null;
  has_local_admin_account?: boolean;
  lat?: number | string | null;
  lng?: number | string | null;
  phone?: string;
  email?: string;
  url?: string;
  systemMatched?: boolean;
}): FoodBank => ({
  id: Number(bank.id),
  name: bank.name,
  address: bank.address,
  notification_email: bank.notification_email,
  has_local_admin_account: bank.has_local_admin_account,
  lat: Number(bank.lat ?? 0),
  lng: Number(bank.lng ?? 0),
  phone: bank.phone,
  email: bank.email,
  url: bank.url,
  systemMatched: bank.systemMatched ?? bank.has_local_admin_account,
});
export const normalizeInventoryItem = (item: {
  id: number | string;
  name: string;
  category: string;
  stock?: number;
  total_stock?: number;
  unit: string;
  threshold?: number;
  food_bank_id?: number | string | null;
}): InventoryItem => ({
  id: Number(item.id),
  name: item.name,
  category: item.category,
  stock: Number(item.total_stock ?? item.stock ?? 0),
  unit: item.unit,
  threshold: Number(item.threshold ?? 0),
  foodBankId: item.food_bank_id == null ? undefined : Number(item.food_bank_id),
});
const normalizeNamedPackageItems = (
  items: RawPackage["items"],
): FoodPackage["items"] =>
  Array.isArray(items)
    ? items.map((item) => ({ name: item.name, qty: Number(item.qty ?? 0) }))
    : [];
const normalizePackageContents = (
  contents: RawPackage["contents"],
): FoodPackage["items"] =>
  Array.isArray(contents)
    ? contents.map((content) => ({
        name: `Item #${content.item_id}`,
        qty: Number(content.quantity ?? 0),
      }))
    : [];
export const normalizePackage = (
  pkg: RawPackage,
  itemsOverride?: FoodPackage["items"],
): FoodPackage => {
  const namedItems = normalizeNamedPackageItems(pkg.items);
  return {
    id: Number(pkg.id),
    name: pkg.name,
    category: pkg.category,
    description: pkg.description ?? "",
    items:
      itemsOverride ??
      (namedItems.length > 0
        ? namedItems
        : normalizePackageContents(pkg.contents)),
    stock: Number(pkg.stock ?? 0),
    threshold: Number(pkg.threshold ?? 0),
    appliedCount: Number(pkg.applied_count ?? pkg.appliedCount ?? 0),
    image: pkg.image_url ?? pkg.image ?? "",
  };
};
export const getRequiredAccessToken = (): string => {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    throw new Error("Not authenticated");
  }
  return token;
};

const getPreferredFoodBankId = (): number | null => {
  const foodBankId = useAuthStore.getState().user?.food_bank_id;
  return typeof foodBankId === "number" && foodBankId > 0 ? foodBankId : null;
};

export const resolveSelectedFoodBank = async (
  get: FoodBankStateGetter,
  set: FoodBankStateSetter,
): Promise<FoodBank | null> => {
  // 公众访客可浏览任意食物银行,但已登录的绑定用户在重新加载后应回到其分配的食物银行
  const existing = get().selectedFoodBank;
  const preferredFoodBankId = getPreferredFoodBankId();
  if (
    existing &&
    (preferredFoodBankId == null || existing.id === preferredFoodBankId)
  ) {
    return existing;
  }
  const foodBanksResponse = await foodBanksAPI.getFoodBanks();
  const foodBanks = foodBanksResponse.items.map(normalizeFoodBank);
  if (foodBanks.length === 0) {
    set({ selectedFoodBank: null });
    return null;
  }
  const preferredFoodBank =
    (preferredFoodBankId == null
      ? null
      : foodBanks.find((bank) => bank.id === preferredFoodBankId)) ?? null;
  const nextFoodBank = preferredFoodBank ?? existing ?? foodBanks[0];
  set({ selectedFoodBank: nextFoodBank });
  return nextFoodBank;
};
export const getCurrentWeekMonday = (): string => {
  const today = new Date();
  const date = new Date(today);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
};
