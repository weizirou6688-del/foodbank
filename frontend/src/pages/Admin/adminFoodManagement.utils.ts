import type { FoodPackage, InventoryItem } from '@/shared/types/common'
import type {
  InventoryCategoryItem,
  InventoryCategoryRow,
  LowStockRow,
  PackageRow,
  RestockRequestRow,
} from './adminFoodManagement.types'

export const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const buildPackageRows = (packages: FoodPackage[]): PackageRow[] =>
  packages.map((pkg) => ({
    key: `store-${pkg.id}`,
    id: Number(pkg.id),
    name: pkg.name,
    category: pkg.category,
    threshold: pkg.threshold,
    stock: pkg.stock,
    contents: pkg.items.map((item) => `${item.name} x${item.qty}`),
  }))

export const buildInventoryCategories = (
  inventory: InventoryItem[],
): InventoryCategoryRow[] => {
  const grouped = new Map<string, InventoryCategoryItem[]>()

  for (const item of inventory) {
    const nextItem: InventoryCategoryItem = {
      id: item.id,
      name: item.name,
      stock: item.stock,
      unit: item.unit,
      threshold: item.threshold,
    }

    const items = grouped.get(item.category) ?? []
    items.push(nextItem)
    grouped.set(item.category, items)
  }

  return Array.from(grouped.entries()).map(([name, items]) => ({
    name,
    items,
  }))
}

export const filterInventoryCategories = (
  categories: InventoryCategoryRow[],
  search: string,
) => {
  const needle = search.trim().toLowerCase()
  if (!needle) {
    return categories
  }

  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        item.name.toLowerCase().includes(needle),
      ),
    }))
    .filter((category) => category.items.length > 0)
}

export const extractRestockRequests = (data: unknown): RestockRequestRow[] => {
  if (Array.isArray(data)) {
    return data as RestockRequestRow[]
  }

  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: RestockRequestRow[] }).items
  }

  return []
}

export const getRestockUrgency = (
  item: LowStockRow,
): RestockRequestRow['urgency'] => {
  if (item.current_stock === 0) {
    return 'high'
  }

  const halfwayThreshold = Math.max(1, Math.floor(item.threshold / 2))
  return item.current_stock <= halfwayThreshold ? 'medium' : 'low'
}

export const findPackagesReferencingItem = (
  packageRows: PackageRow[],
  itemId: number,
  itemName: string,
) => {
  const normalizedItemName = itemName.trim().toLowerCase()

  return packageRows
    .filter((pkg) =>
      pkg.contents.some((content) => {
        const normalizedContent = content.trim().toLowerCase()
        return (
          normalizedContent === normalizedItemName
          || normalizedContent.startsWith(`${normalizedItemName} x`)
          || normalizedContent.includes(`item #${itemId}`)
        )
      }),
    )
    .map((pkg) => pkg.name)
}
