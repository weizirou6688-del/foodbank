export interface PackageItem {
  name: string
  qty: number
}

export interface FoodPackage {
  id: number
  name: string
  category: string
  description: string
  items: PackageItem[]
  stock: number
  threshold: number
  appliedCount: number
  image: string
}
