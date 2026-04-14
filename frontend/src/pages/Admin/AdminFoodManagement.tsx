import { useEffect, useMemo } from 'react'
import { useAuthStore } from '@/app/store/authStore'
import AdminFeedbackBanner from '@/features/admin/components/AdminFeedbackBanner'
import { getAdminScopeMeta } from '@/shared/lib/adminScope'
import { useScrollToTopOnMount } from '@/shared/lib/scroll'
import { usePublicImpactMetrics } from '@/shared/lib/usePublicImpactMetrics'
import AdminPageShell from './AdminPageShell'
import { getPageMeta } from './pageMeta'
import { AdminFoodManagementConfirmModals } from './confirmDialogs'
import { inventoryCategoryOptions, packageCategoryOptions } from './adminFoodManagement.constants'
import { buildScopedInventoryItems, buildScopedSectionBindings } from './builders'
import { makeItemOps } from './itemOps'
import { makeLotOps } from './lotOps'
import { CodeDetailsModal, CodeVerifyModal } from './adminFoodManagement.modals.codes'
import { DonationDetailsModal, DonationEditorModal } from './adminFoodManagement.modals.donations'
import { InventoryItemEditorModal, InventoryStockInModal, LotExpiryModal, PackageEditorModal, PackingModal } from './adminFoodManagement.modals.inventory'
import { makePackageOps } from './packageOps'
import { SectionBlock as ManagementSection } from './SectionBlock'
import { AdminSummaryCard } from './sectionBits'
import { AdminItemsSection, AdminLotsSection } from './adminFoodManagement.sections.inventory'
import { AdminDonationsSection, AdminCodesSection } from './adminFoodManagement.sections.operations'
import { AdminPackagesSection } from './adminFoodManagement.sections.packages'
import type { PackingStockCheckRow } from './adminFoodManagement.types'
import { filterApplications, filterDonations } from './rules'
import { useAdminDonationCodeActions } from './useAdminDonationCodeActions'
import { useAdminFoodManagementData } from './useAdminFoodManagementData'
import { useAdminFoodManagementUiState } from './useAdminFoodManagementUiState'

const sessionExpiredMessage = 'Please login again and retry.'
const donorEmailPattern = /\S+@\S+\.\S+/
const inventoryEditorCategories = Array.from(inventoryCategoryOptions)
const packageEditorCategories = Array.from(packageCategoryOptions)
const runWithoutAwait = <Args extends unknown[], Result>(action: (...args: Args) => Result | Promise<Result>) => (...args: Args) => { void action(...args) }

export default function AdminFoodManagement() {
  const pageMeta = getPageMeta('food')
  const user = useAuthStore((state) => state.user)
  const adminScope = useMemo(() => getAdminScopeMeta(user), [user])
  const adminScopeFoodBankId = adminScope.foodBankId ?? null
  const uiState = useAdminFoodManagementUiState(adminScope.foodBankId)
  const {
    codeSearch,
    donationDonorTypeFilter,
    donationSearch,
    donationStatusFilter,
    selectedFoodBankId,
    setInventorySearch,
    setSelectedCodeIds,
    setSelectedDonationIds,
    setSelectedFoodBankId,
  } = uiState
  const dataState = useAdminFoodManagementData({ adminScope, selectedFoodBankId })
  const { impactMetrics, status: publicImpactStatus, refreshImpactMetrics } = usePublicImpactMetrics({ refreshIntervalMs: 15_000 })
  const scopeData = dataState

  const { filteredApplications, filteredDonations, itemOptions, packingStockCheckRows, scopedInventoryItems, sectionScopeProps, selectedCodeIdSet, selectedDonationIdSet } = useMemo(() => {
    const scopedInventoryItems = buildScopedInventoryItems(dataState.inventory, scopeData.scopeState)
    const sectionScopeProps = buildScopedSectionBindings({
      scopeState: scopeData.scopeState,
      foodBankFilterOptions: scopeData.foodBankFilterOptions,
      selectedFoodBankId,
      setSelectedFoodBankId: uiState.setSelectedFoodBankId,
      availableFoodBanksError: scopeData.availableFoodBanksError,
      scopedPackageError: scopeData.scopedPackageError,
    })
    const itemOptions = Array.from(new Set(dataState.inventory.map((item) => item.name.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right))
    const filteredDonations = filterDonations(dataState.donations, donationSearch, donationDonorTypeFilter, donationStatusFilter)
    const filteredApplications = filterApplications(dataState.applications, codeSearch)
    const selectedDonationIdSet = new Set(uiState.selectedDonationIds)
    const selectedCodeIdSet = new Set(uiState.selectedCodeIds)
    const detail = uiState.packPackageId ? scopeData.packageDetailsById[uiState.packPackageId] : undefined
    const packingStockCheckRows: PackingStockCheckRow[] = !detail ? [] : detail.package_items.map((item) => {
      const inventoryItem = scopedInventoryItems.find((entry) => entry.id === item.inventory_item_id)
      return {
        itemId: item.inventory_item_id,
        name: item.inventory_item_name,
        requiredQuantity: item.quantity,
        availableQuantity: inventoryItem?.stock ?? 0,
        unit: inventoryItem?.unit ?? item.inventory_item_unit ?? 'units',
      }
    })

    return { filteredApplications, filteredDonations, itemOptions, packingStockCheckRows, scopedInventoryItems, sectionScopeProps, selectedCodeIdSet, selectedDonationIdSet }
  }, [
    dataState.applications,
    dataState.donations,
    dataState.inventory,
    scopeData.availableFoodBanksError,
    scopeData.foodBankFilterOptions,
    scopeData.packageDetailsById,
    scopeData.scopeState,
    scopeData.scopedPackageError,
    codeSearch,
    donationDonorTypeFilter,
    donationSearch,
    donationStatusFilter,
    uiState.packPackageId,
    uiState.selectedCodeIds,
    uiState.selectedDonationIds,
    selectedFoodBankId,
    uiState.setSelectedFoodBankId,
  ])

  const inventoryActions = {
    ...makeItemOps({
      accessToken: dataState.accessToken,
      sessionExpiredMessage,
      adminScopeFoodBankId,
      selectedFoodBankId: uiState.selectedFoodBankId,
      scopedInventoryItems,
      scopedPackageRows: scopeData.scopedPackageRows,
      itemEditorTarget: uiState.itemEditorTarget,
      itemEditorDraft: uiState.itemEditorDraft,
      setItemEditorError: uiState.setItemEditorError,
      setIsItemEditorSubmitting: uiState.setIsItemEditorSubmitting,
      resetItemEditor: uiState.resetItemEditor,
      closeItemEditor: uiState.closeItemEditor,
      stockInTarget: uiState.stockInTarget,
      stockInDraft: uiState.stockInDraft,
      setStockInError: uiState.setStockInError,
      setIsStockingIn: uiState.setIsStockingIn,
      resetStockInEditor: uiState.resetStockInEditor,
      closeStockInEditor: uiState.closeStockInEditor,
      deleteItemTarget: uiState.deleteItemTarget,
      setDeleteItemTarget: uiState.setDeleteItemTarget,
      setPendingAction: uiState.setPendingAction,
      setPageNotice: uiState.setPageNotice,
      refreshInventoryAndLots: dataState.refreshInventoryAndLots,
      deleteItem: dataState.deleteItem,
    }),
    ...makePackageOps({
      accessToken: dataState.accessToken,
      sessionExpiredMessage,
      adminScopeFoodBankId,
      selectedFoodBankId: uiState.selectedFoodBankId,
      scopedPackageDetails: scopeData.scopedPackageDetails,
      packageDetailsById: scopeData.packageDetailsById,
      setPackageDetailsById: scopeData.setPackageDetailsById,
      setIsLoadingPackageDetail: scopeData.setIsLoadingPackageDetail,
      packageEditorTarget: uiState.packageEditorTarget,
      packageEditorDraft: uiState.packageEditorDraft,
      setPackageEditorError: uiState.setPackageEditorError,
      setIsPackageEditorSubmitting: uiState.setIsPackageEditorSubmitting,
      resetPackageEditor: uiState.resetPackageEditor,
      closePackageEditor: uiState.closePackageEditor,
      packPackageId: uiState.packPackageId,
      packQuantity: uiState.packQuantity,
      setPackPackageId: uiState.setPackPackageId,
      setPackFeedback: uiState.setPackFeedback,
      setIsPacking: uiState.setIsPacking,
      resetPackingEditor: uiState.resetPackingEditor,
      setPageNotice: uiState.setPageNotice,
      refreshInventoryAndLots: dataState.refreshInventoryAndLots,
      refreshScopedPackages: scopeData.refreshScopedPackages,
    }),
    ...makeLotOps({
      accessToken: dataState.accessToken,
      sessionExpiredMessage,
      lotRows: dataState.lotRows,
      lotExpiryTarget: uiState.lotExpiryTarget,
      setLotExpiryTarget: uiState.setLotExpiryTarget,
      setLotExpiryError: uiState.setLotExpiryError,
      closeLotExpiryEditor: uiState.closeLotExpiryEditor,
      lotStatusTarget: uiState.lotStatusTarget,
      setLotStatusTarget: uiState.setLotStatusTarget,
      lotDeleteTarget: uiState.lotDeleteTarget,
      setLotDeleteTarget: uiState.setLotDeleteTarget,
      setIsDeletingLot: uiState.setIsDeletingLot,
      setPendingAction: uiState.setPendingAction,
      setPageNotice: uiState.setPageNotice,
      refreshInventoryAndLots: dataState.refreshInventoryAndLots,
      refreshLots: dataState.refreshLots,
    }),
  }

  const donationActions = useAdminDonationCodeActions({ accessToken: dataState.accessToken, sessionExpiredMessage, donorEmailPattern, uiState, dataState, filteredDonations, filteredApplications, selectedDonationIdSet, selectedCodeIdSet })
  const openPackageEditor = runWithoutAwait(inventoryActions.openEditPackageEditor)
  const openLotDeleteConfirm = async (lotId: number) => inventoryActions.openDeleteLotConfirm(lotId)
  const receiveDonation = runWithoutAwait(donationActions.receiveDonation)
  const batchDeleteDonations = runWithoutAwait(donationActions.submitBatchDeleteDonations)
  const batchReceiveDonations = runWithoutAwait(donationActions.submitBatchReceiveDonations)
  const batchVoidCodes = runWithoutAwait(donationActions.submitBatchVoidCodes)

  useEffect(() => { setSelectedDonationIds([]) }, [dataState.donations, donationSearch, donationDonorTypeFilter, donationStatusFilter, setSelectedDonationIds])
  useEffect(() => { setSelectedCodeIds([]) }, [dataState.applications, codeSearch, setSelectedCodeIds])
  useEffect(() => {
    if (dataState.isLoadingDonations || dataState.isLoadingApplications) return
    void refreshImpactMetrics({ silent: true })
  }, [dataState.applications, dataState.donations, dataState.isLoadingApplications, dataState.isLoadingDonations, refreshImpactMetrics])
  useEffect(() => {
    if (scopeData.scopeState.hasFixedFoodBank) setSelectedFoodBankId(adminScope.foodBankId)
    else if (!scopeData.scopeState.canChooseFoodBank) setSelectedFoodBankId(null)
  }, [adminScope.foodBankId, scopeData.scopeState.canChooseFoodBank, scopeData.scopeState.hasFixedFoodBank, setSelectedFoodBankId])
  useEffect(() => { if (scopeData.scopeState.isFoodBankSelectionRequired) setInventorySearch('') }, [scopeData.scopeState.isFoodBankSelectionRequired, selectedFoodBankId, setInventorySearch])
  useScrollToTopOnMount()
  useEffect(() => { document.title = 'Inventory Management - ABC Foodbank' }, [])

  const publicImpactMessageTone = publicImpactStatus === 'error' ? 'warning' : publicImpactStatus === 'ready' ? 'success' : 'default'
  const publicImpactMessageTitle = publicImpactStatus === 'loading'
    ? 'Refreshing shared public totals'
    : publicImpactStatus === 'error'
      ? 'Showing the latest available public snapshot'
      : 'Shared public totals are in sync'
  const publicImpactMessageLine = publicImpactStatus === 'loading'
    ? 'These cards use the same live source as Home and Donate Cash.'
    : publicImpactStatus === 'error'
      ? 'The latest refresh did not complete, so the most recent successful values remain visible.'
      : 'Updates to donations and redemption activity refresh these cards automatically.'

  const sections = [
    {
      id: 'shared-public-impact',
      title: 'Shared Public Impact Snapshot',
      description: 'These are the same live public totals shown on Home and Donate Cash.',
      content: <>
        <div className={`admin-inline-message admin-inline-message--${publicImpactMessageTone}`}>
          <p className="admin-inline-message-title">{publicImpactMessageTitle}</p>
          <div className="admin-inline-message-body">
            <p className="admin-inline-message-line">{publicImpactMessageLine}</p>
          </div>
        </div>
        <div className="admin-card-grid">
          {impactMetrics.map((metric) => (
            <AdminSummaryCard key={metric.label} title={metric.label} description={metric.note}>
              <div className="kpi-value">{metric.value}</div>
              <div className={`kpi-trend ${metric.positive === false ? 'trend-down' : 'trend-up'}`}>{metric.change}</div>
            </AdminSummaryCard>
          ))}
        </div>
      </>,
    },
    {
      id: 'donation-intake',
      title: 'Donation Intake & Recording',
      description: 'Log in-kind and cash donations from individuals, supermarkets, and partners. All records update inventory in real-time.',
      content: <><>{dataState.loadError ? <AdminFeedbackBanner tone="error" message={dataState.loadError} /> : null}</>{uiState.pageFeedback && uiState.pageFeedback.tone !== 'success' ? <AdminFeedbackBanner tone={uiState.pageFeedback.tone} message={uiState.pageFeedback.message} onClose={uiState.clearPageFeedback} /> : null}<AdminDonationsSection heading="Donation Records" search={uiState.donationSearch} donorTypeFilter={uiState.donationDonorTypeFilter} statusFilter={uiState.donationStatusFilter} donations={filteredDonations} selectedDonationIds={selectedDonationIdSet} isLoadingDonations={dataState.isLoadingDonations} donationError={dataState.donationError} onSearchChange={uiState.setDonationSearch} onDonorTypeFilterChange={uiState.setDonationDonorTypeFilter} onStatusFilterChange={uiState.setDonationStatusFilter} onNewDonation={donationActions.openNewDonationEditor} onToggleDonationSelection={donationActions.toggleDonationSelection} onToggleAllDonations={donationActions.toggleAllDonations} onViewDonation={donationActions.openDonationView} onEditDonation={donationActions.openEditDonationEditor} onReceiveDonation={receiveDonation} onDeleteDonation={donationActions.openDeleteDonationConfirm} onBatchDelete={batchDeleteDonations} onBatchReceive={batchReceiveDonations} isBatchDeleteBusy={uiState.isActionBusy('donation-batch-delete')} isBatchReceiveBusy={uiState.isActionBusy('donation-batch-receive')} /></>,
    },
    {
      id: 'inventory-items',
      title: 'Item Inventory Management',
      description: "Manage your food bank's item catalog, current stock levels, and safety thresholds.",
      content: <AdminItemsSection search={uiState.inventorySearch} inventoryItems={scopedInventoryItems} isLoadingData={dataState.isLoadingData} onSearchChange={uiState.setInventorySearch} onAddItem={inventoryActions.openNewItemEditor} onEditItem={inventoryActions.openEditItemEditor} onAdjustItem={inventoryActions.openItemAdjustModal} onDeleteItem={inventoryActions.handleDeleteItem} {...sectionScopeProps.inventory} />,
    },
    {
      id: 'package-management',
      title: 'Food Package Building & Management',
      description: 'Create and manage standard food aid packages, and log packing operations to update inventory automatically.',
      content: <AdminPackagesSection heading="Food Package" addButtonLabel="New Food Package" packageRows={scopeData.scopedPackageRows} isLoadingData={dataState.isLoadingData || scopeData.isLoadingScopedPackages} onAddPackage={inventoryActions.openNewPackageEditor} onEditPackage={openPackageEditor} onOpenPackTab={inventoryActions.openPackTab} {...sectionScopeProps.packages} />,
    },
    {
      id: 'expiry-tracking',
      title: 'Lot Tracking & Expiry Management',
      description: 'Track item batches, monitor expiry dates, and reduce food waste with proactive alerts.',
      content: <AdminLotsSection heading="Lot Records" inventoryItems={dataState.inventory} lotRows={dataState.lotRows} isLoadingLots={dataState.isLoadingLots} lotError={dataState.lotError} onEditExpiry={inventoryActions.handleLotExpiryEdit} onToggleStatus={inventoryActions.handleLotStatusToggle} onDeleteLot={openLotDeleteConfirm} onBatchWasteLots={inventoryActions.submitBatchWasteLots} onBatchDeleteLots={inventoryActions.submitBatchDeleteLots} />,
    },
    {
      id: 'code-verification',
      title: 'Redemption Code Verification',
      description: 'Verify redemption codes for aid recipients, and confirm package pickup.',
      content: <AdminCodesSection heading="Redemption Code Records" search={uiState.codeSearch} applications={filteredApplications} selectedCodeIds={selectedCodeIdSet} isLoadingApplications={dataState.isLoadingApplications} applicationsError={dataState.applicationsError} onSearchChange={uiState.setCodeSearch} onOpenVerify={() => uiState.setIsCodeVerifyOpen(true)} onToggleCodeSelection={donationActions.toggleCodeSelection} onToggleAllCodes={donationActions.toggleAllCodes} onViewCode={donationActions.openCodeView} onVoidCode={donationActions.openVoidCodeConfirm} onBatchVoid={batchVoidCodes} isBatchVoidBusy={uiState.isActionBusy('code-batch-void')} />,
    },
  ]

  const editorModals = <><InventoryItemEditorModal id={uiState.itemEditorTarget?.mode === 'edit' ? 'edit-item-editor' : 'new-item-editor'} isOpen={uiState.itemEditorTarget !== null} isEditing={uiState.itemEditorTarget?.mode === 'edit'} draft={uiState.itemEditorDraft} error={uiState.itemEditorError} submitting={uiState.isItemEditorSubmitting} categoryOptions={inventoryEditorCategories} onClose={uiState.closeItemEditor} onFieldChange={uiState.updateItemDraftField} onSubmit={inventoryActions.submitItemEditor} /><InventoryStockInModal isOpen={uiState.stockInTarget !== null} itemName={uiState.stockInTarget?.name ?? ''} draft={uiState.stockInDraft} error={uiState.stockInError} submitting={uiState.isStockingIn} onClose={uiState.closeStockInEditor} onFieldChange={uiState.updateStockInDraftField} onSubmit={inventoryActions.submitStockIn} /><PackageEditorModal id={uiState.packageEditorTarget?.mode === 'edit' ? 'edit-package-editor' : 'new-package-editor'} isOpen={uiState.packageEditorTarget !== null} isEditing={uiState.packageEditorTarget?.mode === 'edit'} draft={uiState.packageEditorDraft} inventoryItems={scopedInventoryItems} error={uiState.packageEditorError} submitting={uiState.isPackageEditorSubmitting} categoryOptions={packageEditorCategories} onClose={uiState.closePackageEditor} onFieldChange={uiState.updatePackageDraftField} onRowChange={uiState.updatePackageDraftRow} onAddRow={uiState.addPackageDraftRow} onRemoveRow={uiState.removePackageDraftRow} onSubmit={inventoryActions.submitPackageEditor} /><PackingModal isOpen={uiState.packPackageId !== ''} packages={scopeData.scopedPackingPackages} selectedPackageId={uiState.packPackageId} quantity={uiState.packQuantity} stockCheckRows={packingStockCheckRows} feedback={uiState.packFeedback} loadingStockCheck={scopeData.isLoadingPackageDetail} submitting={uiState.isPacking} onClose={uiState.closePackingEditor} onPackageChange={inventoryActions.handlePackingPackageChange} onQuantityChange={uiState.setPackQuantity} onSubmit={inventoryActions.handlePackPackage} /><LotExpiryModal isOpen={uiState.lotExpiryTarget !== null} target={uiState.lotExpiryTarget} expiryValue={uiState.lotExpiryTarget?.expiryDate ?? ''} error={uiState.lotExpiryError} submitting={uiState.isActionBusy('lot-expiry')} onClose={uiState.closeLotExpiryEditor} onExpiryChange={(value) => uiState.setLotExpiryTarget((current) => (current ? { ...current, expiryDate: value } : current))} onSubmit={inventoryActions.submitLotExpiryEdit} /><DonationEditorModal isOpen={uiState.donationEditorTarget !== null} isEditing={uiState.donationEditorTarget?.mode === 'edit'} draft={uiState.donationDraft} itemOptions={itemOptions} error={uiState.donationEditorError} submitting={uiState.isActionBusy('donation-save')} onClose={uiState.closeDonationEditor} onFieldChange={uiState.updateDonationDraftField} onItemChange={uiState.updateDonationDraftItem} onAddItem={uiState.addDonationDraftItem} onRemoveItem={uiState.removeDonationDraftItem} onSubmit={donationActions.submitDonationEditor} /></>
  const confirmDetailModals = <><AdminFoodManagementConfirmModals lotStatusTarget={uiState.lotStatusTarget} onCloseLotStatus={() => uiState.setLotStatusTarget(null)} onConfirmLotStatus={inventoryActions.submitLotStatusToggle} isLotStatusSubmitting={uiState.isActionBusy('lot-status')} lotDeleteTarget={uiState.lotDeleteTarget} onCloseLotDelete={() => uiState.setLotDeleteTarget(null)} onConfirmLotDelete={inventoryActions.submitDeleteLot} isLotDeleteSubmitting={uiState.isDeletingLot} deleteItemTarget={uiState.deleteItemTarget} onCloseDeleteItem={() => uiState.setDeleteItemTarget(null)} onConfirmDeleteItem={inventoryActions.submitDeleteItem} isDeleteItemSubmitting={uiState.isActionBusy('delete-item')} deleteDonationTarget={uiState.deleteDonationTarget} onCloseDeleteDonation={() => uiState.setDeleteDonationTarget(null)} onConfirmDeleteDonation={donationActions.submitDeleteDonation} isDeleteDonationSubmitting={uiState.isActionBusy('donation-delete')} voidCodeTarget={uiState.voidCodeTarget} onCloseVoidCode={() => uiState.setVoidCodeTarget(null)} onConfirmVoidCode={donationActions.submitVoidCode} isVoidCodeSubmitting={uiState.isActionBusy('code-void')} /><DonationDetailsModal donation={uiState.donationViewTarget} isOpen={uiState.donationViewTarget !== null} onClose={() => uiState.setDonationViewTarget(null)} /><CodeVerifyModal isOpen={uiState.isCodeVerifyOpen} code={uiState.verifyCodeInput} result={uiState.codeVerifyResult} checking={uiState.isActionBusy('code-check')} redeeming={uiState.isActionBusy('code-redeem')} onClose={uiState.closeCodeVerifyModal} onCodeChange={uiState.setVerifyCodeInput} onCheck={donationActions.checkRedemptionCode} onRedeem={donationActions.redeemVerifiedCode} /><CodeDetailsModal record={uiState.codeViewTarget} isOpen={uiState.codeViewTarget !== null} onClose={() => uiState.setCodeViewTarget(null)} /></>

  return (
    <AdminPageShell section="food" {...pageMeta}>
      {sections.map(({ id, title, description, content }) => <ManagementSection key={id} id={id} title={title} description={description}>{content}</ManagementSection>)}
      <div className={`modal-overlay${uiState.isAnyInlineEditorOpen ? ' visible' : ''}`} id="global-modal-overlay" onClick={uiState.closeAllInlineEditors} />
      {editorModals}
      {confirmDetailModals}
      <div className={`action-toast${uiState.isToastVisible ? ' show' : ''}`} id="action-toast">{uiState.toastMessage}</div>
    </AdminPageShell>
  )
}
