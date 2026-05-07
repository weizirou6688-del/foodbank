export interface FoodBank {
  id: number;
  name: string;
  address: string;
  notification_email?: string | null;
  has_local_admin_account?: boolean;
  distance?: number;
  lat: number;
  lng: number;
  phone?: string;
  email?: string;
  url?: string;
  systemMatched?: boolean;
}
