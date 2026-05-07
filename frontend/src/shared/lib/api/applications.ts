import { apiClient } from "../apiClient";
export type ApplicationStatus = "pending" | "collected" | "expired";
type ApplicationRequestItemPayload =
  | { package_id: number; quantity: number; inventory_item_id?: never }
  | { inventory_item_id: number; quantity: number; package_id?: never };
export interface ApplicationCreatePayload {
  food_bank_id: number;
  week_start?: string;
  items: ApplicationRequestItemPayload[];
}
interface AdminApplicationItem {
  id: number;
  package_id?: number | null;
  inventory_item_id?: number | null;
  name: string;
  quantity: number;
}
export interface AdminApplicationRecord {
  id: string;
  user_id: string;
  food_bank_id: number;
  redemption_code: string;
  status: ApplicationStatus;
  week_start: string;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  redeemed_at?: string | null;
  deleted_at?: string | null;
  items: AdminApplicationItem[];
  package_name?: string | null;
  is_voided: boolean;
  voided_at?: string | null;
}
interface AdminApplicationListResponse {
  items: AdminApplicationRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
// 公开页面只需轻量申请结构,用于限额判断、确认态及目录中的近期状态摘要
export interface UserApplicationRecord {
  id: string;
  user_id: string;
  food_bank_id: number;
  redemption_code: string;
  status: ApplicationStatus;
  week_start: string;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  redeemed_at?: string | null;
  deleted_at?: string | null;
}
interface UserApplicationListResponse {
  items: UserApplicationRecord[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
export const applicationsAPI = {
  submitApplication: (data: ApplicationCreatePayload, token: string) =>
    apiClient.post<UserApplicationRecord>("/api/v1/applications", data, token),
  // 公开页面从同一数据源推导每周上限和内联状态历史,简化客户端状态模型
  getMyApplications: (token: string) =>
    apiClient.get<UserApplicationListResponse>(
      "/api/v1/applications/my",
      token,
    ),
  getAdminApplications: (token: string) =>
    apiClient.get<AdminApplicationListResponse>(
      "/api/v1/applications/admin/records",
      token,
    ),
  getApplicationByCode: (code: string, token: string) =>
    // 操作员可能粘贴带空格或标点的扫描码,构造查询路径前始终对原始值转义
    apiClient.get<AdminApplicationRecord>(
      `/api/v1/applications/admin/by-code/${encodeURIComponent(code)}`,
      token,
    ),
  redeemApplication: (id: string, token: string) =>
    apiClient.post<AdminApplicationRecord>(
      `/api/v1/applications/admin/${id}/redeem`,
      {},
      token,
    ),
  voidApplication: (id: string, token: string) =>
    apiClient.post<AdminApplicationRecord>(
      `/api/v1/applications/admin/${id}/void`,
      {},
      token,
    ),
};
