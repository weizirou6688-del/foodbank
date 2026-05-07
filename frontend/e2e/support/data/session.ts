export const PUBLIC_ACCESS_TOKEN = "playwright-public-token";
export const ADMIN_ACCESS_TOKEN = "playwright-admin-token";

export const validCredentials = {
  email: "user@example.com",
  password: "user12345",
} as const;

export const publicUser = {
  id: "user-public-1",
  name: "Taylor Public",
  email: validCredentials.email,
  role: "public",
  food_bank_id: null,
  food_bank_name: null,
} as const;

export const localAdminCredentials = {
  email: "localadmin@foodbank.com",
  password: "localadmin123",
} as const;

export const localAdminUser = {
  id: "admin-local-1",
  name: "Jubilee Local Admin",
  email: localAdminCredentials.email,
  role: "admin",
  food_bank_id: 1,
  food_bank_name: "Jubilee Storehouse",
} as const;
