import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import type { DonationListRow } from '@/shared/types/donations'
import type { InventoryItem } from '@/shared/types/inventory'
import {
  appendListItem,
  assignField,
  createDonationDraftItem,
  createEmptyDonationDraft,
  createEmptyInventoryDraft,
  createEmptyPackageDraft,
  createEmptyStockInDraft,
  createPackageDraftRow,
  removeKeyedListItem,
  updateKeyedListField,
} from './builders'
import type {
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
  PackageEditorDraft,
  PackageEditorRowDraft,
  PageFeedback,
  PendingAction,
} from './adminFoodManagement.types'

type StateSetter<T> = Dispatch<SetStateAction<T>>

const createDraftFieldUpdater = <T extends object>(setDraft: StateSetter<T>) => <TField extends keyof T>(field: TField, value: T[TField]) => {
  setDraft((current) => assignField(current, field, value))
}

const createDraftCollectionFieldUpdater = <TDraft extends object, TCollectionKey extends keyof TDraft, TRow extends { key: string }>(setDraft: StateSetter<TDraft>, collectionKey: TCollectionKey) =>
  <TField extends Exclude<keyof TRow, 'key'>>(rowKey: string, field: TField, value: TRow[TField]) => {
    setDraft((current) => ({ ...current, [collectionKey]: updateKeyedListField(current[collectionKey] as TRow[], rowKey, field, value) }) as TDraft)
  }

const createDraftCollectionAppender = <TDraft extends object, TCollectionKey extends keyof TDraft, TRow>(setDraft: StateSetter<TDraft>, collectionKey: TCollectionKey, createRow: () => TRow) => () => {
  setDraft((current) => ({ ...current, [collectionKey]: appendListItem(current[collectionKey] as TRow[], createRow()) }) as TDraft)
}

const createDraftCollectionRemover = <TDraft extends object, TCollectionKey extends keyof TDraft, TRow extends { key: string }>(setDraft: StateSetter<TDraft>, collectionKey: TCollectionKey) => (rowKey: string) => {
  setDraft((current) => ({ ...current, [collectionKey]: removeKeyedListItem(current[collectionKey] as TRow[], rowKey) }) as TDraft)
}

function useDismissableTargetState<T>() {
  const [target, setTarget] = useState<T | null>(null)
  return { target, setTarget, close: () => setTarget(null) }
}

function useTargetWithErrorState<T>() {
  const targetState = useDismissableTargetState<T>()
  const [error, setError] = useState('')
  return { ...targetState, error, setError, close: () => { targetState.close(); setError('') } }
}

function useResettableEditorState<TTarget, TDraft>(createClosedDraft: () => TDraft) {
  const targetState = useDismissableTargetState<TTarget>()
  const [draft, setDraft] = useState<TDraft>(createClosedDraft)
  const [error, setError] = useState('')
  const reset = (target: TTarget | null = null, nextDraft = createClosedDraft()) => {
    targetState.setTarget(target)
    setDraft(nextDraft)
    setError('')
  }
  return { ...targetState, draft, setDraft, error, setError, reset, close: () => reset() }
}

function useResettableValueState<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue)
  return { value, setValue, reset: (nextValue = initialValue) => setValue(nextValue) }
}

function usePackingEditorState() {
  const packageIdState = useResettableValueState<number | ''>('')
  const quantityState = useResettableValueState('1')
  const feedbackState = useResettableValueState('')
  const reset = (packageId: number | '' = '', quantity = '1', feedback = '') => {
    packageIdState.reset(packageId)
    quantityState.reset(quantity)
    feedbackState.reset(feedback)
  }
  return {
    packPackageId: packageIdState.value,
    setPackPackageId: packageIdState.setValue,
    packQuantity: quantityState.value,
    setPackQuantity: quantityState.setValue,
    packFeedback: feedbackState.value,
    setPackFeedback: feedbackState.setValue,
    reset,
    close: () => reset(),
  }
}

function useCodeVerifyState() {
  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState('')
  const [result, setResult] = useState<CodeVerifyResult | null>(null)
  return { isOpen, setIsOpen, code, setCode, result, setResult, close: () => { setIsOpen(false); setCode(''); setResult(null) } }
}

export function useAdminFoodManagementUiState(initialFoodBankId: number | null) {
  const [inventorySearch, setInventorySearch] = useState('')
  const [selectedFoodBankId, setSelectedFoodBankId] = useState<number | null>(initialFoodBankId)
  const itemEditorState = useResettableEditorState<{ mode: 'create' | 'edit'; itemId: number | null }, InventoryEditorDraft>(() => createEmptyInventoryDraft())
  const [isItemEditorSubmitting, setIsItemEditorSubmitting] = useState(false)
  const stockInState = useResettableEditorState<InventoryItem, InventoryStockInDraft>(createEmptyStockInDraft)
  const [isStockingIn, setIsStockingIn] = useState(false)
  const packageEditorState = useResettableEditorState<{ mode: 'create' | 'edit'; packageId: number | null }, PackageEditorDraft>(createEmptyPackageDraft)
  const [isPackageEditorSubmitting, setIsPackageEditorSubmitting] = useState(false)
  const packingEditorState = usePackingEditorState()
  const [isPacking, setIsPacking] = useState(false)
  const [pageFeedback, setPageFeedback] = useState<PageFeedback | null>(null)
  const lotExpiryState = useTargetWithErrorState<LotExpiryTarget>()
  const lotStatusState = useDismissableTargetState<LotStatusTarget>()
  const lotDeleteState = useDismissableTargetState<LotDeleteTarget>()
  const [isDeletingLot, setIsDeletingLot] = useState(false)
  const deleteItemState = useDismissableTargetState<DeleteItemTarget>()
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [donationSearch, setDonationSearch] = useState('')
  const [donationDonorTypeFilter, setDonationDonorTypeFilter] = useState<DonationDonorType | 'all'>('all')
  const [donationStatusFilter, setDonationStatusFilter] = useState<DonationStatusFilter>('all')
  const [selectedDonationIds, setSelectedDonationIds] = useState<string[]>([])
  const donationEditorState = useResettableEditorState<DonationEditorTarget, DonationEditorDraft>(createEmptyDonationDraft)
  const donationViewState = useDismissableTargetState<DonationListRow>()
  const deleteDonationState = useDismissableTargetState<DonationDeleteTarget>()
  const [codeSearch, setCodeSearch] = useState('')
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>([])
  const codeVerifyState = useCodeVerifyState()
  const codeViewState = useDismissableTargetState<AdminApplicationRecord>()
  const voidCodeState = useDismissableTargetState<CodeVoidTarget>()
  const [toastMessage, setToastMessage] = useState('Saved successfully.')
  const [isToastVisible, setIsToastVisible] = useState(false)

  const updateItemDraftField = createDraftFieldUpdater(itemEditorState.setDraft)
  const updateStockInDraftField = createDraftFieldUpdater(stockInState.setDraft)
  const updatePackageDraftValue = createDraftFieldUpdater(packageEditorState.setDraft)
  const updatePackageDraftRow = createDraftCollectionFieldUpdater<PackageEditorDraft, 'contents', PackageEditorRowDraft>(packageEditorState.setDraft, 'contents')
  const addPackageDraftRow = createDraftCollectionAppender<PackageEditorDraft, 'contents', PackageEditorRowDraft>(packageEditorState.setDraft, 'contents', createPackageDraftRow)
  const removePackageDraftRow = createDraftCollectionRemover<PackageEditorDraft, 'contents', PackageEditorRowDraft>(packageEditorState.setDraft, 'contents')
  const updateDonationDraftValue = createDraftFieldUpdater(donationEditorState.setDraft)
  const updateDonationDraftItem = createDraftCollectionFieldUpdater<DonationEditorDraft, 'items', DonationEditorItemDraft>(donationEditorState.setDraft, 'items')
  const addDonationDraftItem = createDraftCollectionAppender<DonationEditorDraft, 'items', DonationEditorItemDraft>(donationEditorState.setDraft, 'items', createDonationDraftItem)
  const removeDonationDraftItem = createDraftCollectionRemover<DonationEditorDraft, 'items', DonationEditorItemDraft>(donationEditorState.setDraft, 'items')

  const resetItemEditor = (target: { mode: 'create' | 'edit'; itemId: number | null } | null = null, item?: InventoryItem | null) => itemEditorState.reset(target, createEmptyInventoryDraft(item))
  const closeItemEditor = () => itemEditorState.close()
  const resetStockInEditor = (target: InventoryItem | null = null) => stockInState.reset(target, createEmptyStockInDraft())
  const closeStockInEditor = () => stockInState.close()
  const resetPackageEditor = (target: { mode: 'create' | 'edit'; packageId: number | null } | null = null, draft = createEmptyPackageDraft()) => packageEditorState.reset(target, draft)
  const closePackageEditor = () => packageEditorState.close()
  const updatePackageDraftField = (field: keyof Omit<PackageEditorDraft, 'contents'>, value: string) => updatePackageDraftValue(field, value)
  const resetPackingEditor = (packageId: number | '' = '', quantity = '1', feedback = '') => packingEditorState.reset(packageId, quantity, feedback)
  const closePackingEditor = () => packingEditorState.close()
  const setPageNotice = (tone: PageFeedback['tone'], message: string) => setPageFeedback({ tone, message })
  const clearPageFeedback = () => setPageFeedback(null)
  const closeLotExpiryEditor = () => lotExpiryState.close()
  const resetDonationEditor = (target: DonationEditorTarget | null = null, draft = createEmptyDonationDraft()) => donationEditorState.reset(target, draft)
  const closeDonationEditor = () => donationEditorState.close()
  const updateDonationDraftField = (field: keyof Omit<DonationEditorDraft, 'items'>, value: string) => updateDonationDraftValue(field, value)
  const closeCodeVerifyModal = () => codeVerifyState.close()

  const isActionBusy = (action: PendingAction) => pendingAction === action
  const isAnyInlineEditorOpen = [itemEditorState.target !== null, stockInState.target !== null, packageEditorState.target !== null, packingEditorState.packPackageId !== '', lotExpiryState.target !== null, lotStatusState.target !== null, lotDeleteState.target !== null, deleteItemState.target !== null, donationEditorState.target !== null, donationViewState.target !== null, deleteDonationState.target !== null, codeVerifyState.isOpen, codeViewState.target !== null, voidCodeState.target !== null].some(Boolean)
  const isInlineCloseDisabled = [isItemEditorSubmitting, isStockingIn, isPackageEditorSubmitting, isPacking, isDeletingLot, isActionBusy('lot-expiry'), isActionBusy('lot-status'), isActionBusy('delete-item'), isActionBusy('donation-save'), isActionBusy('donation-delete'), isActionBusy('code-check'), isActionBusy('code-redeem'), isActionBusy('code-void')].some(Boolean)

  const closeAllInlineEditors = () => {
    if (isInlineCloseDisabled) return
    closeItemEditor(); closeStockInEditor(); closePackageEditor(); closePackingEditor(); closeLotExpiryEditor()
    lotStatusState.close(); lotDeleteState.close(); deleteItemState.close(); closeDonationEditor(); donationViewState.close(); deleteDonationState.close(); closeCodeVerifyModal(); codeViewState.close(); voidCodeState.close()
  }

  useEffect(() => {
    document.body.classList.toggle('modal-open', isAnyInlineEditorOpen)
    return () => document.body.classList.remove('modal-open')
  }, [isAnyInlineEditorOpen])

  useEffect(() => {
    if (pageFeedback?.tone !== 'success') return
    setToastMessage(pageFeedback.message)
    setIsToastVisible(true)
    const timeoutHandle = window.setTimeout(() => {
      setIsToastVisible(false)
      setPageFeedback((current) => (current?.tone === 'success' ? null : current))
    }, 2200)
    return () => window.clearTimeout(timeoutHandle)
  }, [pageFeedback])

  return {
    inventorySearch, setInventorySearch, selectedFoodBankId, setSelectedFoodBankId,
    itemEditorTarget: itemEditorState.target, itemEditorDraft: itemEditorState.draft, itemEditorError: itemEditorState.error, setItemEditorError: itemEditorState.setError,
    isItemEditorSubmitting, setIsItemEditorSubmitting, resetItemEditor, closeItemEditor, updateItemDraftField,
    stockInTarget: stockInState.target, stockInDraft: stockInState.draft, stockInError: stockInState.error, setStockInError: stockInState.setError,
    isStockingIn, setIsStockingIn, resetStockInEditor, closeStockInEditor, updateStockInDraftField,
    packageEditorTarget: packageEditorState.target, packageEditorDraft: packageEditorState.draft, packageEditorError: packageEditorState.error, setPackageEditorError: packageEditorState.setError,
    isPackageEditorSubmitting, setIsPackageEditorSubmitting, resetPackageEditor, closePackageEditor, updatePackageDraftField, updatePackageDraftRow, addPackageDraftRow, removePackageDraftRow,
    packPackageId: packingEditorState.packPackageId, setPackPackageId: packingEditorState.setPackPackageId, packQuantity: packingEditorState.packQuantity, setPackQuantity: packingEditorState.setPackQuantity,
    isPacking, setIsPacking, packFeedback: packingEditorState.packFeedback, setPackFeedback: packingEditorState.setPackFeedback, resetPackingEditor, closePackingEditor,
    pageFeedback, setPageNotice, clearPageFeedback, toastMessage, isToastVisible,
    lotExpiryTarget: lotExpiryState.target, setLotExpiryTarget: lotExpiryState.setTarget, lotExpiryError: lotExpiryState.error, setLotExpiryError: lotExpiryState.setError, closeLotExpiryEditor,
    lotStatusTarget: lotStatusState.target, setLotStatusTarget: lotStatusState.setTarget, lotDeleteTarget: lotDeleteState.target, setLotDeleteTarget: lotDeleteState.setTarget, isDeletingLot, setIsDeletingLot,
    deleteItemTarget: deleteItemState.target, setDeleteItemTarget: deleteItemState.setTarget, pendingAction, setPendingAction, isActionBusy,
    donationSearch, setDonationSearch, donationDonorTypeFilter, setDonationDonorTypeFilter, donationStatusFilter, setDonationStatusFilter,
    selectedDonationIds, setSelectedDonationIds, donationEditorTarget: donationEditorState.target, donationDraft: donationEditorState.draft, donationEditorError: donationEditorState.error, setDonationEditorError: donationEditorState.setError,
    donationViewTarget: donationViewState.target, setDonationViewTarget: donationViewState.setTarget, deleteDonationTarget: deleteDonationState.target, setDeleteDonationTarget: deleteDonationState.setTarget,
    resetDonationEditor, closeDonationEditor, updateDonationDraftField, updateDonationDraftItem, addDonationDraftItem, removeDonationDraftItem,
    codeSearch, setCodeSearch, selectedCodeIds, setSelectedCodeIds, isCodeVerifyOpen: codeVerifyState.isOpen, setIsCodeVerifyOpen: codeVerifyState.setIsOpen,
    verifyCodeInput: codeVerifyState.code, setVerifyCodeInput: codeVerifyState.setCode, codeVerifyResult: codeVerifyState.result, setCodeVerifyResult: codeVerifyState.setResult, codeViewTarget: codeViewState.target, setCodeViewTarget: codeViewState.setTarget,
    voidCodeTarget: voidCodeState.target, setVoidCodeTarget: voidCodeState.setTarget, closeCodeVerifyModal, isAnyInlineEditorOpen, closeAllInlineEditors,
  }
}