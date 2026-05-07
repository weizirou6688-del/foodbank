import type {
  DonationListRow,
  GoodsDonationResponse,
} from "@/shared/types/donations";
import { apiClient } from "../apiClient";
import type {
  GoodsDonationCreatePayload,
  GoodsDonationUpdatePayload,
} from "./donations";
import type {
  FoodPackageDetailRecord,
  FoodPackageMutationPayload,
  FoodPackageSummaryRecord,
  PackPackageResponse,
} from "./packages";
import type { DashboardAnalyticsResponse } from "./stats";
const buildQueryString = (
  params: Record<string, string | number | boolean | null | undefined>,
) => {
  // 跳过空值过滤器,调用方可直接传入原始表单状态而不会用空参数覆盖后端默认值
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};
interface InventoryItemListResponse {
  items: Array<{
    id: number;
    name: string;
    category: string;
    stock: number;
    total_stock: number;
    unit: string;
    threshold: number;
    food_bank_id?: number | null;
    updated_at: string;
  }>;
  total: number;
  page: number;
  size: number;
  pages: number;
}
interface AdminInventoryItemRecord {
  id: number;
  name: string;
  category: string;
  stock: number;
  total_stock: number;
  unit: string;
  threshold: number;
  food_bank_id?: number | null;
  updated_at: string;
}
interface InventoryItemCreatePayload {
  name: string;
  category: string;
  initial_stock: number;
  unit?: string;
  threshold?: number;
  food_bank_id?: number | null;
}
interface InventoryItemUpdatePayload {
  name?: string;
  category?: string;
  unit?: string;
  threshold?: number;
}
interface InventoryLotAdjustPayload {
  quantity?: number;
  damage_quantity?: number;
  expiry_date?: string;
  status?: "active" | "wasted";
  batch_reference?: string | null;
}
interface InventoryLotRecord {
  id: number;
  inventory_item_id: number;
  item_name: string;
  quantity: number;
  received_date: string;
  expiry_date: string;
  batch_reference?: string | null;
  status: "active" | "wasted" | "expired";
  deleted_at?: string | null;
}
interface LowStockRecord {
  id: number;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  threshold: number;
  stock_deficit: number;
}
export const adminAPI = {
  getDashboardAnalytics: (
    token: string,
    range: "month" | "quarter" | "year" = "month",
    refreshKey?: number,
  ) =>
    // 刷新键使每次手动刷新的 URL 唯一,有助于绕过中间缓存层在快速轮询时的干扰
    apiClient.get<DashboardAnalyticsResponse>(
      `/api/v1/stats/dashboard${buildQueryString({ range, _: refreshKey })}`,
      token,
    ),
  listFoodPackages: (
    token: string,
    filters?: {
      foodBankId?: number | string;
      category?: string;
      search?: string;
      includeInactive?: boolean;
    },
  ) =>
    apiClient.get<FoodPackageDetailRecord[]>(
      `/api/v1/packages${buildQueryString({ food_bank_id: filters?.foodBankId, category: filters?.category, search: filters?.search, include_inactive: filters?.includeInactive })}`,
      token,
    ),
  getFoodPackageDetail: (id: number | string, token: string) =>
    apiClient.get<FoodPackageDetailRecord>(`/api/v1/packages/${id}`, token),
  createFoodPackage: (data: FoodPackageMutationPayload, token: string) =>
    apiClient.post<FoodPackageDetailRecord>("/api/v1/packages", data, token),
  updateFoodPackage: (
    id: number | string,
    data: FoodPackageMutationPayload,
    token: string,
  ) =>
    apiClient.patch<FoodPackageSummaryRecord>(
      `/api/v1/packages/${id}`,
      data,
      token,
    ),
  deleteFoodPackage: (id: number | string, token: string) =>
    apiClient.delete(`/api/v1/packages/${id}`, token),
  packPackage: (id: number | string, quantity: number, token: string) =>
    apiClient.post<PackPackageResponse>(
      `/api/v1/packages/${id}/pack`,
      { quantity },
      token,
    ),
  getInventoryItems: (
    token: string,
    filters?: {
      foodBankId?: number | string;
      category?: string;
      search?: string;
    },
  ) =>
    apiClient.get<InventoryItemListResponse>(
      `/api/v1/inventory${buildQueryString({ food_bank_id: filters?.foodBankId, category: filters?.category, search: filters?.search })}`,
      token,
    ),
  createInventoryItem: (data: InventoryItemCreatePayload, token: string) =>
    apiClient.post<AdminInventoryItemRecord>("/api/v1/inventory", data, token),
  getInventoryLots: (token: string, includeInactive = true) =>
    apiClient.get<InventoryLotRecord[]>(
      `/api/v1/inventory/lots?include_inactive=${includeInactive}`,
      token,
    ),
  adjustInventoryLot: (
    lotId: number | string,
    data: InventoryLotAdjustPayload,
    token: string,
  ) =>
    apiClient.patch<InventoryLotRecord>(
      `/api/v1/inventory/lots/${lotId}`,
      data,
      token,
    ),
  deleteInventoryLot: (lotId: number | string, token: string) =>
    apiClient.delete(`/api/v1/inventory/lots/${lotId}`, token),
  updateInventoryItem: (
    id: number | string,
    data: InventoryItemUpdatePayload,
    token: string,
  ) =>
    apiClient.patch<AdminInventoryItemRecord>(
      `/api/v1/inventory/${id}`,
      data,
      token,
    ),
  stockInInventoryItem: (
    id: number | string,
    data: { quantity: number; reason: string; expiry_date?: string },
    token: string,
  ) =>
    apiClient.post<AdminInventoryItemRecord>(
      `/api/v1/inventory/${id}/stock-in`,
      data,
      token,
    ),
  deleteInventoryItem: (id: number | string, token: string) =>
    apiClient.delete(`/api/v1/inventory/${id}`, token),
  getLowStockItems: (token: string, threshold?: number) => {
    const url =
      threshold === undefined
        ? "/api/v1/inventory/low-stock"
        : `/api/v1/inventory/low-stock?threshold=${threshold}`;
    return apiClient.get<LowStockRecord[]>(url, token);
  },
  getDonations: (token: string, type?: "cash" | "goods") => {
    const query = type ? `?type=${type}` : "";
    return apiClient.get<DonationListRow[]>(`/api/v1/donations${query}`, token);
  },
  createGoodsDonation: (data: GoodsDonationCreatePayload, token: string) =>
    apiClient.post<GoodsDonationResponse>(
      "/api/v1/donations/goods",
      data,
      token,
    ),
  updateGoodsDonation: (
    id: string,
    data: GoodsDonationUpdatePayload,
    token: string,
  ) =>
    apiClient.patch<GoodsDonationResponse>(
      `/api/v1/donations/goods/${id}`,
      data,
      token,
    ),
  deleteGoodsDonation: (id: string, token: string) =>
    apiClient.delete(`/api/v1/donations/goods/${id}`, token),
  deleteCashDonation: (id: string, token: string) =>
    apiClient.delete(`/api/v1/donations/cash/${id}`, token),
};
