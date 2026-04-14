import type { AcceptedItemsGroup, DonationDetails } from './donateGoods.types'

export const ACCEPTED_ITEMS: AcceptedItemsGroup[] = [
  {
    category: 'Non-Perishable Food',
    items: [
      'Canned proteins: tuna, chicken, salmon, corned beef, spam',
      'Canned vegetables: tomatoes, carrots, peas, sweetcorn, mixed vegetables',
      'Canned fruit: peaches, pears, pineapple, fruit cocktail in juice',
      'Pantry staples: pasta, rice, noodles, pasta sauce, cooking sauce',
      'Breakfast foods: cereal, oatmeal, porridge oats, granola bars',
    ],
  },
  {
    category: 'Personal Care & Hygiene',
    items: [
      'Toiletries: shampoo, conditioner, body wash, hand soap, deodorant',
      'Oral care: toothbrushes, toothpaste',
      'Shaving: razors, shaving foam or gel',
      'Feminine hygiene: sanitary pads, tampons',
      'Baby care: nappies, baby wipes, baby food when unopened',
    ],
  },
  {
    category: 'Household & Cleaning',
    items: [
      'Cleaning supplies: washing powder, washing-up liquid, household cleaner',
      'Kitchen essentials: dish soap, sponges, bin bags',
      'Laundry items: fabric softener, stain remover, laundry detergent',
      'Paper products: toilet paper, tissues, paper towels',
      'Air care: air fresheners, disinfectant spray',
    ],
  },
]

export const REJECTED_ITEMS = [
  'Homemade foods',
  'Opened or damaged packages',
  'Dented or bulging cans',
  'Expired items',
  'Perishable foods requiring refrigeration',
  'Glass jars where possible',
]

export const HERO_BENEFITS = [
  'Find and choose a nearby food bank',
  'Your request is sent to the selected team',
  'Pickup or drop-off is arranged locally',
]

export const FLOW_PROGRESS_LABELS = [
  'Search Location',
  'Select Food Bank',
  'Donation Details',
]

export const INITIAL_DETAILS: DonationDetails = {
  name: '',
  email: '',
  phone: '',
  pickupDate: '',
  items: '',
  condition: '',
  quantity: '',
  notes: '',
}

export const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i
export const LOCAL_SEARCH_RADIUS_KM = 5
