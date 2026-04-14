export interface InventoryItem {
  id: number
  name: string
  category: string
  stock: number
  unit: string
  threshold: number
  foodBankId?: number
}
