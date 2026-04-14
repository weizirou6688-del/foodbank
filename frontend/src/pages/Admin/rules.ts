import type { Dispatch, SetStateAction } from 'react'
import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import type { DonationListRow } from '@/shared/types/donations'
import type { DonationDonorType, DonationStatusFilter, PackageRow } from './adminFoodManagement.types'
import {
  buildDonationDisplayId,
  buildDonationTotalLabel,
  donationStatusLabel,
  donorTypeLabelMap,
  formatUkDate,
  getCodeStatusMeta,
  inferDonationDonorType,
} from './formatting'

type StateSetter<T> = Dispatch<SetStateAction<T>>
type ApplicationStatusFilter = 'pending' | 'redeemed' | 'expired' | 'void'
type SearchFragment = string | number | null | undefined
type CancelGuard = (() => boolean) | undefined

interface ManagedRequestOptions<Result> {
  request: () => Promise<Result>
  fallbackMessage: string
  setLoading?: StateSetter<boolean>
  setError?: StateSetter<string>
  onSuccess?: (result: Result) => void
  onError?: (message: string) => void
  isCancelled?: CancelGuard
  rethrow?: boolean
}

const runIfActive = (isCancelled: CancelGuard, action: () => void) => {
  if (!isCancelled?.()) action()
}

export const toErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)

export const captureRequestError = async (request: () => Promise<unknown>, fallbackMessage: string) => {
  try {
    await request()
    return ''
  } catch (error) {
    return toErrorMessage(error, fallbackMessage)
  }
}

export const runManagedRequest = async <Result>({
  request,
  fallbackMessage,
  setLoading,
  setError,
  onSuccess,
  onError,
  isCancelled,
  rethrow = false,
}: ManagedRequestOptions<Result>) => {
  runIfActive(isCancelled, () => {
    setLoading?.(true)
    setError?.('')
  })

  try {
    const result = await request()
    runIfActive(isCancelled, () => onSuccess?.(result))
    return ''
  } catch (error) {
    const message = toErrorMessage(error, fallbackMessage)
    runIfActive(isCancelled, () => {
      setError?.(message)
      onError?.(message)
    })
    if (rethrow) throw error
    return message
  } finally {
    runIfActive(isCancelled, () => setLoading?.(false))
  }
}

export const extractApplications = (data: unknown): AdminApplicationRecord[] => {
  if (Array.isArray(data)) return data as AdminApplicationRecord[]
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: AdminApplicationRecord[] }).items
  }
  return []
}

export const findPackagesReferencingItem = (packageRows: PackageRow[], itemId: number, itemName: string) => {
  const normalizedItemName = itemName.trim().toLowerCase()
  return packageRows
    .filter((pkg) =>
      pkg.contents.some((content) => {
        const normalizedContent = content.trim().toLowerCase()
        return (
          normalizedContent === normalizedItemName ||
          normalizedContent.startsWith(`${normalizedItemName} x`) ||
          normalizedContent.includes(`item #${itemId}`)
        )
      }),
    )
    .map((pkg) => pkg.name)
}

const toTimestamp = (value?: string | null) => {
  const timestamp = Date.parse(value ?? '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const normalizeSearch = (value: string) => value.trim().toLowerCase()
export const matchesSearch = (needle: string, ...values: SearchFragment[]) => !needle || values.join(' ').toLowerCase().includes(needle)
export const sortDonations = (rows: DonationListRow[]) => [...rows].sort((left, right) => toTimestamp(right.pickup_date ?? right.created_at) - toTimestamp(left.pickup_date ?? left.created_at))
export const sortApplications = (rows: AdminApplicationRecord[]) => [...rows].sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
export const getDonationDonorType = (row: DonationListRow): DonationDonorType => inferDonationDonorType(row)
export const getDonationDonorTypeLabel = (row: DonationListRow) => donorTypeLabelMap[getDonationDonorType(row)]
export const getDonationDateLabel = (row: DonationListRow) => formatUkDate(row.pickup_date || row.created_at)
export const getDonationStatusLabel = (row: DonationListRow) => donationStatusLabel(row.status)
export const isPendingGoodsDonation = (row: DonationListRow) => row.donation_type === 'goods' && row.status === 'pending'
export const canEditDonation = (row: DonationListRow) => row.donation_type === 'goods' && !isPendingGoodsDonation(row)

export const buildDonationDetailsRows = (row: DonationListRow) => {
  if (row.donation_type === 'cash') {
    return [{ name: row.donation_frequency === 'monthly' ? 'Monthly Cash Donation' : 'One-Time Cash Donation', quantityLabel: buildDonationTotalLabel(row), expiryLabel: '-' }]
  }

  return (row.items ?? []).map((item) => ({ name: item.item_name, quantityLabel: String(item.quantity), expiryLabel: formatUkDate(item.expiry_date) }))
}

export const filterDonations = (
  donations: DonationListRow[],
  search: string,
  donorTypeFilter: DonationDonorType | 'all',
  statusFilter: DonationStatusFilter,
) => {
  const needle = normalizeSearch(search)
  return donations.filter((row) => {
    if (donorTypeFilter !== 'all' && getDonationDonorType(row) !== donorTypeFilter) return false
    if (statusFilter !== 'all' && (row.status ?? 'pending') !== statusFilter) return false
    return matchesSearch(
      needle,
      buildDonationDisplayId(row),
      getDonationDonorTypeLabel(row),
      row.donor_name,
      row.donor_email,
      row.donor_phone,
      getDonationDateLabel(row),
      getDonationStatusLabel(row),
      buildDonationTotalLabel(row),
      row.donation_frequency === 'monthly' ? 'monthly' : 'one-time',
      row.subscription_reference,
      ...(row.items ?? []).map((item) => item.item_name),
    )
  })
}

const getApplicationStatusValue = (record: AdminApplicationRecord): ApplicationStatusFilter => {
  if (record.is_voided) return 'void'
  if (record.status === 'collected') return 'redeemed'
  if (record.status === 'expired') return 'expired'
  return 'pending'
}

export const getApplicationStatusLabel = (record: AdminApplicationRecord) => getCodeStatusMeta(record).label
export const getApplicationStatusTone = (record: AdminApplicationRecord) => {
  switch (getApplicationStatusValue(record)) {
    case 'redeemed': return 'success'
    case 'expired': return 'warning'
    case 'void': return 'error'
    default: return 'muted'
  }
}

export const getApplicationPackageLabel = (record: AdminApplicationRecord) => {
  if (record.package_name?.trim()) return record.package_name.trim()
  if (record.items.length === 0) return 'Package unavailable'
  if (record.items.length === 1) return record.items[0].name
  return `${record.items[0].name} +${record.items.length - 1} more`
}

export const canVoidApplication = (record: AdminApplicationRecord) => !record.is_voided && record.status === 'pending'
export const canRedeemApplication = (record: AdminApplicationRecord) => !record.is_voided && record.status === 'pending'

export const filterApplications = (applications: AdminApplicationRecord[], search: string) => {
  const needle = normalizeSearch(search)
  return applications.filter((record) => matchesSearch(
    needle,
    record.redemption_code,
    getApplicationPackageLabel(record),
    getApplicationStatusLabel(record),
    formatUkDate(record.created_at),
    formatUkDate(record.redeemed_at),
    ...record.items.map((item) => item.name),
  ))
}