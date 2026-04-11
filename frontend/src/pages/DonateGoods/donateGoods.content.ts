export interface DonateGoodsQuickPoint {
  id: string
  text: string
}

export interface DonateGoodsCategory {
  id: string
  category: string
  items: string[]
}

export interface DonateGoodsStep {
  id: number
  label: string
  description: string
}

export interface DonateGoodsOption {
  value: string
  label: string
}

export const DONATE_GOODS_HERO_POINTS: DonateGoodsQuickPoint[] = [
  {
    id: 'choose-bank',
    text: 'Choose the local food bank that should review your offer.',
  },
  {
    id: 'share-details',
    text: 'List the items, quantity, condition, and preferred handover date.',
  },
  {
    id: 'wait-for-confirmation',
    text: 'Wait for the team to confirm whether drop-off or collection works best.',
  },
]

export const DONATE_GOODS_FORM_STEPS: DonateGoodsStep[] = [
  {
    id: 1,
    label: 'Search postcode',
    description: 'Use your postcode to load nearby food banks.',
  },
  {
    id: 2,
    label: 'Choose a food bank',
    description: 'Pick the local team that should review this donation.',
  },
  {
    id: 3,
    label: 'Share donation details',
    description: 'Add the information the food bank needs to contact you.',
  },
]

export const DONATE_GOODS_PRE_DONATION_NOTES: string[] = [
  'Wait for confirmation before travelling to the site.',
  'Collection depends on volunteers, vehicle access, and storage space.',
  'Short item lists and clear quantity notes help local teams reply faster.',
  'If the donation is large, mention how many bags, boxes, or trays you have.',
]

export const DONATE_GOODS_ACCEPTED_CATEGORIES: DonateGoodsCategory[] = [
  {
    id: 'cupboard-food',
    category: 'Cupboard food',
    items: [
      'Tinned beans, fish, meat, vegetables, and tomatoes',
      'Rice, pasta, cereal, oats, noodles, and other dry staples',
      'Soup, sauces, long-life milk, and shelf-stable drinks',
    ],
  },
  {
    id: 'hygiene-items',
    category: 'Hygiene and baby items',
    items: [
      'Soap, shampoo, toothpaste, toothbrushes, and deodorant',
      'Sanitary products, nappies, baby wipes, and unopened baby food',
      'Razors, shaving gel, and sealed personal care products',
    ],
  },
  {
    id: 'household-items',
    category: 'Household essentials',
    items: [
      'Laundry detergent, washing-up liquid, and surface cleaner',
      'Toilet roll, tissues, paper towels, and bin bags',
      'Other sealed cleaning or household basics',
    ],
  },
]

export const DONATE_GOODS_REJECTED_ITEMS = [
  'Homemade foods',
  'Opened or damaged packages',
  'Dented or bulging cans',
  'Expired items',
  'Perishable foods requiring refrigeration',
  'Glass jars where possible',
]

export const DONATE_GOODS_CONDITION_OPTIONS: DonateGoodsOption[] = [
  { value: '', label: 'Select condition' },
  { value: 'New or unopened', label: 'New or unopened' },
  { value: 'Excellent', label: 'Excellent' },
  { value: 'Good', label: 'Good' },
]
