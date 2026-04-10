import type { AdminApplicationRecord } from '@/shared/lib/api'
import type { DonationListRow } from '@/shared/types/common'

export const donorTypeLabelMap = {
  supermarket: 'Supermarket',
  individual: 'Individual',
  organization: 'Organization',
} as const

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

export const foodManagementHeroButtonConfig = [
  { targetId: 'donation-intake', label: 'New Donation' },
  { targetId: 'low-stock', label: 'Low Stock Alerts' },
  { targetId: 'package-management', label: 'Package Management' },
  { targetId: 'expiry-tracking', label: 'Expiry Tracking' },
  { targetId: 'code-verification', label: 'Code Verification' },
] as const

export interface PackageDraftRow {
  item_id: number
  quantity: number
}

export interface InventoryDraft {
  name: string
  category: string
  unit: string
  threshold: number
}

export interface InventoryLotRecord {
  id: number
  inventory_item_id: number
  item_name: string
  quantity: number
  expiry_date: string
  received_date: string
  batch_reference?: string | null
  status: 'active' | 'wasted' | 'expired'
  deleted_at?: string | null
}

export interface ScopedFoodBankOption {
  id: number
  name: string
  address?: string | null
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const normalizeLooseText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export const buildIsoDate = (year: number, month: number, day: number): string | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const extractIsoDate = (value?: string | null): string => {
  const trimmed = value?.trim() || ''
  if (!trimmed) {
    return ''
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return buildIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) || ''
  }

  const ukMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (ukMatch) {
    return buildIsoDate(Number(ukMatch[3]), Number(ukMatch[2]), Number(ukMatch[1])) || ''
  }

  return ''
}

export const formatUkDate = (value?: string | null): string => {
  const isoDate = extractIsoDate(value)
  if (!isoDate) {
    return '-'
  }

  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export const formatUkDateInput = (value?: string | null): string => {
  const isoDate = extractIsoDate(value)
  if (!isoDate) {
    return ''
  }

  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export const parseUkDateInput = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const ukMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!ukMatch) {
    return null
  }

  return buildIsoDate(Number(ukMatch[3]), Number(ukMatch[2]), Number(ukMatch[1]))
}

export const normalizeAdminDonationPhone = (value?: string | null): string => {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length === 11 ? digits : '00000000000'
}

export const getDaysUntilDate = (value?: string | null): number | null => {
  const isoDate = extractIsoDate(value)
  if (!isoDate) {
    return null
  }

  const [year, month, day] = isoDate.split('-').map(Number)
  const targetUtc = Date.UTC(year, month - 1, day)
  const now = new Date()
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.ceil((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))
}

export const formatMoney = (amountPence?: number): string =>
  `${'\u00A3'}${((amountPence ?? 0) / 100).toFixed(2)}`

export const normalizeRedemptionCode = (value: string): string => {
  const trimmed = value.trim().toUpperCase()
  const compact = trimmed.replace(/[^A-Z0-9]/g, '')
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`
  }
  if (/^[A-Z]{2}\d{8}$/.test(compact)) {
    return compact
  }
  return trimmed
}

export const inferDonationDonorType = (row: DonationListRow): keyof typeof donorTypeLabelMap => {
  if (row.donor_type && row.donor_type in donorTypeLabelMap) {
    return row.donor_type
  }

  const source = `${row.donor_name ?? ''} ${row.notes ?? ''}`.toLowerCase()
  if (/(tesco|waitrose|aldi|lidl|asda|sainsbury|morrisons|co-op|coop|supermarket|market)/.test(source)) {
    return 'supermarket'
  }
  if (/(community|charity|foundation|trust|church|centre|center|school|organisation|organization|hub)/.test(source)) {
    return 'organization'
  }
  return 'individual'
}

export const donationStatusLabel = (status?: string): string => {
  switch (status) {
    case 'received':
      return 'Received'
    case 'rejected':
      return 'Rejected'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'refunded':
      return 'Refunded'
    default:
      return 'Pending'
  }
}

export const buildDonationDisplayId = (row: DonationListRow): string => {
  const dateToken = extractIsoDate(row.pickup_date || row.created_at).replace(/-/g, '') || '00000000'
  return `D-${dateToken}-${row.id.slice(-4).toUpperCase()}`
}

export const buildDonationTotalLabel = (row: DonationListRow): string => {
  if (row.donation_type === 'cash') {
    return formatMoney(row.amount_pence)
  }
  const total = (row.items ?? []).reduce((sum, item) => sum + item.quantity, 0)
  return String(total)
}

export const getCodeStatusMeta = (record: AdminApplicationRecord): {
  label: string
  color: string
} => {
  if (record.is_voided) {
    return { label: 'Void', color: 'var(--color-error)' }
  }
  if (record.status === 'collected') {
    return { label: 'Redeemed', color: 'var(--color-success)' }
  }
  if (record.status === 'expired') {
    return { label: 'Expired', color: 'var(--color-warning)' }
  }
  return { label: 'Pending', color: 'var(--color-text-medium)' }
}
