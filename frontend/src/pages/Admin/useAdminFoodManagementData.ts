import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { applicationsAPI, type AdminApplicationRecord } from '@/shared/lib/api/applications'
import { adminAPI } from '@/shared/lib/api/admin'
import { foodBanksAPI } from '@/shared/lib/api/foodBanks'
import { useAuthStore } from '@/app/store/authStore'
import { useFoodBankStore } from '@/app/store/foodBankStore'
import type { FoodPackageDetailRecord } from '@/shared/lib/api/packages'
import type { AdminScopeMeta } from '@/shared/lib/adminScope'
import { getAdminFoodBankScopeState } from '@/shared/lib/adminScope'
import type { DonationListRow } from '@/shared/types/donations'
import { buildScopedPackageRow } from './builders'
import type { InventoryLotRow } from './adminFoodManagement.types'
import { captureRequestError, extractApplications, runManagedRequest, sortApplications, sortDonations } from './rules'

type StateSetter<T> = Dispatch<SetStateAction<T>>
type CancelGuard = () => boolean
type FoodBankOption = { id: number; name: string }

interface UseAdminFoodManagementDataArgs {
  adminScope: AdminScopeMeta
  selectedFoodBankId: number | null
}

interface AuthorizedLoadConfig<Result> {
  request: (token: string) => Promise<Result>
  setLoading?: StateSetter<boolean>
  setError?: StateSetter<string>
  fallbackMessage: string
  onSuccess?: (result: Result) => void
  onError?: (message: string) => void
}

const extractFoodBanks = (response: { items?: FoodBankOption[] } | null | undefined) => Array.isArray(response?.items) ? response.items : []
const sortNamedRows = <Row extends { name: string }>(rows: Row[]) => [...rows].sort((left, right) => left.name.localeCompare(right.name))

export function useAdminFoodManagementData({ adminScope, selectedFoodBankId }: UseAdminFoodManagementDataArgs) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const inventory = useFoodBankStore((state) => state.inventory)
  const loadInventory = useFoodBankStore((state) => state.loadInventory)
  const deleteItem = useFoodBankStore((state) => state.deleteItem)

  const [isLoadingData, setIsLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [lotRows, setLotRows] = useState<InventoryLotRow[]>([])
  const [isLoadingLots, setIsLoadingLots] = useState(false)
  const [lotError, setLotError] = useState('')
  const [donations, setDonations] = useState<DonationListRow[]>([])
  const [isLoadingDonations, setIsLoadingDonations] = useState(false)
  const [donationError, setDonationError] = useState('')
  const [applications, setApplications] = useState<AdminApplicationRecord[]>([])
  const [isLoadingApplications, setIsLoadingApplications] = useState(false)
  const [applicationsError, setApplicationsError] = useState('')
  const [availableFoodBanks, setAvailableFoodBanks] = useState<FoodBankOption[]>([])
  const [availableFoodBanksError, setAvailableFoodBanksError] = useState('')
  const [scopedPackageDetails, setScopedPackageDetails] = useState<FoodPackageDetailRecord[]>([])
  const [isLoadingScopedPackages, setIsLoadingScopedPackages] = useState(false)
  const [scopedPackageError, setScopedPackageError] = useState('')
  const [packageDetailsById, setPackageDetailsById] = useState<Record<number, FoodPackageDetailRecord>>({})
  const [isLoadingPackageDetail, setIsLoadingPackageDetail] = useState(false)

  const scopeState = useMemo(() => getAdminFoodBankScopeState(adminScope, selectedFoodBankId), [adminScope, selectedFoodBankId])
  const foodBankFilterOptions = useMemo(() => sortNamedRows(availableFoodBanks), [availableFoodBanks])
  const scopedPackageRows = useMemo(() => scopedPackageDetails.map((detail) => buildScopedPackageRow(detail)), [scopedPackageDetails])
  const scopedPackingPackages = useMemo(() => scopedPackageDetails.map((detail) => ({ id: detail.id, name: detail.name })), [scopedPackageDetails])

  const applyScopedPackageDetails = useCallback((details: FoodPackageDetailRecord[]) => {
    const sortedDetails = sortNamedRows(details)
    setScopedPackageDetails(sortedDetails)
    setPackageDetailsById((current) => {
      const next = { ...current }
      for (const detail of sortedDetails) next[detail.id] = detail
      return next
    })
  }, [])

  const runAuthorizedLoad = useCallback(async <Result>({ request, setLoading, setError, fallbackMessage, onSuccess, onError }: AuthorizedLoadConfig<Result>, isCancelled?: CancelGuard) => {
    if (!accessToken) return
    await runManagedRequest({ request: () => request(accessToken), setLoading, setError, fallbackMessage, onSuccess, onError, isCancelled, rethrow: true })
  }, [accessToken])

  const loadLots = useCallback((isCancelled?: CancelGuard) => runAuthorizedLoad({
    request: (token) => adminAPI.getInventoryLots(token, true),
    setLoading: setIsLoadingLots,
    setError: setLotError,
    fallbackMessage: 'Failed to load inventory lots.',
    onSuccess: (data) => setLotRows(Array.isArray(data) ? (data as InventoryLotRow[]) : []),
  }, isCancelled), [runAuthorizedLoad])

  const loadDonations = useCallback((isCancelled?: CancelGuard) => runAuthorizedLoad({
    request: (token) => adminAPI.getDonations(token),
    setLoading: setIsLoadingDonations,
    setError: setDonationError,
    fallbackMessage: 'Failed to load donation records.',
    onSuccess: (data) => setDonations(sortDonations(Array.isArray(data) ? (data as DonationListRow[]) : [])),
  }, isCancelled), [runAuthorizedLoad])

  const loadApplications = useCallback((isCancelled?: CancelGuard) => runAuthorizedLoad({
    request: (token) => applicationsAPI.getAdminApplications(token),
    setLoading: setIsLoadingApplications,
    setError: setApplicationsError,
    fallbackMessage: 'Failed to load redemption code records.',
    onSuccess: (data) => setApplications(sortApplications(extractApplications(data))),
  }, isCancelled), [runAuthorizedLoad])

  const loadAvailableFoodBanks = useCallback(async (isCancelled?: CancelGuard) => {
    await runManagedRequest({
      request: () => foodBanksAPI.getFoodBanks(),
      fallbackMessage: 'Failed to load food banks.',
      onSuccess: (response) => {
        setAvailableFoodBanks(extractFoodBanks(response))
        setAvailableFoodBanksError('')
      },
      onError: (message) => {
        setAvailableFoodBanks([])
        setAvailableFoodBanksError(message)
      },
      isCancelled,
    })
  }, [])

  const loadScopedPackages = useCallback(async (foodBankId: number | null, isCancelled?: CancelGuard) => {
    if (!accessToken || foodBankId == null) {
      if (!isCancelled?.()) {
        setScopedPackageDetails([])
        setScopedPackageError('')
        setIsLoadingScopedPackages(false)
      }
      return
    }

    await runAuthorizedLoad({
      request: (token) => adminAPI.listFoodPackages(token, { foodBankId }),
      setLoading: setIsLoadingScopedPackages,
      setError: setScopedPackageError,
      fallbackMessage: 'Failed to load food packages.',
      onSuccess: (details) => applyScopedPackageDetails(Array.isArray(details) ? details : []),
      onError: () => setScopedPackageDetails([]),
    }, isCancelled)
  }, [accessToken, applyScopedPackageDetails, runAuthorizedLoad])

  const refreshInventoryAndLots = useCallback(async () => { await Promise.all([loadInventory(), loadLots()]) }, [loadInventory, loadLots])
  const refreshLots = useCallback(async () => { await loadLots() }, [loadLots])
  const refreshScopedPackages = useCallback(async () => { await loadScopedPackages(scopeState.effectiveFoodBankId) }, [loadScopedPackages, scopeState.effectiveFoodBankId])
  const reloadAllData = useCallback(async () => { await Promise.all([loadInventory(), loadLots(), loadDonations(), loadApplications()]) }, [loadApplications, loadDonations, loadInventory, loadLots])

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled

    const loadAll = async () => {
      setIsLoadingData(true)
      setLoadError('')
      const errors = await Promise.all([
        captureRequestError(() => loadInventory(), 'Failed to load inventory.'),
        captureRequestError(() => loadLots(isCancelled), 'Failed to load inventory lots.'),
        captureRequestError(() => loadDonations(isCancelled), 'Failed to load donation records.'),
        captureRequestError(() => loadApplications(isCancelled), 'Failed to load redemption code records.'),
      ])
      if (cancelled) return
      setLoadError(errors.find(Boolean) ?? '')
      setIsLoadingData(false)
    }

    void loadAll()
    return () => { cancelled = true }
  }, [accessToken, loadApplications, loadDonations, loadInventory, loadLots])

  useEffect(() => {
    if (!scopeState.canChooseFoodBank) {
      setAvailableFoodBanks([])
      setAvailableFoodBanksError('')
      return
    }
    let cancelled = false
    void loadAvailableFoodBanks(() => cancelled)
    return () => { cancelled = true }
  }, [loadAvailableFoodBanks, scopeState.canChooseFoodBank])

  useEffect(() => {
    let cancelled = false
    void loadScopedPackages(scopeState.effectiveFoodBankId, () => cancelled)
    return () => { cancelled = true }
  }, [loadScopedPackages, scopeState.effectiveFoodBankId])

  return {
    accessToken,
    deleteItem,
    isLoadingData,
    loadError,
    lotRows,
    isLoadingLots,
    lotError,
    donations,
    isLoadingDonations,
    donationError,
    applications,
    isLoadingApplications,
    applicationsError,
    inventory,
    refreshInventoryAndLots,
    refreshLots,
    reloadAllData,
    availableFoodBanksError,
    effectiveFoodBankId: scopeState.effectiveFoodBankId,
    foodBankFilterOptions,
    isLoadingPackageDetail,
    isLoadingScopedPackages,
    isScopedSelectionRequired: scopeState.isFoodBankSelectionRequired,
    packageDetailsById,
    refreshScopedPackages,
    scopeState,
    scopedPackageDetails,
    scopedPackageError,
    scopedPackageRows,
    scopedPackingPackages,
    setIsLoadingPackageDetail,
    setPackageDetailsById,
  }
}