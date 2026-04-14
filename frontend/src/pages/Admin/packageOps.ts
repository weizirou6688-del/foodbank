import type { Dispatch, SetStateAction } from 'react'
import { adminAPI } from '@/shared/lib/api/admin'
import type { FoodPackageDetailRecord } from '@/shared/lib/api/packages'
import { makeTaskRunner, type BusySetter, type ErrorSetter } from './runTask'
import { buildPackageDraft, resolveScopedFoodBankId } from './builders'
import type { PackageEditorDraft, PageFeedback } from './adminFoodManagement.types'
import { toErrorMessage } from './rules'

type PackageEditorTarget = {
  mode: 'create' | 'edit'
  packageId: number | null
} | null

type CreateAdminPackageActionsParams = {
  accessToken: string | null
  sessionExpiredMessage: string
  adminScopeFoodBankId: number | null
  selectedFoodBankId: number | null
  scopedPackageDetails: FoodPackageDetailRecord[]
  packageDetailsById: Record<number, FoodPackageDetailRecord>
  setPackageDetailsById: Dispatch<SetStateAction<Record<number, FoodPackageDetailRecord>>>
  setIsLoadingPackageDetail: BusySetter
  packageEditorTarget: PackageEditorTarget
  packageEditorDraft: PackageEditorDraft
  setPackageEditorError: ErrorSetter
  setIsPackageEditorSubmitting: BusySetter
  resetPackageEditor: (target?: PackageEditorTarget, draft?: PackageEditorDraft) => void
  closePackageEditor: () => void
  packPackageId: number | ''
  packQuantity: string
  setPackPackageId: Dispatch<SetStateAction<number | ''>>
  setPackFeedback: ErrorSetter
  setIsPacking: BusySetter
  resetPackingEditor: (packageId?: number | '', quantity?: string, feedback?: string) => void
  setPageNotice: (tone: PageFeedback['tone'], message: string) => void
  refreshInventoryAndLots: () => Promise<unknown>
  refreshScopedPackages: () => Promise<unknown>
}

export function makePackageOps({
  accessToken,
  sessionExpiredMessage,
  adminScopeFoodBankId,
  selectedFoodBankId,
  scopedPackageDetails,
  packageDetailsById,
  setPackageDetailsById,
  setIsLoadingPackageDetail,
  packageEditorTarget,
  packageEditorDraft,
  setPackageEditorError,
  setIsPackageEditorSubmitting,
  resetPackageEditor,
  closePackageEditor,
  packPackageId,
  packQuantity,
  setPackPackageId,
  setPackFeedback,
  setIsPacking,
  resetPackingEditor,
  setPageNotice,
  refreshInventoryAndLots,
  refreshScopedPackages,
}: CreateAdminPackageActionsParams) {
  const { getToken, runBusyTask } = makeTaskRunner({ accessToken, sessionExpiredMessage, setPageNotice })
  const resolveCreationFoodBankId = () => resolveScopedFoodBankId(adminScopeFoodBankId, selectedFoodBankId)
  const refreshPackageData = () => Promise.all([refreshInventoryAndLots(), refreshScopedPackages()])
  const cachePackageDetail = (detail: FoodPackageDetailRecord) => (setPackageDetailsById((current) => ({ ...current, [detail.id]: detail })), detail)
  const clearPackageDetail = (packageId: number) =>
    setPackageDetailsById((current) => {
      if (!(packageId in current)) return current
      const next = { ...current }
      delete next[packageId]
      return next
    })
  const loadPackageDetail = async (packageId: number) => {
    const scopedDetail = scopedPackageDetails.find((entry) => entry.id === packageId)
    if (scopedDetail) return cachePackageDetail(scopedDetail)
    const cachedDetail = packageDetailsById[packageId]
    if (cachedDetail) return cachedDetail
    const token = getToken()
    if (!token) return null
    setIsLoadingPackageDetail(true)
    try {
      return cachePackageDetail(await adminAPI.getFoodPackageDetail(packageId, token))
    } catch (error) {
      setPageNotice('error', toErrorMessage(error, 'Failed to load package details.'))
      return null
    } finally {
      setIsLoadingPackageDetail(false)
    }
  }
  const openPackageEditor = async (mode: 'create' | 'edit', packageId?: number) => {
    if (mode === 'create') {
      if (!resolveCreationFoodBankId()) return void setPageNotice('error', 'Choose a food bank before creating a package.')
      return void resetPackageEditor({ mode, packageId: null })
    }
    if (typeof packageId !== 'number') return
    const detail = await loadPackageDetail(packageId)
    if (detail) resetPackageEditor({ mode, packageId: detail.id }, buildPackageDraft(detail))
  }

  const submitPackageEditor = async () => {
    if (!packageEditorTarget) return void setPackageEditorError(sessionExpiredMessage)
    const name = packageEditorDraft.name.trim(), category = packageEditorDraft.category.trim(), threshold = Number(packageEditorDraft.threshold)
    const contents = packageEditorDraft.contents.map((row) => ({ item_id: Number(row.itemId), quantity: Number(row.quantity) }))
    const foodBankId = packageEditorTarget.mode === 'create' ? resolveCreationFoodBankId() : null
    if (!name || !category) return void setPackageEditorError('Please complete all package fields before saving.')
    if (!Number.isInteger(threshold) || threshold < 0) return void setPackageEditorError('Safety threshold must be a non-negative integer.')
    if (contents.some((row) => !Number.isInteger(row.item_id) || row.item_id <= 0)) return void setPackageEditorError('Choose an inventory item for every package row.')
    if (contents.some((row) => !Number.isInteger(row.quantity) || row.quantity <= 0)) return void setPackageEditorError('Each package row needs a positive quantity.')
    if (packageEditorTarget.mode === 'create' && !foodBankId) return void setPackageEditorError('Choose a food bank before creating a package.')
    if (packageEditorTarget.mode === 'edit' && !packageEditorTarget.packageId) return void setPackageEditorError('Package not found.')
    await runBusyTask({
      setBusy: setIsPackageEditorSubmitting,
      setError: setPackageEditorError,
      fallbackMessage: 'Failed to save package.',
      task: async (token) => {
        if (packageEditorTarget.mode === 'create') await adminAPI.createFoodPackage({ name, category, threshold, contents, food_bank_id: foodBankId! }, token)
        else {
          await adminAPI.updateFoodPackage(packageEditorTarget.packageId!, { name, category, threshold, contents }, token)
          clearPackageDetail(packageEditorTarget.packageId!)
        }
        await refreshPackageData()
        closePackageEditor()
        setPageNotice('success', packageEditorTarget.mode === 'create' ? 'Package added.' : 'Package saved.')
      },
    })
  }

  const openPackingEditor = async (packageId: number) => {
    const detail = await loadPackageDetail(packageId)
    if (detail) resetPackingEditor(detail.id)
  }

  const handlePackPackage = async () => {
    const token = getToken(setPackFeedback)
    if (!token) return
    if (packPackageId === '') return void setPackFeedback('Please select a package first.')
    const quantity = Number(packQuantity)
    if (!Number.isInteger(quantity) || quantity <= 0) return void setPackFeedback('Quantity must be a positive integer.')
    setIsPacking(true)
    setPackFeedback('')
    try {
      await adminAPI.packPackage(packPackageId, quantity, token)
      await refreshPackageData()
      setPackFeedback('Package packed successfully.')
    } catch (error) {
      setPackFeedback(toErrorMessage(error, 'Failed to pack package.'))
    } finally {
      setIsPacking(false)
    }
  }

  return {
    handlePackingPackageChange: (value: number | '') => {
      setPackPackageId(value)
      if (typeof value === 'number') void loadPackageDetail(value)
    },
    openNewPackageEditor: () => void openPackageEditor('create'),
    openEditPackageEditor: (target: { id: number }) => openPackageEditor('edit', target.id),
    submitPackageEditor,
    openPackingEditor,
    openPackTab: (packageId: number) => void openPackingEditor(packageId),
    handlePackPackage,
  }
}
