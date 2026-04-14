import type { AdminApplicationRecord } from '@/shared/lib/api/applications'
import { applicationsAPI } from '@/shared/lib/api/applications'
import { adminAPI } from '@/shared/lib/api/admin'
import type { GoodsDonationCreatePayload } from '@/shared/lib/api/donations'
import type { DonationListRow } from '@/shared/types/donations'
import { makeTaskRunner } from './runTask'
import { buildCodeVerifyResult, buildDonationDraft, toggleSelectedGroup, toggleSelectedId } from './builders'
import { buildDonationDisplayId, normalizeAdminDonationPhone, normalizeRedemptionCode, parseUkDateInput } from './formatting'
import type { DonationEditorDraft, DonationEditorTarget, PendingAction } from './adminFoodManagement.types'
import { canRedeemApplication, canVoidApplication } from './rules'
import type { useAdminFoodManagementData } from './useAdminFoodManagementData'
import type { useAdminFoodManagementUiState } from './useAdminFoodManagementUiState'

type AdminFoodManagementUiState = ReturnType<typeof useAdminFoodManagementUiState>
type AdminFoodManagementData = ReturnType<typeof useAdminFoodManagementData>
type PageAction = Exclude<PendingAction, null>
type SelectionSetter = AdminFoodManagementUiState['setSelectedDonationIds']
type UseAdminDonationCodeActionsParams = {
  accessToken: string | null
  sessionExpiredMessage: string
  donorEmailPattern: RegExp
  uiState: AdminFoodManagementUiState
  dataState: AdminFoodManagementData
  filteredDonations: DonationListRow[]
  filteredApplications: AdminApplicationRecord[]
  selectedDonationIdSet: Set<string>
  selectedCodeIdSet: Set<string>
}

type RunRowsActionOptions<Target> = {
  rows: Target[]
  pendingAction: PageAction
  task: (row: Target, token: string) => Promise<unknown>
  errorMessage: string
  successMessage?: string
  emptyMessage?: string
  reloadData?: boolean
  onSuccess?: () => void
  onError?: (message: string) => void
  onMissingToken?: (message: string) => void
}

const donationFieldMessage = 'Please complete all donation fields before submitting.'

function buildDonationEditorPayload(
  draft: DonationEditorDraft,
  target: DonationEditorTarget,
  donorEmailPattern: RegExp,
): { error: string } | { payload: GoodsDonationCreatePayload } {
  const donorName = draft.donorName.trim()
  const donorEmail = draft.donorEmail.trim()
  const receivedDate = draft.receivedDate.trim()
  if (!draft.donorType || !donorName || !donorEmail || !receivedDate) return { error: donationFieldMessage }
  if (!donorEmailPattern.test(donorEmail)) return { error: 'Enter a valid contact email address.' }

  const pickupDate = parseUkDateInput(receivedDate)
  if (!pickupDate) return { error: 'Received Date must use DD/MM/YYYY.' }

  const items: GoodsDonationCreatePayload['items'] = []
  for (const row of draft.items) {
    const itemName = row.itemName.trim()
    const quantity = Number(row.quantity)
    const expiryInput = row.expiryDate.trim()
    if (!itemName && quantity <= 0 && !expiryInput) continue
    if (!itemName || !Number.isInteger(quantity) || quantity <= 0) return { error: 'Each donation row needs an item and quantity.' }
    const expiryDate = expiryInput ? parseUkDateInput(expiryInput) : undefined
    if (expiryDate === null) return { error: 'Item expiry dates must use DD/MM/YYYY.' }
    items.push({ item_name: itemName, quantity, expiry_date: expiryDate ?? undefined })
  }

  if (!items.length) return { error: donationFieldMessage }
  return {
    payload: {
      donor_name: donorName,
      donor_type: draft.donorType,
      donor_email: donorEmail,
      donor_phone: normalizeAdminDonationPhone(target.donation?.donor_phone),
      pickup_date: pickupDate,
      status: 'received',
      items,
    },
  }
}

export function useAdminDonationCodeActions({
  accessToken,
  sessionExpiredMessage,
  donorEmailPattern,
  uiState,
  dataState,
  filteredDonations,
  filteredApplications,
  selectedDonationIdSet,
  selectedCodeIdSet,
}: UseAdminDonationCodeActionsParams) {
  const { runPendingTask } = makeTaskRunner({
    accessToken,
    sessionExpiredMessage,
    setPageNotice: uiState.setPageNotice,
    setPendingAction: uiState.setPendingAction,
  })
  const setCodeVerifyError = (title: string, message: string) => uiState.setCodeVerifyResult({ tone: 'error', title, message, record: null })
  const reloadAllData = () => dataState.reloadAllData()

  const runRowsAction = async <Target>({ rows, pendingAction, task, errorMessage, successMessage, emptyMessage, reloadData = true, onSuccess, onError, onMissingToken }: RunRowsActionOptions<Target>) => {
    if (!rows.length) return emptyMessage ? uiState.setPageNotice('error', emptyMessage) : undefined
    await runPendingTask({
      action: pendingAction,
      fallbackMessage: errorMessage,
      reportMissingToken: onMissingToken,
      afterSuccess: reloadData ? reloadAllData : undefined,
      successMessage,
      onSuccess: () => onSuccess?.(),
      onError,
      task: async (token) => {
        await Promise.all(rows.map((row) => task(row, token)))
      },
    })
  }

  const pickSelectedRows = <Row extends { id: string }>(rows: Row[], selectedIds: Set<string>, isAllowed: (row: Row) => boolean = () => true) =>
    rows.filter((row) => selectedIds.has(row.id) && isAllowed(row))
  const toggleSelection = (setter: SelectionSetter, id: string) => setter((current) => toggleSelectedId(current, id))
  const toggleSelectionGroup = (setter: SelectionSetter, visibleIds: string[], ids?: string[]) => setter((current) => toggleSelectedGroup(current, ids ?? visibleIds, !ids))
  const updateDonationAsReceived = (donationId: string, token: string) => adminAPI.updateGoodsDonation(donationId, { status: 'received' }, token)
  const deleteDonationRecord = (donation: DonationListRow, token: string) => donation.donation_type === 'cash' ? adminAPI.deleteCashDonation(donation.id, token) : adminAPI.deleteGoodsDonation(donation.id, token)

  const openNewDonationEditor = () => uiState.resetDonationEditor({ mode: 'create', donation: null })
  const openEditDonationEditor = (donation: DonationListRow) => uiState.resetDonationEditor({ mode: 'edit', donation }, buildDonationDraft(donation))
  const submitDonationEditor = async () => {
    const target = uiState.donationEditorTarget
    if (!target) return void uiState.setDonationEditorError(sessionExpiredMessage)

    const payloadResult = buildDonationEditorPayload(uiState.donationDraft, target, donorEmailPattern)
    if ('error' in payloadResult) return void uiState.setDonationEditorError(payloadResult.error)
    uiState.setDonationEditorError('')
    await runPendingTask({
      action: 'donation-save',
      fallbackMessage: 'Failed to save donation.',
      reportMissingToken: uiState.setDonationEditorError,
      afterSuccess: reloadAllData,
      successMessage: target.mode === 'edit' ? 'Donation saved.' : 'Donation submitted.',
      onSuccess: uiState.closeDonationEditor,
      onError: uiState.setDonationEditorError,
      task: (token) => target.mode === 'edit' && target.donation
        ? adminAPI.updateGoodsDonation(target.donation.id, payloadResult.payload, token)
        : adminAPI.createGoodsDonation(payloadResult.payload, token),
    })
  }

  const openDonationView = (donation: DonationListRow) => uiState.setDonationViewTarget(donation)
  const openDeleteDonationConfirm = (donation: DonationListRow) => uiState.setDeleteDonationTarget({ donation, displayId: buildDonationDisplayId(donation) })
  const receiveDonation = (donation: DonationListRow) => runRowsAction({
    rows: [donation],
    pendingAction: 'donation-receive',
    task: (row, token) => updateDonationAsReceived(row.id, token),
    successMessage: 'Donation marked as received.',
    errorMessage: 'Failed to mark donation as received.',
  })
  const submitDeleteDonation = () => runRowsAction({
    rows: uiState.deleteDonationTarget ? [uiState.deleteDonationTarget.donation] : [],
    pendingAction: 'donation-delete',
    task: deleteDonationRecord,
    successMessage: 'Donation record deleted.',
    errorMessage: 'Failed to delete donation.',
    onSuccess: () => uiState.setDeleteDonationTarget(null),
  })

  const toggleDonationSelection = (donationId: string) => toggleSelection(uiState.setSelectedDonationIds, donationId)
  const toggleAllDonations = (donationIds?: string[]) => toggleSelectionGroup(uiState.setSelectedDonationIds, filteredDonations.map(({ id }) => id), donationIds)
  const submitBatchReceiveDonations = () => runRowsAction({
    rows: pickSelectedRows(dataState.donations, selectedDonationIdSet, (donation) => donation.donation_type === 'goods' && donation.status === 'pending'),
    emptyMessage: 'Select at least one pending goods donation.',
    pendingAction: 'donation-batch-receive',
    task: (donation, token) => updateDonationAsReceived(donation.id, token),
    successMessage: 'Selected donations marked as received.',
    errorMessage: 'Failed to receive selected donations.',
    onSuccess: () => uiState.setSelectedDonationIds([]),
  })
  const submitBatchDeleteDonations = () => runRowsAction({
    rows: pickSelectedRows(dataState.donations, selectedDonationIdSet),
    emptyMessage: 'Select at least one donation record to delete.',
    pendingAction: 'donation-batch-delete',
    task: deleteDonationRecord,
    successMessage: 'Selected donation records deleted.',
    errorMessage: 'Failed to delete selected donations.',
    onSuccess: () => uiState.setSelectedDonationIds([]),
  })

  const toggleCodeSelection = (applicationId: string) => toggleSelection(uiState.setSelectedCodeIds, applicationId)
  const toggleAllCodes = (applicationIds?: string[]) => toggleSelectionGroup(uiState.setSelectedCodeIds, filteredApplications.map(({ id }) => id), applicationIds)
  const openCodeView = (record: AdminApplicationRecord) => uiState.setCodeViewTarget(record)
  const openVoidCodeConfirm = (record: AdminApplicationRecord) => uiState.setVoidCodeTarget({ record })
  const checkRedemptionCode = async () => {
    const normalizedCode = normalizeRedemptionCode(uiState.verifyCodeInput)
    if (!normalizedCode) return void setCodeVerifyError('Missing Code', 'Enter a redemption code first.')
    await runPendingTask<AdminApplicationRecord>({
      action: 'code-check',
      fallbackMessage: 'Redemption code not found.',
      reportMissingToken: (message) => setCodeVerifyError('Session Expired', message),
      onSuccess: (record: AdminApplicationRecord) => {
        uiState.setVerifyCodeInput(normalizedCode)
        uiState.setCodeVerifyResult(buildCodeVerifyResult(record))
      },
      onError: (message) => setCodeVerifyError('Code Not Found', message),
      task: (token) => applicationsAPI.getApplicationByCode(normalizedCode, token),
    })
  }
  const redeemVerifiedCode = async () => {
    const record = uiState.codeVerifyResult?.record
    if (!record || !canRedeemApplication(record)) return void uiState.setPageNotice('error', 'Check a pending redemption code before redeeming.')
    await runRowsAction({
      rows: [record],
      pendingAction: 'code-redeem',
      task: (row, token) => applicationsAPI.redeemApplication(row.id, token),
      successMessage: 'Redemption completed.',
      errorMessage: 'Failed to redeem code.',
      onSuccess: uiState.closeCodeVerifyModal,
      onMissingToken: (message) => setCodeVerifyError('Session Expired', message),
    })
  }
  const submitVoidCode = () => runRowsAction({
    rows: uiState.voidCodeTarget ? [uiState.voidCodeTarget.record] : [],
    pendingAction: 'code-void',
    task: (record, token) => applicationsAPI.voidApplication(record.id, token),
    successMessage: 'Redemption code voided.',
    errorMessage: 'Failed to void code.',
    onSuccess: () => uiState.setVoidCodeTarget(null),
  })
  const submitBatchVoidCodes = () => runRowsAction({
    rows: pickSelectedRows(dataState.applications, selectedCodeIdSet, canVoidApplication),
    emptyMessage: 'Select at least one pending code to void.',
    pendingAction: 'code-batch-void',
    task: (record, token) => applicationsAPI.voidApplication(record.id, token),
    successMessage: 'Selected redemption codes voided.',
    errorMessage: 'Failed to void selected codes.',
    onSuccess: () => uiState.setSelectedCodeIds([]),
  })

  return { openNewDonationEditor, openEditDonationEditor, submitDonationEditor, openDonationView, openDeleteDonationConfirm, receiveDonation, submitDeleteDonation, toggleDonationSelection, toggleAllDonations, submitBatchReceiveDonations, submitBatchDeleteDonations, openCodeView, openVoidCodeConfirm, checkRedemptionCode, redeemVerifiedCode, submitVoidCode, submitBatchVoidCodes, toggleCodeSelection, toggleAllCodes }
}

