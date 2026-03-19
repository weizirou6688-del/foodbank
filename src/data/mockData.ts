import type { User, FoodBank, FoodPackage, RestockRequest, InventoryItem } from '@/types'

// ── Mock Users ────────────────────────────────────────────────
export const MOCK_USERS: (User & { password: string })[] = [
  { id: '1', name: 'Admin User',    email: 'admin@foodbank.com',  password: 'admin123',  role: 'admin'       },
  { id: '2', name: 'Tesco Express', email: 'supermarket@foodbank.com', password: 'supermarket123', role: 'supermarket' },
  { id: '3', name: 'Jane Smith',    email: 'user@example.com',    password: 'user123',   role: 'public'      },
]

// ── Mock Food Banks ───────────────────────────────────────────
export const MOCK_FOOD_BANKS: FoodBank[] = [
  {
    id: 1,
    name: 'Downtown Community Food Bank',
    address: '123 Main Street, London, SW1A 1AA',
    distance: 0.8,
    hours: ['Tuesday 10:00 am – 12:00 pm', 'Thursday 10:00 am – 1:00 pm'],
    lat: 51.5074,
    lng: -0.1278,
  },
  {
    id: 2,
    name: 'Westside Food Support Centre',
    address: '88 King Street, London, W1K 1AA',
    distance: 1.2,
    hours: ['Wednesday 9:00 am – 12:00 pm', 'Friday 10:00 am – 2:00 pm'],
    lat: 51.513,
    lng: -0.145,
  },
  {
    id: 3,
    name: 'Southbank Foodbank Hub',
    address: '45 Borough Road, London, SE1 1JG',
    distance: 1.9,
    hours: ['Monday 11:00 am – 1:00 pm', 'Saturday 10:00 am – 12:00 pm'],
    lat: 51.5017,
    lng: -0.104,
  },
]

// ── Mock Food Packages ────────────────────────────────────────
export const MOCK_PACKAGES: FoodPackage[] = [
  {
    id: 1,
    name: 'Basic Essentials Package',
    category: 'Carbohydrates & Grains',
    description: 'Core staples for individuals or couples.',
    items: [
      { name: 'Rice (2kg)',        qty: 1 },
      { name: 'Pasta (500g)',      qty: 2 },
      { name: 'Canned Beans',      qty: 2 },
      { name: 'UHT Milk (1L)',     qty: 1 },
    ],
    stock: 18,
    threshold: 5,
    appliedCount: 42,
    image: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&q=80',
  },
  {
    id: 2,
    name: 'Family Support Package',
    category: 'Mixed',
    description: 'Balanced nutrition for families of 3–5.',
    items: [
      { name: 'Wholemeal Bread',            qty: 2 },
      { name: 'Mixed Vegetables (frozen)',  qty: 1 },
      { name: 'Tomato Soup (400g)',         qty: 3 },
      { name: 'Cornflakes Cereal',          qty: 1 },
    ],
    stock: 12,
    threshold: 5,
    appliedCount: 31,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
  },
  {
    id: 3,
    name: 'Protein & Meat Package',
    category: 'Proteins & Meat',
    description: 'High-protein items including canned meats.',
    items: [
      { name: 'Canned Tuna',              qty: 3 },
      { name: 'Chicken Breast (canned)',  qty: 2 },
      { name: 'Lentils (500g)',           qty: 1 },
      { name: 'Eggs (6-pack)',            qty: 1 },
    ],
    stock: 4,
    threshold: 5,
    appliedCount: 19,
    image: 'https://images.unsplash.com/photo-1611171711791-b34f5ff41f1c?w=400&q=80',
  },
  {
    id: 4,
    name: 'Fresh Veg & Staples Package',
    category: 'Vegetables & Fruits',
    description: 'Fresh and dried produce for a healthy diet.',
    items: [
      { name: 'Potatoes (1kg)', qty: 1 },
      { name: 'Carrots (500g)', qty: 1 },
      { name: 'Onions (500g)',  qty: 1 },
      { name: 'Canned Tomatoes', qty: 2 },
    ],
    stock: 9,
    threshold: 5,
    appliedCount: 27,
    image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=400&q=80',
  },
]

// ── Mock Restock Requests ─────────────────────────────────────
export const MOCK_RESTOCK_REQUESTS: RestockRequest[] = [
  { id: 1, foodName: 'Rice (2kg)',               currentStock: 2,  threshold: 10, urgency: 'Critical' },
  { id: 2, foodName: 'UHT Milk (1L)',            currentStock: 3,  threshold: 12, urgency: 'Urgent'   },
  { id: 3, foodName: 'Mixed Vegetables (frozen)', currentStock: 4, threshold: 10, urgency: 'Urgent'   },
  { id: 4, foodName: 'Canned Tuna',              currentStock: 6,  threshold: 10, urgency: 'Low'      },
]

// ── Mock Inventory Items ──────────────────────────────────────
export const MOCK_INVENTORY_ITEMS: InventoryItem[] = [
  { id: 101, name: 'Canned Tuna',             category: 'Proteins & Meat',       stock: 45, unit: 'cans',    threshold: 10 },
  { id: 102, name: 'Chicken Breast (canned)', category: 'Proteins & Meat',       stock: 30, unit: 'cans',    threshold: 10 },
  { id: 201, name: 'Rice (2kg)',              category: 'Carbohydrates & Grains', stock: 38, unit: 'bags',    threshold: 10 },
  { id: 202, name: 'Pasta (500g)',            category: 'Carbohydrates & Grains', stock: 55, unit: 'packs',   threshold: 15 },
  { id: 301, name: 'Canned Tomatoes',         category: 'Vegetables & Fruits',    stock: 60, unit: 'cans',    threshold: 15 },
  { id: 302, name: 'Mixed Vegetables',        category: 'Vegetables & Fruits',    stock: 4,  unit: 'bags',    threshold: 10 },
  { id: 401, name: 'UHT Milk (1L)',           category: 'Condiments & Pantry',    stock: 2,  unit: 'cartons', threshold: 12 },
  { id: 402, name: 'Canned Beans',            category: 'Condiments & Pantry',    stock: 48, unit: 'cans',    threshold: 12 },
]

// ── Weekly collection tracker (mock) ─────────────────────────
export const WEEKLY_COLLECTION_LIMIT = 3

export const mockWeeklyCollections: Record<string, number> = {
  'user@example.com': 1,
}

// ── Helper: generate redemption code ─────────────────────────
export function generateRedemptionCode(): string {
  return 'FB-' + Math.random().toString(36).substring(2, 8).toUpperCase()
}
