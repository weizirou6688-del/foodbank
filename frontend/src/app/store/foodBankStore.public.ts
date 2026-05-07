import {
  applicationsAPI,
  type ApplicationCreatePayload,
  type UserApplicationRecord,
} from "@/shared/lib/api/applications";
import { foodBanksAPI } from "@/shared/lib/api/foodBanks";
import { packagesAPI } from "@/shared/lib/api/packages";
import {
  BACKEND_API_UNAVAILABLE_MESSAGE,
  buildResolvedNearbyFoodBanks,
  getCoordinatesFromPostcode,
  getFoodBankLookupErrorMessage,
  getNearbyFoodbanks,
} from "@/shared/lib/foodBankLookup";
import { useAuthStore } from "./authStore";
import {
  getCurrentWeekMonday,
  getRequiredAccessToken,
  normalizeInventoryItem,
  normalizePackage,
  resolveSelectedFoodBank,
} from "./foodBankStore.shared";
import type {
  FoodBankStateGetter,
  FoodBankStateSetter,
  FoodBankStoreActionFactoryResult,
  FoodPackage,
} from "./foodBankStore.types";
type PublicFoodBankStoreActions = Pick<
  FoodBankStoreActionFactoryResult,
  | "loadPackages"
  | "loadAvailableItems"
  | "searchFoodBanks"
  | "loadUserCollections"
  | "applyPackages"
>;
// 公众端 store:目录加载 / postcode 搜索 / 申请历史
export function createPublicFoodBankStoreActions(
  set: FoodBankStateSetter,
  get: FoodBankStateGetter,
): PublicFoodBankStoreActions {
  return {
    loadPackages: async () => {
      try {
        const foodBank = await resolveSelectedFoodBank(get, set);
        if (!foodBank) {
          set({ packages: [] });
          return;
        }
        const packages = await packagesAPI.listFoodBankPackages(foodBank.id);
        const detailItemsById = new Map();
        if (packages.length > 0) {
          // 摘要行并不总含有需要渲染的物品名称,所以在套餐数据存在时通过详情接口补充
          await Promise.all(
            packages.map(async (pkg) => {
              const packageId = Number(pkg.id);
              if (!Number.isFinite(packageId) || packageId <= 0) {
                return;
              }
              try {
                const detail =
                  await packagesAPI.getFoodPackageDetail(packageId);
                const detailItems = Array.isArray(detail.package_items)
                  ? detail.package_items.map(
                      (entry: {
                        inventory_item_name?: string;
                        quantity?: number;
                        inventory_item_id?: number;
                      }) => ({
                        name:
                          entry.inventory_item_name ||
                          `Item #${entry.inventory_item_id ?? "unknown"}`,
                        qty: Number(entry.quantity ?? 0),
                      }),
                    )
                  : [];
                detailItemsById.set(packageId, detailItems);
              } catch {
                void 0;
              }
            }),
          );
        }
        const normalizedPackages: FoodPackage[] = packages.map((pkg) =>
          normalizePackage(pkg, detailItemsById.get(Number(pkg.id))),
        );
        set({ packages: normalizedPackages });
      } catch (error) {
        console.error("Failed to load packages:", error);
        throw error instanceof Error
          ? error
          : new Error("Failed to load packages");
      }
    },
    loadAvailableItems: async () => {
      try {
        const foodBank = await resolveSelectedFoodBank(get, set);
        if (!foodBank) {
          set({ availableItems: [] });
          return;
        }
        const response = await foodBanksAPI.getInventoryItems(foodBank.id);
        set({ availableItems: response.items.map(normalizeInventoryItem) });
      } catch (error) {
        console.error("Failed to load available items:", error);
        throw error instanceof Error
          ? error
          : new Error("Failed to load individual food items");
      }
    },
    searchFoodBanks: async (postcode) => {
      if (!postcode.trim()) {
        return;
      }
      set({ isSearching: true, searchError: null });
      try {
        // 混合邮政编码地理编码、内部记录与附近食物银行搜索结果,再决定页面展示哪些选项
        const [userCoords, internalFoodBanksResponse, nearby] =
          await Promise.all([
            getCoordinatesFromPostcode(postcode),
            foodBanksAPI.getFoodBanks(),
            getNearbyFoodbanks(postcode),
          ]);
        const searchResults = buildResolvedNearbyFoodBanks({
          userCoords,
          internalBanks: internalFoodBanksResponse.items ?? [],
          nearbyBanks: nearby,
        });
        if (searchResults.length > 0) {
          set({
            searchResults,
            searchedLocation: userCoords,
            hasSearched: true,
            isSearching: false,
            searchError: null,
          });
          return;
        }
        set({
          searchResults: [],
          searchedLocation: userCoords,
          hasSearched: true,
          isSearching: false,
          searchError: null,
        });
      } catch (error) {
        console.error("Search failed:", error);
        set({
          searchResults: [],
          searchedLocation: null,
          hasSearched: true,
          isSearching: false,
          searchError: getFoodBankLookupErrorMessage(
            error,
            BACKEND_API_UNAVAILABLE_MESSAGE,
          ),
        });
      }
    },
    loadUserCollections: async (weekStart) => {
      try {
        const accessToken = useAuthStore.getState().accessToken;
        if (!accessToken) {
          set({ userApplications: [], weeklyCollected: 0 });
          return;
        }
        const response = await applicationsAPI.getMyApplications(accessToken);
        // 公众页面现在需要完整记录来追踪状态以及每周总量,因此推导在数据填充后执行
        const items = response.items as UserApplicationRecord[];
        const targetWeek = weekStart || getCurrentWeekMonday();
        const totalCollected = items
          .filter((application) => application.week_start === targetWeek)
          .reduce(
            (sum, application) => sum + Number(application.total_quantity ?? 0),
            0,
          );
        set({ userApplications: items, weeklyCollected: totalCollected });
      } catch (error) {
        console.error("Failed to load collections:", error);
      }
    },
    applyPackages: async (selections, weekStart, itemSelections = []) => {
      try {
        const accessToken = getRequiredAccessToken();
        const currentUser = useAuthStore.getState().user;
        if (!currentUser) {
          return { success: false, message: "Not authenticated" };
        }
        // 公众申请绑定到搜索页选定的食物银行,提交时不会静默回退到其他食物银行
        const selectedFoodBank = get().selectedFoodBank;
        if (!selectedFoodBank || selectedFoodBank.id <= 0) {
          return {
            success: false,
            message:
              "This food bank is not connected to online applications yet.",
          };
        }
        const finalWeekStart = weekStart || getCurrentWeekMonday();
        const payload: ApplicationCreatePayload = {
          food_bank_id: selectedFoodBank.id,
          week_start: finalWeekStart,
          items: [
            ...selections.map((selection) => ({
              package_id: selection.packageId,
              quantity: selection.qty,
            })),
            ...itemSelections.map((selection) => ({
              inventory_item_id: selection.itemId,
              quantity: selection.qty,
            })),
          ],
        };
        const result = await applicationsAPI.submitApplication(
          payload,
          accessToken,
        );
        // 一并刷新公众收藏数据,使限额、库存和内联状态面板都反映同一条新建申请
        await Promise.allSettled([
          get().loadUserCollections(finalWeekStart),
          get().loadPackages(),
          get().loadAvailableItems(),
        ]);
        return {
          success: true,
          message: "Application successful!",
          code: result.redemption_code || result.id,
        };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Network error during application",
        };
      }
    },
  };
}
