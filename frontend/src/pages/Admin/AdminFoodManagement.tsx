import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import type { AdminApplicationRecord, FoodPackageDetailRecord } from '@/shared/lib/api'
import type { DonationListRow, FoodBank, InventoryItem } from '@/shared/types/common'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import { adminAPI, applicationsAPI, foodBanksAPI, restockAPI } from '@/shared/lib/api'
import AdminReactPageFrame from './AdminReactPageFrame'
import {
  CodeDetailsModal,
  CodeVerifyModal,
  DonationDetailsModal,
  DonationEditorModal,
  InlineConfirmModal,
  InventoryItemEditorModal,
  InventoryStockInModal,
  LotExpiryModal,
  PackageEditorModal,
  PackingModal,
} from './adminFoodManagement.modals'
import {
  AdminCodesSection,
  AdminDonationsSection,
  AdminItemsSection,
  AdminLotsSection,
  AdminPackagesSection,
} from './adminFoodManagement.sections'
import type {
  CodeStatusFilter,
  CodeVerifyResult,
  CodeVoidTarget,
  DeleteItemTarget,
  DonationDeleteTarget,
  DonationDonorType,
  DonationEditorDraft,
  DonationEditorItemDraft,
  DonationEditorTarget,
  DonationStatusFilter,
  InventoryEditorDraft,
  InventoryStockInDraft,
  LotDeleteTarget,
  LotExpiryTarget,
  LotStatusTarget,
  LowStockRow,
  NameThresholdTarget,
  PackageEditorDraft,
  PackageEditorRowDraft,
  PackageRow,
  PageFeedback,
  PackingStockCheckRow,
  PendingAction,
  RestockConfirmTarget,
} from './adminFoodManagement.types'
import {
  canRedeemApplication,
  canVoidApplication,
  filterApplications,
  filterDonations,
  findPackagesReferencingItem,
  getApplicationPackageLabel,
  getApplicationStatusLabel,
  getDonationDonorType,
  getRestockUrgency,
  toErrorMessage,
} from './adminFoodManagement.utils'
import {
  inventoryCategoryOptions,
  packageCategoryOptions,
} from './adminFoodManagement.constants'
import {
  buildDonationDisplayId,
  formatUkDate,
  formatUkDateInput,
  normalizeAdminDonationPhone,
  normalizeRedemptionCode,
  parseUkDateInput,
} from './adminFoodManagementPreview.shared'
import { adminFoodManagementReactStyleText } from './adminReactStyles'
import referenceStyleText from './adminFoodManagement.reference.css?raw'
import { useAdminFoodManagementData } from './useAdminFoodManagementData'

let donationDraftRowCounter = 0
let packageDraftRowCounter = 0

const sessionExpiredMessage = 'Please login again and retry.'
const donorEmailPattern = /\S+@\S+\.\S+/
const HERO_FEATURES = [
  'Real-time inventory tracking',
  'Automated low stock alerts',
  'End-to-end donation tracking',
]

function nextDonationDraftRowKey() {
  donationDraftRowCounter += 1
  return `donation-row-${donationDraftRowCounter}`
}

function createDonationDraftItem(): DonationEditorItemDraft {
  return {
    key: nextDonationDraftRowKey(),
    itemName: '',
    quantity: '1',
    expiryDate: '',
  }
}

function createEmptyDonationDraft(): DonationEditorDraft {
  return {
    donorType: '',
    donorName: '',
    donorEmail: '',
    receivedDate: '',
    items: [createDonationDraftItem()],
  }
}

function nextPackageDraftRowKey() {
  packageDraftRowCounter += 1
  return `package-row-${packageDraftRowCounter}`
}

function createPackageDraftRow(
  itemId = '',
  quantity = '1',
): PackageEditorRowDraft {
  return {
    key: nextPackageDraftRowKey(),
    itemId,
    quantity,
  }
}

function createEmptyInventoryDraft(item?: InventoryItem | null): InventoryEditorDraft {
  return {
    name: item?.name ?? '',
    category: item?.category ?? inventoryCategoryOptions[0],
    unit: item?.unit ?? '',
    threshold: item ? String(item.threshold) : '0',
  }
}

function createEmptyStockInDraft(): InventoryStockInDraft {
  return {
    quantity: '1',
    expiryDate: '',
  }
}

function createEmptyPackageDraft(): PackageEditorDraft {
  return {
    name: '',
    category: packageCategoryOptions[0],
    threshold: '0',
    contents: [createPackageDraftRow()],
  }
}

function buildPackageDraft(detail: FoodPackageDetailRecord): PackageEditorDraft {
  return {
    name: detail.name,
    category: detail.category || packageCategoryOptions[0],
    threshold: String(detail.threshold ?? 0),
    contents:
      detail.package_items.length > 0
        ? detail.package_items.map((item) =>
            createPackageDraftRow(String(item.inventory_item_id), String(item.quantity)),
          )
        : [createPackageDraftRow()],
  }
}

function buildLotReference(lot: {
  id: number
  batch_reference?: string | null
}) {
  return lot.batch_reference?.trim() || `LOT-${String(lot.id).padStart(4, '0')}`
}

function buildScopedPackageRow(detail: FoodPackageDetailRecord): PackageRow {
  return {
    key: `detail-${detail.id}`,
    id: detail.id,
    name: detail.name,
    category: detail.category,
    threshold: detail.threshold,
    stock: detail.stock,
    contents: detail.package_items.map((item) => `${item.inventory_item_name} x${item.quantity}`),
  }
}

interface ManagementSectionProps {
  id: string
  title: string
  description: string
  children: ReactNode
}

function ManagementSection({
  id,
  title,
  description,
  children,
}: ManagementSectionProps) {
  return (
    <section className="section" id={id}>
      <div className="container">
        <h2 className="section-title">{title}</h2>
        <p className="section-subtitle">{description}</p>
        {children}
      </div>
    </section>
  )
}

function buildDonationDraft(donation: DonationListRow): DonationEditorDraft {
  return {
    donorType: getDonationDonorType(donation),
    donorName: donation.donor_name ?? '',
    donorEmail: donation.donor_email ?? '',
    receivedDate: formatUkDateInput(donation.pickup_date || donation.created_at),
    items:
      donation.items && donation.items.length > 0
        ? donation.items.map((item) => ({
            key: nextDonationDraftRowKey(),
            itemName: item.item_name,
            quantity: String(item.quantity),
            expiryDate: formatUkDateInput(item.expiry_date),
          }))
        : [createDonationDraftItem()],
  }
}

function buildCodeVerifyResult(record: AdminApplicationRecord): CodeVerifyResult {
  if (record.is_voided) {
    return {
      tone: 'error',
      title: 'Code Voided',
      message: `Package: ${getApplicationPackageLabel(record)}\nGenerated At: ${formatUkDate(record.created_at)}\nStatus: ${getApplicationStatusLabel(record)}`,
      record,
    }
  }

  if (record.status === 'collected') {
    return {
      tone: 'info',
      title: 'Already Redeemed',
      message: `Package: ${getApplicationPackageLabel(record)}\nGenerated At: ${formatUkDate(record.created_at)}\nStatus: ${getApplicationStatusLabel(record)}`,
      record,
    }
  }

  if (record.status === 'expired') {
    return {
      tone: 'info',
      title: 'Code Expired',
      message: `Package: ${getApplicationPackageLabel(record)}\nGenerated At: ${formatUkDate(record.created_at)}\nStatus: ${getApplicationStatusLabel(record)}`,
      record,
    }
  }

  return {
    tone: 'success',
    title: 'Code Valid',
    message: `Package: ${getApplicationPackageLabel(record)}\nGenerated At: ${formatUkDate(record.created_at)}\nStatus: ${getApplicationStatusLabel(record)}`,
    record,
  }
}

export default function AdminFoodManagement() {
  const user = useAuthStore((state) => state.user)
  const adminScope = useMemo(() => getAdminScopeMeta(user), [user])
  const [inventorySearch, setInventorySearch] = useState('')
  const [selectedFoodBankId, setSelectedFoodBankId] = useState<number | null>(adminScope.foodBankId)
  const [availableFoodBanks, setAvailableFoodBanks] = useState<FoodBank[]>([])
  const [availableFoodBanksError, setAvailableFoodBanksError] = useState('')
  const [itemEditorTarget, setItemEditorTarget] = useState<{ mode: 'create' | 'edit'; itemId: number | null } | null>(null)
  const [itemEditorDraft, setItemEditorDraft] = useState<InventoryEditorDraft>(createEmptyInventoryDraft)
  const [itemEditorError, setItemEditorError] = useState('')
  const [isItemEditorSubmitting, setIsItemEditorSubmitting] = useState(false)
  const [stockInTarget, setStockInTarget] = useState<InventoryItem | null>(null)
  const [stockInDraft, setStockInDraft] = useState<InventoryStockInDraft>(createEmptyStockInDraft)
  const [stockInError, setStockInError] = useState('')
  const [isStockingIn, setIsStockingIn] = useState(false)
  const [packageEditorTarget, setPackageEditorTarget] = useState<{ mode: 'create' | 'edit'; packageId: number | null } | null>(null)
  const [packageEditorDraft, setPackageEditorDraft] = useState<PackageEditorDraft>(createEmptyPackageDraft)
  const [packageEditorError, setPackageEditorError] = useState('')
  const [isPackageEditorSubmitting, setIsPackageEditorSubmitting] = useState(false)
  const [scopedPackageDetails, setScopedPackageDetails] = useState<FoodPackageDetailRecord[]>([])
  const [isLoadingScopedPackages, setIsLoadingScopedPackages] = useState(false)
  const [scopedPackageError, setScopedPackageError] = useState('')
  const [packageDetailsById, setPackageDetailsById] = useState<Record<number, FoodPackageDetailRecord>>({})
  const [isLoadingPackageDetail, setIsLoadingPackageDetail] = useState(false)
  const [packPackageId, setPackPackageId] = useState<number | ''>('')
  const [packQuantity, setPackQuantity] = useState('1')
  const [isPacking, setIsPacking] = useState(false)
  const [packFeedback, setPackFeedback] = useState('')
  const [restockActionId, setRestockActionId] = useState<number | null>(null)
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null)
  const [lotExpiryTarget, setLotExpiryTarget] = useState<LotExpiryTarget | null>(null)
  const [lotExpiryError, setLotExpiryError] = useState('')
  const [lotStatusTarget, setLotStatusTarget] = useState<LotStatusTarget | null>(null)
  const [lotDeleteTarget, setLotDeleteTarget] = useState<LotDeleteTarget | null>(null)
  const [isDeletingLot, setIsDeletingLot] = useState(false)
  const [deleteItemTarget, setDeleteItemTarget] = useState<DeleteItemTarget | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [restockConfirmTarget, setRestockConfirmTarget] = useState<RestockConfirmTarget | null>(null)
  const [donationSearch, setDonationSearch] = useState('')
  const [donationDonorTypeFilter, setDonationDonorTypeFilter] = useState<DonationDonorType | 'all'>('all')
  const [donationStatusFilter, setDonationStatusFilter] = useState<DonationStatusFilter>('all')
  const [selectedDonationIds, setSelectedDonationIds] = useState<string[]>([])
  const [donationEditorTarget, setDonationEditorTarget] = useState<DonationEditorTarget | null>(null)
  const [donationDraft, setDonationDraft] = useState<DonationEditorDraft>(createEmptyDonationDraft)
  const [donationEditorError, setDonationEditorError] = useState('')
  const [donationViewTarget, setDonationViewTarget] = useState<DonationListRow | null>(null)
  const [deleteDonationTarget, setDeleteDonationTarget] = useState<DonationDeleteTarget | null>(null)
  const [codeSearch, setCodeSearch] = useState('')
  const [codeStatusFilter] = useState<CodeStatusFilter>('all')
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([])
  const [isCodeVerifyOpen, setIsCodeVerifyOpen] = useState(false)
  const [verifyCodeInput, setVerifyCodeInput] = useState('')
  const [codeVerifyResult, setCodeVerifyResult] = useState<CodeVerifyResult | null>(null)
  const [codeViewTarget, setCodeViewTarget] = useState<AdminApplicationRecord | null>(null)
  const [voidCodeTarget, setVoidCodeTarget] = useState<CodeVoidTarget | null>(null)
  const [toastMessage, setToastMessage] = useState('Saved successfully.')
  const [isToastVisible, setIsToastVisible] = useState(false)
  const {
    accessToken,
    inventory,
    deleteItem,
    isLoadingData,
    loadError,
    lotRows,
    isLoadingLots,
    lotError,
    lowStockError,
    isLoadingRestockRequests,
    restockError,
    donations,
    isLoadingDonations,
    donationError,
    applications,
    isLoadingApplications,
    applicationsError,
    openRestockRequests,
    openRestockItemIds,
    refreshInventoryAndLots,
    refreshLotAndLowStock,
    refreshRestockAndLowStock,
    refreshRestockInventoryAndLots,
    reloadAllData,
  } = useAdminFoodManagementData(inventorySearch)

  const effectiveFoodBankId = adminScope.foodBankId ?? selectedFoodBankId
  const isScopedSelectionRequired = adminScope.isPlatformAdmin && adminScope.foodBankId == null
  const foodBankFilterOptions = useMemo(
    () =>
      [...availableFoodBanks].sort((left, right) => left.name.localeCompare(right.name)),
    [availableFoodBanks],
  )
  const scopedInventoryItems = useMemo(() => {
    if (adminScope.isLocalFoodBankAdmin) {
      return inventory
    }

    if (effectiveFoodBankId == null) {
      return []
    }

    return inventory.filter((item) => item.foodBankId === effectiveFoodBankId)
  }, [adminScope.isLocalFoodBankAdmin, effectiveFoodBankId, inventory])
  const scopedPackageRows = useMemo(
    () => scopedPackageDetails.map((detail) => buildScopedPackageRow(detail)),
    [scopedPackageDetails],
  )
  const scopedPackingPackages = useMemo(
    () => scopedPackageDetails.map((detail) => ({ id: detail.id, name: detail.name })),
    [scopedPackageDetails],
  )
  const scopeSelectorKey = `${adminScope.scopeKind}:${effectiveFoodBankId ?? 'none'}`
  const inventorySearchDisabled = isScopedSelectionRequired && effectiveFoodBankId == null
  const packageSearchDisabled = isScopedSelectionRequired && effectiveFoodBankId == null
  const inventorySectionError = availableFoodBanksError
  const packageSectionError = availableFoodBanksError || scopedPackageError

  const applyScopedPackageDetails = (details: FoodPackageDetailRecord[]) => {
    const sortedDetails = [...details].sort((left, right) => left.name.localeCompare(right.name))

    setScopedPackageDetails(sortedDetails)
    setPackageDetailsById((current) => {
      const next = { ...current }

      for (const detail of sortedDetails) {
        next[detail.id] = detail
      }

      return next
    })
  }

  const refreshScopedPackages = async () => {
    if (!accessToken || effectiveFoodBankId == null) {
      setScopedPackageDetails([])
      setScopedPackageError('')
      return
    }

    setIsLoadingScopedPackages(true)
    setScopedPackageError('')

    try {
      const details = await adminAPI.listFoodPackages(accessToken, { foodBankId: effectiveFoodBankId })
      applyScopedPackageDetails(Array.isArray(details) ? details : [])
    } catch (error) {
      setScopedPackageDetails([])
      setScopedPackageError(toErrorMessage(error, 'Failed to load food packages.'))
    } finally {
      setIsLoadingScopedPackages(false)
    }
  }

  const itemOptions = useMemo(
    () =>
      Array.from(
        new Set(
          inventory
            .map((item) => item.name.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [inventory],
  )

  const filteredDonations = useMemo(
    () =>
      filterDonations(
        donations,
        donationSearch,
        donationDonorTypeFilter,
        donationStatusFilter,
      ),
    [donations, donationSearch, donationDonorTypeFilter, donationStatusFilter],
  )
  const filteredApplications = useMemo(
    () => filterApplications(applications, codeSearch, codeStatusFilter),
    [applications, codeSearch, codeStatusFilter],
  )
  const selectedDonationIdSet = useMemo(() => new Set(selectedDonationIds), [selectedDonationIds])
  const selectedCodeIdSet = useMemo(() => new Set(selectedCodeIds), [selectedCodeIds])
  const packingStockCheckRows = useMemo<PackingStockCheckRow[]>(() => {
    if (packPackageId === '') {
      return []
    }

    const detail = packageDetailsById[packPackageId]
    if (!detail) {
      return []
    }

    return detail.package_items.map((item) => {
      const inventoryItem = scopedInventoryItems.find((entry) => entry.id === item.inventory_item_id)

      return {
        itemId: item.inventory_item_id,
        name: item.inventory_item_name,
        requiredQuantity: item.quantity,
        availableQuantity: inventoryItem?.stock ?? 0,
        unit: inventoryItem?.unit ?? item.inventory_item_unit ?? 'units',
      }
    })
  }, [packPackageId, packageDetailsById, scopedInventoryItems])
  const heroActions = [
    { label: 'New Donation', href: '#donation-intake' },
    { label: 'Low Stock Alerts', href: '#low-stock' },
    { label: 'Package Management', href: '#package-management' },
    { label: 'Expiry Tracking', href: '#expiry-tracking' },
    { label: 'Code Verification', href: '#code-verification' },
  ] as const

  useEffect(() => {
    setSelectedDonationIds([])
  }, [donations, donationSearch, donationDonorTypeFilter, donationStatusFilter])

  useEffect(() => {
    setSelectedCodeIds([])
  }, [applications, codeSearch, codeStatusFilter])

  useEffect(() => {
    if (adminScope.foodBankId != null) {
      setSelectedFoodBankId(adminScope.foodBankId)
    } else if (!adminScope.isPlatformAdmin) {
      setSelectedFoodBankId(null)
    }
  }, [adminScope.foodBankId, adminScope.isPlatformAdmin])

  useEffect(() => {
    if (!isScopedSelectionRequired) {
      setAvailableFoodBanks([])
      setAvailableFoodBanksError('')
      return
    }

    let cancelled = false

    const loadAvailableFoodBanks = async () => {
      try {
        const response = await foodBanksAPI.getFoodBanks()
        const items = Array.isArray(response?.items) ? response.items : []
        if (!cancelled) {
          setAvailableFoodBanks(items)
          setAvailableFoodBanksError('')
        }
      } catch (error) {
        if (!cancelled) {
          setAvailableFoodBanks([])
          setAvailableFoodBanksError(toErrorMessage(error, 'Failed to load food banks.'))
        }
      }
    }

    void loadAvailableFoodBanks()

    return () => {
      cancelled = true
    }
  }, [isScopedSelectionRequired])

  useEffect(() => {
    if (!accessToken || effectiveFoodBankId == null) {
      setScopedPackageDetails([])
      setScopedPackageError('')
      setIsLoadingScopedPackages(false)
      return
    }

    let cancelled = false

    const loadScopedPackages = async () => {
      setIsLoadingScopedPackages(true)
      setScopedPackageError('')

      try {
        const details = await adminAPI.listFoodPackages(accessToken, { foodBankId: effectiveFoodBankId })
        if (!cancelled) {
          applyScopedPackageDetails(Array.isArray(details) ? details : [])
        }
      } catch (error) {
        if (!cancelled) {
          setScopedPackageDetails([])
          setScopedPackageError(toErrorMessage(error, 'Failed to load food packages.'))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingScopedPackages(false)
        }
      }
    }

    void loadScopedPackages()

    return () => {
      cancelled = true
    }
  }, [accessToken, effectiveFoodBankId])

  useEffect(() => {
    if (isScopedSelectionRequired) {
      setInventorySearch('')
    }
  }, [isScopedSelectionRequired, selectedFoodBankId])

  useEffect(() => {
    document.title = 'Inventory Management - ABC Foodbank'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const isActionBusy = (action: typeof pendingAction) => pendingAction === action

  const getLotOrNotify = (lotId: number) => {
    const lot = lotRows.find((entry) => entry.id === lotId)
    if (!lot) {
      setPageFeedback({ tone: 'error', message: 'Inventory lot not found.' })
      return null
    }

    return lot
  }

  const closeDonationEditor = () => {
    setDonationEditorTarget(null)
    setDonationDraft(createEmptyDonationDraft())
    setDonationEditorError('')
  }

  const closeCodeVerifyModal = () => {
    setIsCodeVerifyOpen(false)
    setVerifyCodeInput('')
    setCodeVerifyResult(null)
  }

  const resolveCreationFoodBankId = () => adminScope.foodBankId ?? selectedFoodBankId

  const ensurePackageDetail = async (packageId: number) => {
    const scopedDetail = scopedPackageDetails.find((entry) => entry.id === packageId)
    if (scopedDetail) {
      setPackageDetailsById((current) => ({
        ...current,
        [packageId]: scopedDetail,
      }))
      return scopedDetail
    }

    const cached = packageDetailsById[packageId]
    if (cached) {
      return cached
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return null
    }

    setIsLoadingPackageDetail(true)
    try {
      const detail = await adminAPI.getFoodPackageDetail(packageId, accessToken)
      setPackageDetailsById((current) => ({
        ...current,
        [packageId]: detail,
      }))
      return detail
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to load package details.') })
      return null
    } finally {
      setIsLoadingPackageDetail(false)
    }
  }

  const closeItemEditor = () => {
    setItemEditorTarget(null)
    setItemEditorDraft(createEmptyInventoryDraft())
    setItemEditorError('')
  }

  const openNewItemEditor = () => {
    if (!resolveCreationFoodBankId()) {
      setPageFeedback({ tone: 'error', message: 'Choose a food bank before creating an item.' })
      return
    }

    setItemEditorTarget({ mode: 'create', itemId: null })
    setItemEditorDraft(createEmptyInventoryDraft())
    setItemEditorError('')
  }

  const openEditItemEditor = (target: NameThresholdTarget) => {
    const item = scopedInventoryItems.find((entry) => entry.id === target.id)
    if (!item) {
      setPageFeedback({ tone: 'error', message: 'Inventory item not found.' })
      return
    }

    setItemEditorTarget({ mode: 'edit', itemId: item.id })
    setItemEditorDraft(createEmptyInventoryDraft(item))
    setItemEditorError('')
  }

  const updateItemDraftField = (field: keyof InventoryEditorDraft, value: string) => {
    setItemEditorDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const submitItemEditor = async () => {
    if (!accessToken || !itemEditorTarget) {
      setItemEditorError(sessionExpiredMessage)
      return
    }

    const name = itemEditorDraft.name.trim()
    const category = itemEditorDraft.category.trim()
    const unit = itemEditorDraft.unit.trim()
    const threshold = Number(itemEditorDraft.threshold)

    if (!name || !category || !unit) {
      setItemEditorError('Please complete all item fields before saving.')
      return
    }

    if (!Number.isInteger(threshold) || threshold < 0) {
      setItemEditorError('Safety threshold must be a non-negative integer.')
      return
    }

    setIsItemEditorSubmitting(true)
    setItemEditorError('')

    try {
      if (itemEditorTarget.mode === 'create') {
        const foodBankId = resolveCreationFoodBankId()
        if (!foodBankId) {
          setItemEditorError('Choose a food bank before creating an item.')
          return
        }

        await adminAPI.createInventoryItem({
          name,
          category,
          unit,
          threshold,
          initial_stock: 0,
          food_bank_id: foodBankId,
        }, accessToken)
      } else if (itemEditorTarget.itemId) {
        await adminAPI.updateInventoryItem(itemEditorTarget.itemId, {
          name,
          category,
          unit,
          threshold,
        }, accessToken)
      }

      await refreshInventoryAndLots()
      closeItemEditor()
      setPageFeedback({
        tone: 'success',
        message: itemEditorTarget.mode === 'create' ? 'Inventory item added.' : 'Inventory item saved.',
      })
    } catch (error) {
      setItemEditorError(toErrorMessage(error, 'Failed to save inventory item.'))
    } finally {
      setIsItemEditorSubmitting(false)
    }
  }

  const closeStockInEditor = () => {
    setStockInTarget(null)
    setStockInDraft(createEmptyStockInDraft())
    setStockInError('')
  }

  const openItemStockInEditor = (itemId: number) => {
    const item = scopedInventoryItems.find((entry) => entry.id === itemId)
    if (!item) {
      setPageFeedback({ tone: 'error', message: 'Inventory item not found.' })
      return
    }

    setStockInTarget(item)
    setStockInDraft(createEmptyStockInDraft())
    setStockInError('')
  }

  const updateStockInDraftField = (field: keyof InventoryStockInDraft, value: string) => {
    setStockInDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const submitStockIn = async () => {
    if (!accessToken || !stockInTarget) {
      setStockInError(sessionExpiredMessage)
      return
    }

    const quantity = Number(stockInDraft.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setStockInError('Quantity must be a positive integer.')
      return
    }

    const normalizedExpiryDate = stockInDraft.expiryDate.trim()
      ? parseUkDateInput(stockInDraft.expiryDate)
      : undefined

    if (stockInDraft.expiryDate.trim() && !normalizedExpiryDate) {
      setStockInError('Expiry date must use DD/MM/YYYY.')
      return
    }

    setIsStockingIn(true)
    setStockInError('')
    try {
      await adminAPI.stockInInventoryItem(stockInTarget.id, {
        quantity,
        reason: 'admin manual stock-in',
        expiry_date: normalizedExpiryDate ?? undefined,
      }, accessToken)
      await refreshInventoryAndLots()
      closeStockInEditor()
      setPageFeedback({ tone: 'success', message: `${stockInTarget.name} stock updated.` })
    } catch (error) {
      setStockInError(toErrorMessage(error, 'Failed to stock in inventory item.'))
    } finally {
      setIsStockingIn(false)
    }
  }

  const closePackageEditor = () => {
    setPackageEditorTarget(null)
    setPackageEditorDraft(createEmptyPackageDraft())
    setPackageEditorError('')
  }

  const openNewPackageEditor = () => {
    if (!resolveCreationFoodBankId()) {
      setPageFeedback({ tone: 'error', message: 'Choose a food bank before creating a package.' })
      return
    }

    setPackageEditorTarget({ mode: 'create', packageId: null })
    setPackageEditorDraft(createEmptyPackageDraft())
    setPackageEditorError('')
  }

  const openEditPackageEditor = async (target: NameThresholdTarget) => {
    const detail = await ensurePackageDetail(target.id)
    if (!detail) {
      return
    }

    setPackageEditorTarget({ mode: 'edit', packageId: detail.id })
    setPackageEditorDraft(buildPackageDraft(detail))
    setPackageEditorError('')
  }

  const updatePackageDraftField = (
    field: keyof Omit<PackageEditorDraft, 'contents'>,
    value: string,
  ) => {
    setPackageEditorDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updatePackageDraftRow = (
    key: string,
    field: keyof Omit<PackageEditorRowDraft, 'key'>,
    value: string,
  ) => {
    setPackageEditorDraft((current) => ({
      ...current,
      contents: current.contents.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    }))
  }

  const addPackageDraftRow = () => {
    setPackageEditorDraft((current) => ({
      ...current,
      contents: [...current.contents, createPackageDraftRow()],
    }))
  }

  const removePackageDraftRow = (key: string) => {
    setPackageEditorDraft((current) => ({
      ...current,
      contents:
        current.contents.length > 1
          ? current.contents.filter((row) => row.key !== key)
          : current.contents,
    }))
  }

  const submitPackageEditor = async () => {
    if (!accessToken || !packageEditorTarget) {
      setPackageEditorError(sessionExpiredMessage)
      return
    }

    const name = packageEditorDraft.name.trim()
    const category = packageEditorDraft.category.trim()
    const threshold = Number(packageEditorDraft.threshold)

    if (!name || !category) {
      setPackageEditorError('Please complete all package fields before saving.')
      return
    }

    if (!Number.isInteger(threshold) || threshold < 0) {
      setPackageEditorError('Safety threshold must be a non-negative integer.')
      return
    }

    const contents = packageEditorDraft.contents.map((row) => ({
      item_id: Number(row.itemId),
      quantity: Number(row.quantity),
    }))

    if (contents.some((row) => !Number.isInteger(row.item_id) || row.item_id <= 0)) {
      setPackageEditorError('Choose an inventory item for every package row.')
      return
    }

    if (contents.some((row) => !Number.isInteger(row.quantity) || row.quantity <= 0)) {
      setPackageEditorError('Each package row needs a positive quantity.')
      return
    }

    setIsPackageEditorSubmitting(true)
    setPackageEditorError('')

    try {
      if (packageEditorTarget.mode === 'create') {
        const foodBankId = resolveCreationFoodBankId()
        if (!foodBankId) {
          setPackageEditorError('Choose a food bank before creating a package.')
          return
        }

        await adminAPI.createFoodPackage({
          name,
          category,
          threshold,
          contents,
          food_bank_id: foodBankId,
        }, accessToken)
      } else if (packageEditorTarget.packageId) {
        await adminAPI.updateFoodPackage(packageEditorTarget.packageId, {
          name,
          category,
          threshold,
          contents,
        }, accessToken)

        setPackageDetailsById((current) => {
          const next = { ...current }
          delete next[packageEditorTarget.packageId!]
          return next
        })
      }

      await Promise.all([
        refreshInventoryAndLots(),
        refreshScopedPackages(),
      ])
      closePackageEditor()
      setPageFeedback({
        tone: 'success',
        message: packageEditorTarget.mode === 'create' ? 'Package added.' : 'Package saved.',
      })
    } catch (error) {
      setPackageEditorError(toErrorMessage(error, 'Failed to save package.'))
    } finally {
      setIsPackageEditorSubmitting(false)
    }
  }

  const closePackingEditor = () => {
    setPackPackageId('')
    setPackQuantity('1')
    setPackFeedback('')
  }

  const openPackingEditor = async (packageId: number) => {
    const detail = await ensurePackageDetail(packageId)
    if (!detail) {
      return
    }

    setPackPackageId(detail.id)
    setPackQuantity('1')
    setPackFeedback('')
  }

  const handlePackPackage = async () => {
    if (!accessToken) {
      setPackFeedback(sessionExpiredMessage)
      return
    }

    if (packPackageId === '') {
      setPackFeedback('Please select a package first.')
      return
    }

    const quantity = Number(packQuantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPackFeedback('Quantity must be a positive integer.')
      return
    }

    setIsPacking(true)
    setPackFeedback('')

    try {
      await adminAPI.packPackage(packPackageId, quantity, accessToken)
      await Promise.all([
        refreshInventoryAndLots(),
        refreshScopedPackages(),
      ])
      setPackFeedback('Package packed successfully.')
    } catch (error) {
      setPackFeedback(toErrorMessage(error, 'Failed to pack package.'))
    } finally {
      setIsPacking(false)
    }
  }

  const closeLotExpiryEditor = () => {
    setLotExpiryTarget(null)
    setLotExpiryError('')
  }

  const handleLotExpiryEdit = (lotId: number, currentExpiryDate: string) => {
    const lot = getLotOrNotify(lotId)
    if (!lot) {
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setLotExpiryTarget({
      id: lotId,
      itemName: lot.item_name,
      lotNumber: buildLotReference(lot),
      quantity: lot.quantity,
      expiryDate: formatUkDateInput(currentExpiryDate),
    })
    setLotExpiryError('')
  }

  const submitLotExpiryEdit = async () => {
    if (!lotExpiryTarget || !accessToken) {
      setLotExpiryError(sessionExpiredMessage)
      return
    }

    const normalizedExpiryDate = parseUkDateInput(lotExpiryTarget.expiryDate)
    if (!normalizedExpiryDate) {
      setLotExpiryError('Expiry date must use DD/MM/YYYY.')
      return
    }

    setPendingAction('lot-expiry')
    setLotExpiryError('')
    try {
      await adminAPI.adjustInventoryLot(lotExpiryTarget.id, { expiry_date: normalizedExpiryDate }, accessToken)
      await refreshLotAndLowStock()
      closeLotExpiryEditor()
      setPageFeedback({ tone: 'success', message: 'Lot expiry date updated.' })
    } catch (error) {
      setLotExpiryError(toErrorMessage(error, 'Failed to update expiry date.'))
    } finally {
      setPendingAction(null)
    }
  }

  const handleLotStatusToggle = (lotId: number, currentStatus: LotStatusTarget['currentStatus']) => {
    const lot = getLotOrNotify(lotId)
    if (!lot) {
      return
    }

    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    if (currentStatus === 'expired') {
      setPageFeedback({ tone: 'info', message: 'Expired lots cannot be reactivated. Please adjust expiry date first.' })
      return
    }

    setLotStatusTarget({
      id: lotId,
      itemName: lot.item_name,
      lotNumber: buildLotReference(lot),
      currentStatus,
    })
  }

  const openDeleteLotConfirm = (lotId: number) => {
    const lot = getLotOrNotify(lotId)
    if (!lot) {
      return
    }

    setLotDeleteTarget({
      id: lot.id,
      itemName: lot.item_name,
      lotNumber: buildLotReference(lot),
    })
  }

  const submitLotStatusToggle = async () => {
    if (!lotStatusTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    const nextStatus = lotStatusTarget.currentStatus === 'active' ? 'wasted' : 'active'
    setPendingAction('lot-status')
    try {
      await adminAPI.adjustInventoryLot(lotStatusTarget.id, { status: nextStatus }, accessToken)
      await refreshLotAndLowStock()
      setLotStatusTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot status updated.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to update lot status.') })
    } finally {
      setPendingAction(null)
    }
  }

  const submitDeleteLot = async () => {
    if (!lotDeleteTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setIsDeletingLot(true)
    try {
      await adminAPI.deleteInventoryLot(lotDeleteTarget.id, accessToken)
      await refreshInventoryAndLots()
      setLotDeleteTarget(null)
      setPageFeedback({ tone: 'success', message: 'Lot deleted.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to delete lot.') })
    } finally {
      setIsDeletingLot(false)
    }
  }

  const submitBatchWasteLots = async (lotIds: number[]) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    const rowsToWaste = lotRows.filter((lot) => lotIds.includes(lot.id) && lot.status === 'active')
    if (rowsToWaste.length === 0) {
      setPageFeedback({ tone: 'error', message: 'Select at least one active lot.' })
      return
    }

    try {
      await Promise.all(
        rowsToWaste.map((lot) => adminAPI.adjustInventoryLot(lot.id, { status: 'wasted' }, accessToken)),
      )
      await refreshInventoryAndLots()
      setPageFeedback({ tone: 'success', message: 'Selected lots marked as wasted.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to update selected lots.') })
    }
  }

  const submitBatchDeleteLots = async (lotIds: number[]) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    const rowsToDelete = lotRows.filter((lot) => lotIds.includes(lot.id) && lot.status !== 'active')
    if (rowsToDelete.length === 0) {
      setPageFeedback({ tone: 'error', message: 'Select at least one inactive lot to delete.' })
      return
    }

    try {
      await Promise.all(
        rowsToDelete.map((lot) => adminAPI.deleteInventoryLot(lot.id, accessToken)),
      )
      await refreshInventoryAndLots()
      setPageFeedback({ tone: 'success', message: 'Selected lots deleted.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to delete selected lots.') })
    }
  }

  const handleDeleteItem = (itemId: number, itemName: string) => {
    setDeleteItemTarget({
      id: itemId,
      itemName,
      referencedByPackages: findPackagesReferencingItem(scopedPackageRows, itemId, itemName),
    })
  }

  const submitDeleteItem = async () => {
    if (!deleteItemTarget) {
      return
    }

    setPendingAction('delete-item')
    try {
      await deleteItem(deleteItemTarget.id)
      setPageFeedback({ tone: 'success', message: `Deleted ${deleteItemTarget.itemName}.` })
      setDeleteItemTarget(null)
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to delete inventory item.')
      const isConflict = message.toLowerCase().includes('used in packages')
        || message.toLowerCase().includes('conflict')

      if (isConflict && deleteItemTarget.referencedByPackages.length > 0) {
        const preview = deleteItemTarget.referencedByPackages.slice(0, 3).join(', ')
        const suffix = deleteItemTarget.referencedByPackages.length > 3 ? ', ...' : ''
        setPageFeedback({ tone: 'error', message: `Cannot delete this item because it is referenced by: ${preview}${suffix}` })
      } else {
        setPageFeedback({ tone: 'error', message })
      }
    } finally {
      setPendingAction(null)
    }
  }

  const createRestockRequest = async (item: LowStockRow) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setRestockActionId(item.id)
    try {
      await restockAPI.submitRequest({
        inventory_item_id: item.id,
        current_stock: item.current_stock,
        threshold: item.threshold,
        urgency: getRestockUrgency(item),
      }, accessToken)
      await refreshRestockAndLowStock()
      setPageFeedback({ tone: 'success', message: `Restock request created for ${item.name}.` })
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to create restock request.')
      setPageFeedback({ tone: 'error', message })
    } finally {
      setRestockActionId(null)
    }
  }

  const fulfilRestockRequest = (requestId: number) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setRestockConfirmTarget({ id: requestId, mode: 'fulfil' })
  }

  const submitRestockConfirm = async () => {
    if (!restockConfirmTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setRestockActionId(restockConfirmTarget.id)
    setPendingAction(restockConfirmTarget.mode === 'fulfil' ? 'restock-fulfil' : 'restock-cancel')
    try {
      if (restockConfirmTarget.mode === 'fulfil') {
        await restockAPI.fulfilRequest(restockConfirmTarget.id, accessToken)
        await refreshRestockInventoryAndLots()
        setPageFeedback({ tone: 'success', message: 'Restock request fulfilled.' })
      } else {
        await restockAPI.cancelRequest(restockConfirmTarget.id, accessToken)
        await refreshRestockAndLowStock()
        setPageFeedback({ tone: 'success', message: 'Restock request cancelled.' })
      }
      setRestockConfirmTarget(null)
    } catch (error) {
      const message = toErrorMessage(
        error,
        restockConfirmTarget.mode === 'fulfil'
          ? 'Failed to fulfil restock request.'
          : 'Failed to cancel restock request.',
      )
      setPageFeedback({ tone: 'error', message })
    } finally {
      setPendingAction(null)
      setRestockActionId(null)
    }
  }

  const updateDonationDraftField = (
    field: keyof Omit<DonationEditorDraft, 'items'>,
    value: string,
  ) => {
    setDonationDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const updateDonationDraftItem = (
    key: string,
    field: keyof Omit<DonationEditorItemDraft, 'key'>,
    value: string,
  ) => {
    setDonationDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }))
  }

  const addDonationDraftItem = () => {
    setDonationDraft((current) => ({
      ...current,
      items: [...current.items, createDonationDraftItem()],
    }))
  }

  const removeDonationDraftItem = (key: string) => {
    setDonationDraft((current) => ({
      ...current,
      items:
        current.items.length > 1
          ? current.items.filter((item) => item.key !== key)
          : current.items,
    }))
  }

  const openNewDonationEditor = () => {
    setDonationEditorTarget({ mode: 'create', donation: null })
    setDonationDraft(createEmptyDonationDraft())
    setDonationEditorError('')
  }

  const openEditDonationEditor = (donation: DonationListRow) => {
    setDonationEditorTarget({ mode: 'edit', donation })
    setDonationDraft(buildDonationDraft(donation))
    setDonationEditorError('')
  }

  const submitDonationEditor = async () => {
    if (!accessToken || !donationEditorTarget) {
      setDonationEditorError(sessionExpiredMessage)
      return
    }

    const donorType = donationDraft.donorType
    const donorName = donationDraft.donorName.trim()
    const donorEmail = donationDraft.donorEmail.trim()
    const receivedDate = donationDraft.receivedDate.trim()

    if (!donorType || !donorName || !donorEmail || !receivedDate) {
      setDonationEditorError('Please complete all donation fields before submitting.')
      return
    }

    if (!donorEmailPattern.test(donorEmail)) {
      setDonationEditorError('Enter a valid contact email address.')
      return
    }

    const normalizedReceivedDate = parseUkDateInput(receivedDate)
    if (!normalizedReceivedDate) {
      setDonationEditorError('Received Date must use DD/MM/YYYY.')
      return
    }

    const preparedItems = donationDraft.items
      .map((item) => ({
        itemName: item.itemName.trim(),
        quantity: Number(item.quantity),
        expiryDate: item.expiryDate.trim(),
      }))
      .filter((item) => item.itemName || item.quantity > 0 || item.expiryDate)

    if (preparedItems.length === 0) {
      setDonationEditorError('Please complete all donation fields before submitting.')
      return
    }

    if (preparedItems.some((item) => !item.itemName || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      setDonationEditorError('Each donation row needs an item and quantity.')
      return
    }

    const normalizedItems = preparedItems.map((item) => ({
      item_name: item.itemName,
      quantity: item.quantity,
      expiry_date: item.expiryDate ? parseUkDateInput(item.expiryDate) : undefined,
    }))

    if (normalizedItems.some((item) => item.expiry_date === null)) {
      setDonationEditorError('Item expiry dates must use DD/MM/YYYY.')
      return
    }

    setPendingAction('donation-save')
    setDonationEditorError('')

    try {
      const donorPhone = normalizeAdminDonationPhone(donationEditorTarget.donation?.donor_phone)
      const payload = {
        donor_name: donorName,
        donor_type: donorType,
        donor_email: donorEmail,
        donor_phone: donorPhone,
        pickup_date: normalizedReceivedDate,
        status: 'received' as const,
        items: normalizedItems.map((item) => ({
          item_name: item.item_name,
          quantity: item.quantity,
          expiry_date: item.expiry_date ?? undefined,
        })),
      }

      if (donationEditorTarget.mode === 'edit' && donationEditorTarget.donation) {
        await adminAPI.updateGoodsDonation(donationEditorTarget.donation.id, payload, accessToken)
      } else {
        await adminAPI.createGoodsDonation(payload, accessToken)
      }

      await reloadAllData()
      closeDonationEditor()
      setPageFeedback({
        tone: 'success',
        message: donationEditorTarget.mode === 'edit' ? 'Donation saved.' : 'Donation submitted.',
      })
    } catch (error) {
      setDonationEditorError(toErrorMessage(error, 'Failed to save donation.'))
    } finally {
      setPendingAction(null)
    }
  }

  const openDonationView = (donation: DonationListRow) => {
    setDonationViewTarget(donation)
  }

  const openDeleteDonationConfirm = (donation: DonationListRow) => {
    setDeleteDonationTarget({
      donation,
      displayId: buildDonationDisplayId(donation),
    })
  }

  const receiveDonation = async (donation: DonationListRow) => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setPendingAction('donation-receive')
    try {
      await adminAPI.updateGoodsDonation(donation.id, { status: 'received' }, accessToken)
      await reloadAllData()
      setPageFeedback({ tone: 'success', message: 'Donation marked as received.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to mark donation as received.') })
    } finally {
      setPendingAction(null)
    }
  }

  const submitDeleteDonation = async () => {
    if (!deleteDonationTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setPendingAction('donation-delete')
    try {
      if (deleteDonationTarget.donation.donation_type === 'cash') {
        await adminAPI.deleteCashDonation(deleteDonationTarget.donation.id, accessToken)
      } else {
        await adminAPI.deleteGoodsDonation(deleteDonationTarget.donation.id, accessToken)
      }
      await reloadAllData()
      setDeleteDonationTarget(null)
      setPageFeedback({ tone: 'success', message: 'Donation record deleted.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to delete donation.') })
    } finally {
      setPendingAction(null)
    }
  }

  const toggleDonationSelection = (donationId: string) => {
    setSelectedDonationIds((current) =>
      current.includes(donationId)
        ? current.filter((id) => id !== donationId)
        : [...current, donationId],
    )
  }

  const toggleAllDonations = (donationIds?: string[]) => {
    const nextIds = donationIds ?? filteredDonations.map((donation) => donation.id)

    setSelectedDonationIds((current) => {
      const currentSet = new Set(current)
      const allSelected = nextIds.length > 0 && nextIds.every((id) => currentSet.has(id))

      if (!donationIds) {
        return allSelected ? [] : nextIds
      }

      if (allSelected) {
        return current.filter((id) => !nextIds.includes(id))
      }

      return Array.from(new Set([...current, ...nextIds]))
    })
  }

  const submitBatchReceiveDonations = async () => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    const receivable = donations.filter(
      (donation) =>
        selectedDonationIdSet.has(donation.id)
        && donation.donation_type === 'goods'
        && donation.status === 'pending',
    )

    if (receivable.length === 0) {
      setPageFeedback({ tone: 'error', message: 'Select at least one pending goods donation.' })
      return
    }

    setPendingAction('donation-batch-receive')
    try {
      await Promise.all(
        receivable.map((donation) =>
          adminAPI.updateGoodsDonation(donation.id, { status: 'received' }, accessToken),
        ),
      )
      await reloadAllData()
      setSelectedDonationIds([])
      setPageFeedback({ tone: 'success', message: 'Selected donations marked as received.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to receive selected donations.') })
    } finally {
      setPendingAction(null)
    }
  }

  const submitBatchDeleteDonations = async () => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    const rowsToDelete = donations.filter((donation) => selectedDonationIdSet.has(donation.id))
    if (rowsToDelete.length === 0) {
      setPageFeedback({ tone: 'error', message: 'Select at least one donation record to delete.' })
      return
    }

    setPendingAction('donation-batch-delete')
    try {
      await Promise.all(
        rowsToDelete.map((donation) =>
          donation.donation_type === 'cash'
            ? adminAPI.deleteCashDonation(donation.id, accessToken)
            : adminAPI.deleteGoodsDonation(donation.id, accessToken),
        ),
      )
      await reloadAllData()
      setSelectedDonationIds([])
      setPageFeedback({ tone: 'success', message: 'Selected donation records deleted.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to delete selected donations.') })
    } finally {
      setPendingAction(null)
    }
  }

  const toggleCodeSelection = (applicationId: string) => {
    setSelectedCodeIds((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId],
    )
  }

  const toggleAllCodes = (applicationIds?: string[]) => {
    const nextIds = applicationIds ?? filteredApplications.map((record) => record.id)

    setSelectedCodeIds((current) => {
      const currentSet = new Set(current)
      const allSelected = nextIds.length > 0 && nextIds.every((id) => currentSet.has(id))

      if (!applicationIds) {
        return allSelected ? [] : nextIds
      }

      if (allSelected) {
        return current.filter((id) => !nextIds.includes(id))
      }

      return Array.from(new Set([...current, ...nextIds]))
    })
  }

  const openCodeView = (record: AdminApplicationRecord) => {
    setCodeViewTarget(record)
  }

  const openVoidCodeConfirm = (record: AdminApplicationRecord) => {
    setVoidCodeTarget({ record })
  }

  const checkRedemptionCode = async () => {
    if (!accessToken) {
      setCodeVerifyResult({
        tone: 'error',
        title: 'Session Expired',
        message: sessionExpiredMessage,
        record: null,
      })
      return
    }

    const normalizedCode = normalizeRedemptionCode(verifyCodeInput)
    if (!normalizedCode) {
      setCodeVerifyResult({
        tone: 'error',
        title: 'Missing Code',
        message: 'Enter a redemption code first.',
        record: null,
      })
      return
    }

    setPendingAction('code-check')
    try {
      const record = await applicationsAPI.getApplicationByCode(normalizedCode, accessToken)
      setVerifyCodeInput(normalizedCode)
      setCodeVerifyResult(buildCodeVerifyResult(record))
    } catch (error) {
      setCodeVerifyResult({
        tone: 'error',
        title: 'Code Not Found',
        message: toErrorMessage(error, 'Redemption code not found.'),
        record: null,
      })
    } finally {
      setPendingAction(null)
    }
  }

  const redeemVerifiedCode = async () => {
    if (!accessToken) {
      setCodeVerifyResult({
        tone: 'error',
        title: 'Session Expired',
        message: sessionExpiredMessage,
        record: null,
      })
      return
    }

    const record = codeVerifyResult?.record
    if (!record || !canRedeemApplication(record)) {
      setPageFeedback({ tone: 'error', message: 'Check a pending redemption code before redeeming.' })
      return
    }

    setPendingAction('code-redeem')
    try {
      await applicationsAPI.redeemApplication(record.id, accessToken)
      await reloadAllData()
      closeCodeVerifyModal()
      setPageFeedback({ tone: 'success', message: 'Redemption completed.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to redeem code.') })
    } finally {
      setPendingAction(null)
    }
  }

  const submitVoidCode = async () => {
    if (!voidCodeTarget || !accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    setPendingAction('code-void')
    try {
      await applicationsAPI.voidApplication(voidCodeTarget.record.id, accessToken)
      await reloadAllData()
      setVoidCodeTarget(null)
      setPageFeedback({ tone: 'success', message: 'Redemption code voided.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to void code.') })
    } finally {
      setPendingAction(null)
    }
  }

  const submitBatchVoidCodes = async () => {
    if (!accessToken) {
      setPageFeedback({ tone: 'error', message: sessionExpiredMessage })
      return
    }

    const rowsToVoid = applications.filter(
      (record) => selectedCodeIdSet.has(record.id) && canVoidApplication(record),
    )

    if (rowsToVoid.length === 0) {
      setPageFeedback({ tone: 'error', message: 'Select at least one pending code to void.' })
      return
    }

    setPendingAction('code-batch-void')
    try {
      await Promise.all(
        rowsToVoid.map((record) => applicationsAPI.voidApplication(record.id, accessToken)),
      )
      await reloadAllData()
      setSelectedCodeIds([])
      setPageFeedback({ tone: 'success', message: 'Selected redemption codes voided.' })
    } catch (error) {
      setPageFeedback({ tone: 'error', message: toErrorMessage(error, 'Failed to void selected codes.') })
    } finally {
      setPendingAction(null)
    }
  }

  const openPackTab = (packageId: number) => {
    void openPackingEditor(packageId)
  }

  const openItemAdjustModal = (itemId: number, _direction: 'in' | 'out') => {
    openItemStockInEditor(itemId)
  }

  const openRestockCancelConfirm = (requestId: number) => {
    setRestockConfirmTarget({ id: requestId, mode: 'cancel' })
  }

  const isAnyInlineEditorOpen =
    itemEditorTarget !== null
    || stockInTarget !== null
    || packageEditorTarget !== null
    || packPackageId !== ''
    || lotExpiryTarget !== null
    || lotStatusTarget !== null
    || lotDeleteTarget !== null
    || deleteItemTarget !== null
    || restockConfirmTarget !== null
    || donationEditorTarget !== null
    || donationViewTarget !== null
    || deleteDonationTarget !== null
    || isCodeVerifyOpen
    || codeViewTarget !== null
    || voidCodeTarget !== null

  const isInlineCloseDisabled =
    isItemEditorSubmitting
    || isStockingIn
    || isPackageEditorSubmitting
    || isPacking
    || isDeletingLot
    || isActionBusy('lot-expiry')
    || isActionBusy('lot-status')
    || isActionBusy('delete-item')
    || isActionBusy('restock-fulfil')
    || isActionBusy('restock-cancel')
    || isActionBusy('donation-save')
    || isActionBusy('donation-delete')
    || isActionBusy('code-check')
    || isActionBusy('code-redeem')
    || isActionBusy('code-void')

  const closeAllInlineEditors = () => {
    if (isInlineCloseDisabled) {
      return
    }

    closeItemEditor()
    closeStockInEditor()
    closePackageEditor()
    closePackingEditor()
    closeLotExpiryEditor()
    setLotStatusTarget(null)
    setLotDeleteTarget(null)
    setDeleteItemTarget(null)
    setRestockConfirmTarget(null)
    closeDonationEditor()
    setDonationViewTarget(null)
    setDeleteDonationTarget(null)
    closeCodeVerifyModal()
    setCodeViewTarget(null)
    setVoidCodeTarget(null)
  }

  useEffect(() => {
    document.body.classList.toggle('modal-open', isAnyInlineEditorOpen)

    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [isAnyInlineEditorOpen])

  useEffect(() => {
    if (pageFeedback?.tone !== 'success') {
      return
    }

    setToastMessage(pageFeedback.message)
    setIsToastVisible(true)

    const timeoutHandle = window.setTimeout(() => {
      setIsToastVisible(false)
      setPageFeedback((current) => (current?.tone === 'success' ? null : current))
    }, 2200)

    return () => window.clearTimeout(timeoutHandle)
  }, [pageFeedback])

  return (
    <AdminReactPageFrame
      section="food"
      title="Inventory Management, Simplified"
      description="Streamlined operations for food bank inventory, donations, and aid distribution. Track stock, process donations, and manage support in one unified platform."
      features={HERO_FEATURES}
      referenceStyleText={referenceStyleText}
      styleOverridesText={adminFoodManagementReactStyleText}
      actions={heroActions.map((action) => ({
        label: action.label,
        href: action.href,
      }))}
    >
      <ManagementSection
        id="donation-intake"
        title="Donation Intake & Recording"
        description="Log in-kind and cash donations from individuals, supermarkets, and partners. All records update inventory in real-time."
      >
        {loadError ? (
          <AdminFeedbackBanner tone="error" message={loadError} />
        ) : null}

        {pageFeedback && pageFeedback.tone !== 'success' ? (
          <AdminFeedbackBanner
            tone={pageFeedback.tone}
            message={pageFeedback.message}
            onClose={() => setPageFeedback(null)}
          />
        ) : null}

        <AdminDonationsSection
          heading="Donation Records"
          search={donationSearch}
          donorTypeFilter={donationDonorTypeFilter}
          statusFilter={donationStatusFilter}
          donations={filteredDonations}
          selectedDonationIds={selectedDonationIdSet}
          isLoadingDonations={isLoadingDonations}
          donationError={donationError}
          onSearchChange={setDonationSearch}
          onDonorTypeFilterChange={setDonationDonorTypeFilter}
          onStatusFilterChange={setDonationStatusFilter}
          onNewDonation={openNewDonationEditor}
          onToggleDonationSelection={toggleDonationSelection}
          onToggleAllDonations={toggleAllDonations}
          onViewDonation={openDonationView}
          onEditDonation={openEditDonationEditor}
          onReceiveDonation={(donation) => void receiveDonation(donation)}
          onDeleteDonation={openDeleteDonationConfirm}
          onBatchDelete={() => void submitBatchDeleteDonations()}
          onBatchReceive={() => void submitBatchReceiveDonations()}
          isBatchDeleteBusy={isActionBusy('donation-batch-delete')}
          isBatchReceiveBusy={isActionBusy('donation-batch-receive')}
        />
      </ManagementSection>

      <ManagementSection
        id="low-stock"
        title="Item Stock & Low Stock Alerts"
        description="Manage your food bank's item catalog, track current stock levels, and receive automated low stock alerts."
      >
        <AdminItemsSection
          search={inventorySearch}
          inventoryItems={scopedInventoryItems}
          isLoadingData={isLoadingData}
          isLoadingRestockRequests={isLoadingRestockRequests}
          lowStockError={lowStockError}
          restockError={restockError}
          openRestockItemIds={openRestockItemIds}
          openRestockRequests={openRestockRequests}
          restockActionId={restockActionId}
          onSearchChange={setInventorySearch}
          onAddItem={openNewItemEditor}
          onEditItem={openEditItemEditor}
          onAdjustItem={openItemAdjustModal}
          onDeleteItem={handleDeleteItem}
          onCreateRestockRequest={(item) => void createRestockRequest(item)}
          onFulfilRestockRequest={fulfilRestockRequest}
          onCancelRestockRequest={openRestockCancelConfirm}
          foodBankOptions={isScopedSelectionRequired ? foodBankFilterOptions : undefined}
          selectedFoodBankId={isScopedSelectionRequired ? selectedFoodBankId : undefined}
          onFoodBankChange={isScopedSelectionRequired ? setSelectedFoodBankId : undefined}
          searchDisabled={inventorySearchDisabled}
          searchPlaceholder={
            inventorySearchDisabled
              ? 'Choose a food bank to browse inventory items'
              : 'Search inventory items'
          }
          searchScopeKey={scopeSelectorKey}
          sectionError={inventorySectionError}
        />
      </ManagementSection>

      <ManagementSection
        id="package-management"
        title="Food Package Building & Management"
        description="Create and manage standard food aid packages, and log packing operations to update inventory automatically."
      >
        <AdminPackagesSection
          heading="Food Package"
          addButtonLabel="New Food Package"
          packageRows={scopedPackageRows}
          isLoadingData={isLoadingData || isLoadingScopedPackages}
          onAddPackage={openNewPackageEditor}
          onEditPackage={(target) => {
            void openEditPackageEditor(target)
          }}
          onOpenPackTab={openPackTab}
          foodBankOptions={isScopedSelectionRequired ? foodBankFilterOptions : undefined}
          selectedFoodBankId={isScopedSelectionRequired ? selectedFoodBankId : undefined}
          onFoodBankChange={isScopedSelectionRequired ? setSelectedFoodBankId : undefined}
          searchDisabled={packageSearchDisabled}
          searchPlaceholder={
            packageSearchDisabled
              ? 'Choose a food bank to browse food packages'
              : 'Search food packages'
          }
          searchScopeKey={scopeSelectorKey}
          emptyStateMessage={packageSearchDisabled ? 'Choose a food bank to view food packages' : null}
          sectionError={packageSectionError}
        />
      </ManagementSection>

      <ManagementSection
        id="expiry-tracking"
        title="Lot Tracking & Expiry Management"
        description="Track item batches, monitor expiry dates, and reduce food waste with proactive alerts."
      >
        <AdminLotsSection
          heading="Lot Records"
          inventoryItems={inventory}
          lotRows={lotRows}
          isLoadingLots={isLoadingLots}
          lotError={lotError}
          onReportDamage={() => {}}
          onEditExpiry={handleLotExpiryEdit}
          onToggleStatus={handleLotStatusToggle}
          onDeleteLot={async (lotId) => openDeleteLotConfirm(lotId)}
          onBatchWasteLots={submitBatchWasteLots}
          onBatchDeleteLots={submitBatchDeleteLots}
        />
      </ManagementSection>

      <ManagementSection
        id="code-verification"
        title="Redemption Code Verification"
        description="Verify redemption codes for aid recipients, and confirm package pickup."
      >
        <AdminCodesSection
          heading="Redemption Code Records"
          search={codeSearch}
          statusFilter={codeStatusFilter}
          applications={filteredApplications}
          selectedCodeIds={selectedCodeIdSet}
          isLoadingApplications={isLoadingApplications}
          applicationsError={applicationsError}
          onSearchChange={setCodeSearch}
          onOpenVerify={() => setIsCodeVerifyOpen(true)}
          onToggleCodeSelection={toggleCodeSelection}
          onToggleAllCodes={toggleAllCodes}
          onViewCode={openCodeView}
          onVoidCode={openVoidCodeConfirm}
          onBatchVoid={() => void submitBatchVoidCodes()}
          isBatchVoidBusy={isActionBusy('code-batch-void')}
        />
      </ManagementSection>

      <div
        className={`modal-overlay${isAnyInlineEditorOpen ? ' visible' : ''}`}
        id="global-modal-overlay"
        onClick={closeAllInlineEditors}
      />

      <InventoryItemEditorModal
        id={itemEditorTarget?.mode === 'edit' ? 'edit-item-editor' : 'new-item-editor'}
        isOpen={itemEditorTarget !== null}
        isEditing={itemEditorTarget?.mode === 'edit'}
        draft={itemEditorDraft}
        error={itemEditorError}
        submitting={isItemEditorSubmitting}
        categoryOptions={Array.from(inventoryCategoryOptions)}
        onClose={closeItemEditor}
        onFieldChange={updateItemDraftField}
        onSubmit={submitItemEditor}
      />

      <InventoryStockInModal
        isOpen={stockInTarget !== null}
        itemName={stockInTarget?.name ?? ''}
        draft={stockInDraft}
        error={stockInError}
        submitting={isStockingIn}
        onClose={closeStockInEditor}
        onFieldChange={updateStockInDraftField}
        onSubmit={submitStockIn}
      />

      <PackageEditorModal
        id={packageEditorTarget?.mode === 'edit' ? 'edit-package-editor' : 'new-package-editor'}
        isOpen={packageEditorTarget !== null}
        isEditing={packageEditorTarget?.mode === 'edit'}
        draft={packageEditorDraft}
        inventoryItems={scopedInventoryItems}
        error={packageEditorError}
        submitting={isPackageEditorSubmitting}
        categoryOptions={Array.from(packageCategoryOptions)}
        onClose={closePackageEditor}
        onFieldChange={updatePackageDraftField}
        onRowChange={updatePackageDraftRow}
        onAddRow={addPackageDraftRow}
        onRemoveRow={removePackageDraftRow}
        onSubmit={submitPackageEditor}
      />

      <PackingModal
        isOpen={packPackageId !== ''}
        packages={scopedPackingPackages}
        selectedPackageId={packPackageId}
        quantity={packQuantity}
        stockCheckRows={packingStockCheckRows}
        feedback={packFeedback}
        loadingStockCheck={isLoadingPackageDetail}
        submitting={isPacking}
        onClose={closePackingEditor}
        onPackageChange={(value) => {
          setPackPackageId(value)
          if (typeof value === 'number') {
            void ensurePackageDetail(value)
          }
        }}
        onQuantityChange={setPackQuantity}
        onSubmit={handlePackPackage}
      />

      <LotExpiryModal
        isOpen={lotExpiryTarget !== null}
        target={lotExpiryTarget}
        expiryValue={lotExpiryTarget?.expiryDate ?? ''}
        error={lotExpiryError}
        submitting={isActionBusy('lot-expiry')}
        onClose={closeLotExpiryEditor}
        onExpiryChange={(value) => {
          setLotExpiryTarget((current) => (current ? { ...current, expiryDate: value } : current))
        }}
        onSubmit={submitLotExpiryEdit}
      />

      <InlineConfirmModal
        id="mark-wasted-confirm"
        isOpen={lotStatusTarget !== null}
        onClose={() => setLotStatusTarget(null)}
        title={lotStatusTarget?.currentStatus === 'active' ? 'Mark Lot as Wasted' : 'Reactivate Lot'}
        description={
          lotStatusTarget
            ? lotStatusTarget.currentStatus === 'active'
              ? `Mark lot ${lotStatusTarget.lotNumber} as wasted? This will deduct the remaining stock from inventory, and cannot be undone.`
              : `Mark lot ${lotStatusTarget.lotNumber} as active again?`
            : ''
        }
        confirmLabel={lotStatusTarget?.currentStatus === 'active' ? 'Mark Wasted' : 'Mark Active'}
        submitting={isActionBusy('lot-status')}
        confirmTone={lotStatusTarget?.currentStatus === 'active' ? 'danger' : 'primary'}
        onConfirm={submitLotStatusToggle}
      />

      <InlineConfirmModal
        id="delete-lot-confirm"
        isOpen={lotDeleteTarget !== null}
        onClose={() => setLotDeleteTarget(null)}
        title="Delete Expired Lot"
        description={
          lotDeleteTarget
            ? `Delete expired lot ${lotDeleteTarget.lotNumber}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Lot"
        submitting={isDeletingLot}
        confirmTone="danger"
        onConfirm={submitDeleteLot}
      />

      <InlineConfirmModal
        id="delete-item-confirm"
        isOpen={deleteItemTarget !== null}
        onClose={() => setDeleteItemTarget(null)}
        title="Delete Inventory Item"
        description={deleteItemTarget ? `Delete ${deleteItemTarget.itemName}? This cannot be undone.` : ''}
        confirmLabel="Delete Item"
        submitting={isActionBusy('delete-item')}
        confirmTone="danger"
        onConfirm={submitDeleteItem}
      />

      <InlineConfirmModal
        id="restock-request-confirm"
        isOpen={restockConfirmTarget !== null}
        onClose={() => setRestockConfirmTarget(null)}
        title={restockConfirmTarget?.mode === 'fulfil' ? 'Fulfil Restock Request' : 'Cancel Restock Request'}
        description={
          restockConfirmTarget?.mode === 'fulfil'
            ? 'Fulfil this request and add a replenishment lot up to the threshold?'
            : 'Cancel this open restock request?'
        }
        confirmLabel={restockConfirmTarget?.mode === 'fulfil' ? 'Fulfil Request' : 'Cancel Request'}
        submitting={isActionBusy(restockConfirmTarget?.mode === 'fulfil' ? 'restock-fulfil' : 'restock-cancel')}
        confirmTone={restockConfirmTarget?.mode === 'cancel' ? 'danger' : 'primary'}
        onConfirm={submitRestockConfirm}
      />

      <DonationEditorModal
        isOpen={donationEditorTarget !== null}
        isEditing={donationEditorTarget?.mode === 'edit'}
        draft={donationDraft}
        itemOptions={itemOptions}
        error={donationEditorError}
        submitting={isActionBusy('donation-save')}
        onClose={closeDonationEditor}
        onFieldChange={updateDonationDraftField}
        onItemChange={updateDonationDraftItem}
        onAddItem={addDonationDraftItem}
        onRemoveItem={removeDonationDraftItem}
        onSubmit={submitDonationEditor}
      />

      <DonationDetailsModal
        donation={donationViewTarget}
        isOpen={donationViewTarget !== null}
        onClose={() => setDonationViewTarget(null)}
      />

      <InlineConfirmModal
        id="delete-donation-confirm"
        isOpen={deleteDonationTarget !== null}
        onClose={() => setDeleteDonationTarget(null)}
        title="Delete Donation Record"
        description={deleteDonationTarget ? `Delete donation ${deleteDonationTarget.displayId}? This cannot be undone.` : ''}
        confirmLabel="Delete Record"
        confirmTone="danger"
        submitting={isActionBusy('donation-delete')}
        onConfirm={submitDeleteDonation}
      />

      <CodeVerifyModal
        isOpen={isCodeVerifyOpen}
        code={verifyCodeInput}
        result={codeVerifyResult}
        checking={isActionBusy('code-check')}
        redeeming={isActionBusy('code-redeem')}
        onClose={closeCodeVerifyModal}
        onCodeChange={setVerifyCodeInput}
        onCheck={checkRedemptionCode}
        onRedeem={redeemVerifiedCode}
      />

      <CodeDetailsModal
        record={codeViewTarget}
        isOpen={codeViewTarget !== null}
        onClose={() => setCodeViewTarget(null)}
      />

      <InlineConfirmModal
        id="void-code-confirm"
        isOpen={voidCodeTarget !== null}
        onClose={() => setVoidCodeTarget(null)}
        title="Void Redemption Code"
        description={
          voidCodeTarget
            ? `Void code ${voidCodeTarget.record.redemption_code}? This code will no longer be valid for redemption, and cannot be undone.`
            : ''
        }
        confirmLabel="Void Code"
        confirmTone="danger"
        submitting={isActionBusy('code-void')}
        onConfirm={submitVoidCode}
      />

      <div className={`action-toast${isToastVisible ? ' show' : ''}`} id="action-toast">
        {toastMessage}
      </div>
    </AdminReactPageFrame>
  )
}
