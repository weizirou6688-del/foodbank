export const packageCategoryOptions = [
  'Pantry & Spices',
  'Breakfast',
  'Lunchbox',
  'Family Bundle',
  'Emergency Pack',
] as const
export type PackageCategoryOption = (typeof packageCategoryOptions)[number]
export const packageDescriptionFallbacks: Record<PackageCategoryOption, string> = {
  'Pantry & Spices': 'Core pantry staples suitable for daily household support.',
  Breakfast: 'Breakfast essentials prepared for quick and balanced mornings.',
  Lunchbox: 'Flexible midday items suitable for individuals and family pickups.',
  'Family Bundle': 'Balanced nutrition support designed for larger households.',
  'Emergency Pack': 'Fast-response essentials for urgent short-term food support.',
}
export const inventoryCategoryOptions = [
  'Proteins & Meat',
  'Vegetables',
  'Fruits',
  'Dairy',
  'Canned Goods',
  'Grains & Pasta',
  'Snacks',
  'Beverages',
  'Baby Food',
] as const
export type InventoryCategoryOption = (typeof inventoryCategoryOptions)[number]
