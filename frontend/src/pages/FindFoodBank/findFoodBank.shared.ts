import type { FoodBank } from "@/shared/types/foodBanks";

export const RESULTS_PER_PAGE = 3;

// 搜索结果可能来自公开查询,也可能来自已关联到本系统的记录。
// 任一信号均表示套餐页面可以解析该食物银行。
export const canViewFoodBankPackages = (foodBank: FoodBank) =>
  foodBank.id > 0 &&
  Boolean(foodBank.has_local_admin_account ?? foodBank.systemMatched);

export const getFoodBankKey = (foodBank: FoodBank) =>
  `${foodBank.id}-${foodBank.name}-${foodBank.lat}-${foodBank.lng}`;

export const getSummaryText = (
  hasSearched: boolean,
  resultCount: number,
  localPostcode: string,
) =>
  hasSearched
    ? `Found ${resultCount} result(s)${localPostcode.trim() ? ` near ${localPostcode.trim()}` : ""}.`
    : "Run a postcode search to load nearby locations into the map and list.";

export const getDisplayedResults = (
  searchResults: FoodBank[],
  currentPage: number,
) =>
  searchResults.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE,
  );

export const getSelectedFoodBankKey = (
  searchResults: FoodBank[],
  current: string | null,
) => {
  // 当分页或重新获取数据时结果集不变,保留当前地图/列表的选中状态;
  // 若该食物银行消失则优雅地回退。
  if (
    current &&
    searchResults.some((foodBank) => getFoodBankKey(foodBank) === current)
  ) {
    return current;
  }

  return searchResults[0] ? getFoodBankKey(searchResults[0]) : null;
};
