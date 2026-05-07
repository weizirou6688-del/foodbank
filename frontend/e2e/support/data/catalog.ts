import { FIXED_NOW_ISO } from "./common";

export type PackageDetailItemRecord = {
  id: number;
  inventory_item_id: number;
  quantity: number;
  inventory_item_name: string;
  inventory_item_unit: string;
};

export type PackageSummaryRecord = {
  id: number;
  name: string;
  category: string;
  description: string;
  stock: number;
  threshold: number;
  applied_count: number;
  image_url: string;
  food_bank_id: number;
  is_active: boolean;
  created_at: string;
};

export type PackageDetailRecord = PackageSummaryRecord & {
  package_items: PackageDetailItemRecord[];
};

export type InventoryItemRecord = {
  id: number;
  name: string;
  category: string;
  stock: number;
  total_stock: number;
  unit: string;
  threshold: number;
  food_bank_id: number;
  updated_at: string;
};

export function makePackageDetail(
  overrides: Partial<PackageDetailRecord> = {},
): PackageDetailRecord {
  const packageItems = Array.isArray(overrides.package_items)
    ? overrides.package_items.map((item) => ({ ...item }))
    : [];

  return {
    id: overrides.id ?? 101,
    name: overrides.name ?? "Support Package",
    category: overrides.category ?? "Emergency Support",
    description: overrides.description ?? "A compact package for test coverage.",
    stock: overrides.stock ?? 6,
    threshold: overrides.threshold ?? 2,
    applied_count: overrides.applied_count ?? 0,
    image_url: overrides.image_url ?? "",
    food_bank_id: overrides.food_bank_id ?? 1,
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at ?? FIXED_NOW_ISO,
    package_items: packageItems,
  };
}

export function makeInventoryItem(
  overrides: Partial<InventoryItemRecord> = {},
): InventoryItemRecord {
  const stock = overrides.stock ?? overrides.total_stock ?? 12;
  const totalStock = overrides.total_stock ?? overrides.stock ?? stock;

  return {
    id: overrides.id ?? 1001,
    name: overrides.name ?? "Food Item",
    category: overrides.category ?? "Pantry",
    stock,
    total_stock: totalStock,
    unit: overrides.unit ?? "units",
    threshold: overrides.threshold ?? 4,
    food_bank_id: overrides.food_bank_id ?? 1,
    updated_at: overrides.updated_at ?? FIXED_NOW_ISO,
  };
}
