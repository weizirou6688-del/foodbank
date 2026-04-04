import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import foodManagementReferenceHtml from 'virtual:food-management-reference'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'
import {
  adminAPI,
  applicationsAPI,
  type AdminApplicationRecord,
  type AdminInventoryItemRecord,
  type FoodPackageContentRecord,
  type FoodPackageDetailRecord,
  foodBanksAPI,
} from '@/shared/lib/api'
import type { DonationListRow } from '@/shared/types/common'

interface Props {
  onSwitch?: (s: 'statistics' | 'food') => void
}

const referenceHtmlWithoutScripts = foodManagementReferenceHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
const referenceScript = Array.from(
  foodManagementReferenceHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
)
  .map((match) => match[1].trim())
  .filter(Boolean)
  .join('\n')

const roleLabelMap = {
  admin: 'Admin',
  supermarket: 'Supermarket',
  public: 'Account',
} as const

const donorTypeLabelMap = {
  supermarket: 'Supermarket',
  individual: 'Individual',
  organization: 'Organization',
} as const

const packageCategoryOptions = [
  'Pantry & Spices',
  'Breakfast',
  'Lunchbox',
  'Family Bundle',
  'Emergency Pack',
] as const

const packageDescriptionFallbacks: Record<(typeof packageCategoryOptions)[number], string> = {
  'Pantry & Spices': 'Core pantry staples suitable for daily household support.',
  Breakfast: 'Breakfast essentials prepared for quick and balanced mornings.',
  Lunchbox: 'Flexible midday items suitable for individuals and family pickups.',
  'Family Bundle': 'Balanced nutrition support designed for larger households.',
  'Emergency Pack': 'Fast-response essentials for urgent short-term food support.',
}

const inventoryCategoryOptions = [
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

interface PackageDraftRow {
  item_id: number
  quantity: number
}

interface InventoryDraft {
  name: string
  category: string
  unit: string
  threshold: number
}

interface InventoryLotRecord {
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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const normalizeLooseText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const formatIsoDate = (value?: string | null): string => (value ? value.slice(0, 10) : '-')

const formatMoney = (amountPence?: number): string =>
  `${'\u00A3'}${((amountPence ?? 0) / 100).toFixed(2)}`

const normalizeRedemptionCode = (value: string): string => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`
  }
  if (/^[A-Z]{2}\d{8}$/.test(compact)) {
    return compact
  }
  return value.trim().toUpperCase()
}

const inferDonationDonorType = (row: DonationListRow): keyof typeof donorTypeLabelMap => {
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

const donationStatusLabel = (status?: string): string => {
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

const buildDonationDisplayId = (row: DonationListRow): string => {
  const dateToken = formatIsoDate(row.pickup_date || row.created_at).replace(/-/g, '') || '00000000'
  return `D-${dateToken}-${row.id.slice(-4).toUpperCase()}`
}

const buildDonationTotalLabel = (row: DonationListRow): string => {
  if (row.donation_type === 'cash') {
    return formatMoney(row.amount_pence)
  }
  const total = (row.items ?? []).reduce((sum, item) => sum + item.quantity, 0)
  return String(total)
}

const getCodeStatusMeta = (record: AdminApplicationRecord): {
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

export default function AdminFoodManagementPreview({ onSwitch: _onSwitch }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)
  const [loginModal, setLoginModal] = useState<{ open: boolean; tab: 'signin' | 'register' }>({
    open: false,
    tab: 'signin',
  })

  useEffect(() => {
    document.title = 'Inventory Management - ABC Foodbank'
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }

    const syncIframe = () => {
      const doc = iframe.contentDocument
      if (!doc) {
        return
      }

      const frameWindow = doc.defaultView
      const isFrameHTMLElement = (value: Element | null | undefined): value is HTMLElement =>
        Boolean(frameWindow && value instanceof frameWindow.HTMLElement)
      const isFrameHTMLAnchorElement = (value: Element | null | undefined): value is HTMLAnchorElement =>
        Boolean(frameWindow && value instanceof frameWindow.HTMLAnchorElement)
      const scrollingElement = doc.scrollingElement ?? doc.documentElement
      const scrollFrameTo = (top: number, behavior: ScrollBehavior = 'smooth') => {
        if ('scrollTo' in scrollingElement) {
          scrollingElement.scrollTo({ top, behavior })
        }
        frameWindow?.scrollTo({ top, behavior })
        scrollingElement.scrollTop = top
      }
      const scrollToElement = (element: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
        const top = element.getBoundingClientRect().top + scrollingElement.scrollTop
        scrollFrameTo(top, behavior)
      }
      const getModalField = (
        container: ParentNode,
        labelText: string,
      ): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null => {
        const normalizeLabelText = (value: string): string =>
          value.replace(/\*/g, '').replace(/\s+/g, ' ').trim()
        const label = Array.from(container.querySelectorAll('.form-label')).find(
          (candidate) => normalizeLabelText(candidate.textContent ?? '') === labelText,
        )
        const parent = label?.parentElement
        if (!parent) {
          return null
        }
        return parent.querySelector('input, select, textarea')
      }

      if (referenceScript && doc.body && doc.body.dataset.foodManagementScriptInjected !== 'true') {
        const script = doc.createElement('script')
        script.type = 'text/javascript'
        script.text = `${referenceScript}\ndocument.dispatchEvent(new Event('DOMContentLoaded'));`
        doc.body.appendChild(script)
        doc.body.dataset.foodManagementScriptInjected = 'true'
      }

      if (!doc.getElementById('food-management-runtime-overrides')) {
        const style = doc.createElement('style')
        style.id = 'food-management-runtime-overrides'
        style.textContent = `
          .header-content {
            display: grid !important;
            grid-template-columns: 1fr auto 1fr !important;
            align-items: center !important;
          }

          .header-content nav {
            justify-self: center !important;
          }

          .header-content .logo {
            justify-self: start !important;
          }

          .header-content .header-actions {
            justify-self: end !important;
          }

          .record-header {
            max-width: 1000px;
            margin: 0 auto 12px auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
          }

          .record-header .record-title {
            margin: 0 !important;
          }
        `
        doc.head.appendChild(style)
      }

      if (!doc.getElementById('delete-package-confirm')) {
        const packageContainer = doc.querySelector('#package-management .container')
        if (packageContainer) {
          const confirm = doc.createElement('div')
          confirm.className = 'inline-confirm'
          confirm.id = 'delete-package-confirm'
          confirm.innerHTML = `
            <h3 class="confirm-title">Delete Food Package</h3>
            <p class="confirm-desc">Delete this package? This cannot be undone.</p>
            <div class="editor-actions" style="justify-content: center;">
              <button class="btn btn-secondary" data-confirm="delete-package-confirm">Cancel</button>
              <button class="btn btn-danger">Delete Package</button>
            </div>
          `
          packageContainer.appendChild(confirm)
        }
      }

      const ensureRecordHeaderButton = (
        titleText: string,
        buttonId: string,
        buttonText: string,
        buttonClassName: string,
        existingButton?: HTMLButtonElement | null,
      ) => {
        const title = Array.from(doc.querySelectorAll('.record-title')).find(
          (node) => node.textContent?.trim() === titleText,
        ) as HTMLElement | undefined
        if (!title) {
          return null
        }

        const currentParent = title.parentElement
        let header =
          currentParent?.classList.contains('record-header')
            ? currentParent
            : null

        if (!header) {
          header = doc.createElement('div')
          header.className = 'record-header'
          currentParent?.insertBefore(header, title)
          header.appendChild(title)
        }

        let button = existingButton
        if (!button) {
          button = doc.getElementById(buttonId) as HTMLButtonElement | null
        }
        if (!button) {
          button = doc.createElement('button')
          button.id = buttonId
          button.type = 'button'
          button.textContent = buttonText
        }
        button.className = buttonClassName
        if (!header.contains(button)) {
          header.appendChild(button)
        }
        return button
      }

      const donationHeaderExportButton = ensureRecordHeaderButton(
        'Donation Records',
        'export-donation-btn',
        'Export Excel',
        'btn btn-secondary btn-sm',
        doc.getElementById('export-donation-btn') as HTMLButtonElement | null,
      )
      const inventoryHeaderExportButton = ensureRecordHeaderButton(
        'Inventory Items',
        'export-inventory-btn',
        'Export Excel',
        'btn btn-secondary btn-sm',
      )
      const packageHeaderExportButton = ensureRecordHeaderButton(
        'Food Package Templates',
        'export-package-btn',
        'Export Excel',
        'btn btn-secondary btn-sm',
      )
      const lotHeaderExportButton = ensureRecordHeaderButton(
        'Lot Records',
        'export-lot-btn',
        'Export Excel',
        'btn btn-secondary btn-sm',
        doc.getElementById('export-lot-btn') as HTMLButtonElement | null,
      )
      const codeHeaderExportButton = ensureRecordHeaderButton(
        'Redemption Code Records',
        'export-code-btn',
        'Export Excel',
        'btn btn-secondary btn-sm',
        doc.getElementById('export-code-btn') as HTMLButtonElement | null,
      )

      const cleanupFns: Array<() => void> = []
      const bindClick = (selector: string, handler: (event: MouseEvent) => void) => {
        const element = doc.querySelector(selector)
        if (!isFrameHTMLElement(element)) {
          return
        }

        element.style.pointerEvents = 'auto'
        element.addEventListener('click', handler as EventListener)
        cleanupFns.push(() => element.removeEventListener('click', handler as EventListener))
      }
      const bindCaptureClick = (selector: string, handler: (event: MouseEvent) => void) => {
        const element = doc.querySelector(selector)
        if (!isFrameHTMLElement(element)) {
          return
        }

        element.addEventListener('click', handler as EventListener, true)
        cleanupFns.push(() => element.removeEventListener('click', handler as EventListener, true))
      }
      const actionToast = doc.getElementById('action-toast')
      let toastTimer: number | null = null
      const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
        if (!isFrameHTMLElement(actionToast)) {
          return
        }

        actionToast.textContent = message
        actionToast.style.background = tone === 'error' ? '#D32F2F' : '#1A1A1A'
        actionToast.style.color = '#FFFFFF'
        actionToast.classList.add('show')
        if (toastTimer) {
          frameWindow?.clearTimeout(toastTimer)
        }
        toastTimer = frameWindow?.setTimeout(() => {
          actionToast.classList.remove('show')
        }, 2400) ?? null
      }
      const modalOverlay = doc.getElementById('global-modal-overlay')
      const closeAllEditors = () => {
        doc.querySelectorAll('.inline-editor.visible, .inline-confirm.visible').forEach((element) => {
          element.classList.remove('visible')
        })
        modalOverlay?.classList.remove('visible')
        doc.body.classList.remove('modal-open')
      }
      const showEditor = (editorId: string) => {
        closeAllEditors()
        const target = doc.getElementById(editorId)
        if (!target) {
          return
        }
        target.classList.add('visible')
        modalOverlay?.classList.add('visible')
        doc.body.classList.add('modal-open')
      }
      const resetBatchControls = (
        selectAllId: string,
        countId: string,
        buttonIds: string[],
      ) => {
        const selectAll = doc.getElementById(selectAllId) as HTMLInputElement | null
        const count = doc.getElementById(countId)
        if (selectAll) {
          selectAll.checked = false
        }
        if (count) {
          count.textContent = '0 selected'
        }
        for (const buttonId of buttonIds) {
          const button = doc.getElementById(buttonId) as HTMLButtonElement | null
          if (button) {
            button.disabled = true
          }
        }
      }
      const selectedIdsFromTable = (tbodyId: string): string[] =>
        Array.from(doc.querySelectorAll(`#${tbodyId} .row-checkbox:checked`))
          .map((checkbox) => checkbox.closest('tr')?.getAttribute('data-id') || '')
          .filter(Boolean)
      const safeSearch = (value: string): string => value.trim().toLowerCase()

      const adminTag = doc.querySelector('.admin-tag')
      if (adminTag) {
        adminTag.textContent = user?.role ? roleLabelMap[user.role] : 'Guest'
      }

      const scrollTopButton = doc.getElementById('scroll-top-btn')
      const updateScrollTopButton = () => {
        if (!isFrameHTMLElement(scrollTopButton)) {
          return
        }

        scrollTopButton.classList.toggle('show', scrollingElement.scrollTop > 400)
      }
      updateScrollTopButton()
      frameWindow?.addEventListener('scroll', updateScrollTopButton)
      scrollingElement.addEventListener('scroll', updateScrollTopButton)
      cleanupFns.push(() => frameWindow?.removeEventListener('scroll', updateScrollTopButton))
      cleanupFns.push(() => scrollingElement.removeEventListener('scroll', updateScrollTopButton))

      if (isFrameHTMLElement(scrollTopButton)) {
        scrollTopButton.style.pointerEvents = 'auto'
        const handleScrollTopClick = (event: MouseEvent) => {
          event.preventDefault()
          scrollFrameTo(0)
          updateScrollTopButton()
        }
        scrollTopButton.addEventListener('click', handleScrollTopClick as EventListener)
        cleanupFns.push(() => scrollTopButton.removeEventListener('click', handleScrollTopClick as EventListener))
      }

      for (const anchor of Array.from(doc.querySelectorAll('.hero-buttons a[href^="#"]'))) {
        if (!isFrameHTMLAnchorElement(anchor)) {
          continue
        }

        const targetId = anchor.getAttribute('href')?.replace(/^#/, '')
        if (!targetId) {
          continue
        }

        const handleHeroAnchorClick = (event: MouseEvent) => {
          event.preventDefault()
          const target = doc.getElementById(targetId)
          if (!isFrameHTMLElement(target)) {
            return
          }

          scrollToElement(target)
          frameWindow?.history.replaceState(null, '', `#${targetId}`)
          updateScrollTopButton()
        }

        anchor.addEventListener('click', handleHeroAnchorClick as EventListener)
        cleanupFns.push(() => anchor.removeEventListener('click', handleHeroAnchorClick as EventListener))
      }

      const signOutButton = doc.querySelector('.header-actions .btn.btn-secondary')
      if (isFrameHTMLAnchorElement(signOutButton)) {
        signOutButton.href = '#'
        signOutButton.textContent = isAuthenticated ? 'Sign Out' : 'Sign In'
        signOutButton.target = ''
        signOutButton.rel = ''
        signOutButton.style.cursor = 'pointer'
      }

      bindCaptureClick('.header-actions .btn.btn-secondary', (event) => {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (isAuthenticated) {
          logout()
          setLoginModal({ open: false, tab: 'signin' })
          navigate('/home', { replace: true })
          return
        }

        setLoginModal({ open: true, tab: 'signin' })
      })

      const primaryNavLink = doc.querySelector('.nav-links li:first-child a')
      if (isFrameHTMLAnchorElement(primaryNavLink)) {
        primaryNavLink.href = '/admin?section=food'
      }
      bindClick('.nav-links li:first-child a', (event) => {
        event.preventDefault()
        navigate('/admin?section=food')
      })

      const statisticsNavLink = doc.querySelector('.nav-links li:nth-child(2) a')
      if (isFrameHTMLAnchorElement(statisticsNavLink)) {
        statisticsNavLink.href = '/admin?section=statistics'
      }
      bindClick('.nav-links li:nth-child(2) a', (event) => {
        event.preventDefault()
        navigate('/admin?section=statistics')
      })

      const footerRouteMap: Array<{ label: string; path: string }> = [
        { label: 'About Us', path: '/home#about' },
        { label: 'Get Support', path: '/find-foodbank' },
        { label: 'Donate Cash', path: '/donate/cash' },
        { label: 'Donate Goods', path: '/donate/goods' },
        { label: 'Inventory Management', path: '/admin?section=food' },
        { label: 'Data Dashboard', path: '/admin?section=statistics' },
        { label: 'Supermarket Restock', path: '/supermarket' },
      ]

      for (const { label, path } of footerRouteMap) {
        const anchor = Array.from(doc.querySelectorAll('.footer-links a')).find(
          (link) => link.textContent?.trim() === label,
        )

        if (!isFrameHTMLAnchorElement(anchor)) {
          continue
        }

        anchor.href = path
        const handleClick = (event: MouseEvent) => {
          event.preventDefault()
          navigate(path)
        }
        anchor.addEventListener('click', handleClick as EventListener)
        cleanupFns.push(() => anchor.removeEventListener('click', handleClick as EventListener))
      }

      if (isAuthenticated && accessToken) {
        let isCancelled = false
        let donations: DonationListRow[] = []
        let applications: AdminApplicationRecord[] = []
        let donationPage = 1
        let codePage = 1
        let pendingDeleteDonation: DonationListRow | null = null
        let pendingVoidApplication: AdminApplicationRecord | null = null
        let verifiedApplication: AdminApplicationRecord | null = null

        const donationPageSize = 5
        const codePageSize = 5
        const donationEditor = doc.getElementById('new-donation-editor')
        const verifyCodeEditor = doc.getElementById('verify-code-editor')
        const viewDonationEditor = doc.getElementById('view-donation-editor')
        const viewCodeEditor = doc.getElementById('view-code-editor')
        const deleteDonationConfirm = doc.getElementById('delete-donation-confirm')
        const voidCodeConfirm = doc.getElementById('void-code-confirm')
        const donationSearchInput = doc.querySelector(
          '#donation-intake .table-search-input',
        ) as HTMLInputElement | null
        const donationFilterSelects = Array.from(
          doc.querySelectorAll('#donation-intake .filter-group .filter-select'),
        ) as HTMLSelectElement[]
        const codeSearchInput = doc.querySelector(
          '#code-verification .table-search-input',
        ) as HTMLInputElement | null
        const verifyCodeInput = verifyCodeEditor
          ? (getModalField(verifyCodeEditor, 'Redemption Code') as HTMLInputElement | null)
          : null
        const donationItemTemplate = donationEditor?.querySelector('.donation-item-row')?.cloneNode(true) as HTMLElement | null
        const donationItemsAddButton = donationEditor?.querySelector('.add-item-btn')
        const donationSubmitButton = donationEditor?.querySelector('.editor-actions .btn.btn-primary')
        const deleteDonationConfirmButton = deleteDonationConfirm?.querySelector('.btn.btn-danger')
        const codeVerifyResult = doc.getElementById('code-verify-result')
        const redeemCodeButton = doc.getElementById('redeem-code-btn') as HTMLButtonElement | null
        const voidCodeConfirmButton = voidCodeConfirm?.querySelector('.btn.btn-danger')
        const donationTableBody = doc.getElementById('donation-table-body')
        const codeTableBody = doc.getElementById('code-table-body')
        const inventoryCardGrid = doc.getElementById('inventory-card-grid')
        const newItemButton = doc.getElementById('new-item-btn')
        const newItemEditor = doc.getElementById('new-item-editor')
        const editItemEditor = doc.getElementById('edit-item-editor')
        const stockInEditor = doc.getElementById('stock-in-editor')
        const deleteItemConfirm = doc.getElementById('delete-item-confirm')
        const inventorySearchInput = doc.querySelector(
          '#low-stock .table-search-input',
        ) as HTMLInputElement | null
        const inventoryCategoryFilter = doc.querySelector(
          '#low-stock .section-actions .filter-select',
        ) as HTMLSelectElement | null
        const newItemSubmitButton = newItemEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const editItemSubmitButton = editItemEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const stockInSubmitButton = stockInEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const deleteItemConfirmButton = deleteItemConfirm?.querySelector('.btn.btn-danger') as HTMLButtonElement | null
        const lotTableBody = doc.getElementById('lot-table-body')
        const lotSearchInput = doc.querySelector(
          '#expiry-tracking .table-search-input',
        ) as HTMLInputElement | null
        const lotFilterSelects = Array.from(
          doc.querySelectorAll('#expiry-tracking .section-actions .filter-select'),
        ) as HTMLSelectElement[]
        const editLotEditor = doc.getElementById('edit-lot-editor')
        const markWastedConfirm = doc.getElementById('mark-wasted-confirm')
        const deleteLotConfirm = doc.getElementById('delete-lot-confirm')
        const deletePackageConfirm = doc.getElementById('delete-package-confirm')
        const editLotSubmitButton = editLotEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const markWastedConfirmButton = markWastedConfirm?.querySelector('.btn.btn-danger') as HTMLButtonElement | null
        const deleteLotConfirmButton = deleteLotConfirm?.querySelector('.btn.btn-danger') as HTMLButtonElement | null
        const packageGrid = doc.getElementById('package-card-grid')
        const packageSearchInput = doc.querySelector(
          '#package-management .table-search-input',
        ) as HTMLInputElement | null
        const newPackageButton = doc.getElementById('new-package-btn')
        const newPackageEditor = doc.getElementById('new-package-editor')
        const editPackageEditor = doc.getElementById('edit-package-editor')
        const packingEditor = doc.getElementById('packing-editor')
        const newPackageTemplateRow = newPackageEditor?.querySelector('.package-item-row')?.cloneNode(true) as HTMLElement | null
        const editPackageTemplateRow = editPackageEditor?.querySelector('.package-item-row')?.cloneNode(true) as HTMLElement | null
        const newPackageSubmitButton = newPackageEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const editPackageSubmitButton = editPackageEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const packingSubmitButton = packingEditor?.querySelector('.editor-actions .btn.btn-primary') as HTMLButtonElement | null
        const packingPackageSelect = packingEditor
          ? (getModalField(packingEditor, 'Select Package') as HTMLSelectElement | null)
          : null
        const packingQuantityInput = packingEditor
          ? (getModalField(packingEditor, 'Pack Quantity') as HTMLInputElement | null)
          : null
        const packingStockCheck = packingEditor?.querySelector('.form-group + div') as HTMLElement | null
        const deletePackageConfirmButton = deletePackageConfirm?.querySelector('.btn.btn-danger') as HTMLButtonElement | null
        const exportDonationButton = (donationHeaderExportButton ?? doc.getElementById('export-donation-btn')) as HTMLButtonElement | null
        const exportInventoryButton = (inventoryHeaderExportButton ?? doc.getElementById('export-inventory-btn')) as HTMLButtonElement | null
        const exportPackageButton = (packageHeaderExportButton ?? doc.getElementById('export-package-btn')) as HTMLButtonElement | null
        const exportLotButton = (lotHeaderExportButton ?? doc.getElementById('export-lot-btn')) as HTMLButtonElement | null
        const exportCodeButton = (codeHeaderExportButton ?? doc.getElementById('export-code-btn')) as HTMLButtonElement | null
        const batchDeleteDonationsButton = doc.getElementById('batch-delete-donations') as HTMLButtonElement | null
        const batchReceiveDonationsButton = doc.getElementById('batch-receive-donations') as HTMLButtonElement | null

        let packageBankId: number | null = null
        let packageTemplates: FoodPackageDetailRecord[] = []
        let inventoryItems: AdminInventoryItemRecord[] = []
        let lotRecords: InventoryLotRecord[] = []
        let lotPage = 1
        let editingPackageId: number | null = null
        let packingPackageId: number | null = null
        let pendingDeletePackage: FoodPackageDetailRecord | null = null
        let editingItemId: number | null = null
        let stockInTargetId: number | null = null
        let pendingDeleteItem: AdminInventoryItemRecord | null = null
        let editingLotId: number | null = null
        let pendingWasteLot: InventoryLotRecord | null = null
        let pendingDeleteLot: InventoryLotRecord | null = null

        const getPackageById = (packageId: number | null | undefined): FoodPackageDetailRecord | null => {
          if (!packageId) {
            return null
          }
          return packageTemplates.find((entry) => entry.id === packageId) ?? null
        }

        const getInventoryItemById = (itemId: number): AdminInventoryItemRecord | null =>
          inventoryItems.find((entry) => entry.id === itemId) ?? null

        const buildPackageDescription = (pkg: FoodPackageDetailRecord): string => {
          const category = pkg.category as (typeof packageCategoryOptions)[number]
          return pkg.description?.trim() || packageDescriptionFallbacks[category] || 'Standard food support package.'
        }

        const setPackageCategoryOptions = (
          select: HTMLSelectElement | null,
          selectedCategory?: string | null,
        ) => {
          if (!select) {
            return
          }

          select.innerHTML = packageCategoryOptions
            .map(
              (category) =>
                `<option value="${escapeHtml(category)}"${category === selectedCategory ? ' selected' : ''}>${escapeHtml(category)}</option>`,
            )
            .join('')

          if (!selectedCategory && packageCategoryOptions.length > 0) {
            select.value = packageCategoryOptions[0]
          }
        }

        const setInventoryItemOptions = (
          select: HTMLSelectElement | null,
          selectedItemId?: number | null,
        ) => {
          if (!select) {
            return
          }

          const optionMarkup = inventoryItems
            .map(
              (item) =>
                `<option value="${item.id}"${item.id === selectedItemId ? ' selected' : ''}>${escapeHtml(item.name)}</option>`,
            )
            .join('')

          select.innerHTML = `<option value="">Select item</option>${optionMarkup}`

          if (selectedItemId && !inventoryItems.some((item) => item.id === selectedItemId)) {
            const missingOption = doc.createElement('option')
            missingOption.value = String(selectedItemId)
            missingOption.textContent = `Item #${selectedItemId}`
            missingOption.selected = true
            select.appendChild(missingOption)
          }

          if (selectedItemId) {
            select.value = String(selectedItemId)
          } else {
            select.value = ''
          }
        }

        const createPackageItemRow = (
          templateRow: HTMLElement | null,
          draft?: Partial<PackageDraftRow>,
        ): HTMLElement | null => {
          if (!templateRow) {
            return null
          }

          const row = templateRow.cloneNode(true) as HTMLElement
          const select = row.querySelector('select') as HTMLSelectElement | null
          const quantityInput = row.querySelector('input[type="number"]') as HTMLInputElement | null
          setInventoryItemOptions(select, draft?.item_id ?? null)
          if (quantityInput) {
            quantityInput.value = String(draft?.quantity && draft.quantity > 0 ? draft.quantity : 1)
          }
          return row
        }

        const setPackageItemRows = (
          editor: HTMLElement | null,
          templateRow: HTMLElement | null,
          drafts: PackageDraftRow[],
        ) => {
          if (!editor || !templateRow) {
            return
          }

          const addButton = editor.querySelector('.add-package-item-btn')
          if (!isFrameHTMLElement(addButton)) {
            return
          }

          editor.querySelectorAll('.package-item-row').forEach((row) => row.remove())
          const rowsToRender = drafts.length > 0 ? drafts : [{ item_id: 0, quantity: 1 }]
          rowsToRender.forEach((draft) => {
            const row = createPackageItemRow(templateRow, draft)
            if (row) {
              addButton.parentElement?.insertBefore(row, addButton)
            }
          })
        }

        const refreshPackageEditorSelects = (editor: HTMLElement | null) => {
          if (!editor) {
            return
          }

          editor.querySelectorAll('.package-item-row').forEach((row) => {
            const select = row.querySelector('select') as HTMLSelectElement | null
            const selectedItemId = Number(select?.value || '0')
            setInventoryItemOptions(select, selectedItemId > 0 ? selectedItemId : null)
          })
        }

        const readPackageEditorDraft = (editor: HTMLElement | null) => {
          if (!editor) {
            return { error: 'Package editor is unavailable.' } as const
          }

          const nameField = getModalField(editor, 'Package Name') as HTMLInputElement | null
          const categoryField = getModalField(editor, 'Category') as HTMLSelectElement | null
          const thresholdField = getModalField(editor, 'Safety Threshold') as HTMLInputElement | null

          const name = nameField?.value.trim() || ''
          const category = categoryField?.value.trim() || ''
          const threshold = Number(thresholdField?.value || '0')
          const contents = Array.from(editor.querySelectorAll('.package-item-row'))
            .map((row) => {
              const select = row.querySelector('select') as HTMLSelectElement | null
              const quantityInput = row.querySelector('input[type="number"]') as HTMLInputElement | null
              return {
                item_id: Number(select?.value || '0'),
                quantity: Number(quantityInput?.value || '0'),
              }
            })

          if (!name) {
            return { error: 'Package name is required.' } as const
          }
          if (!packageCategoryOptions.includes(category as (typeof packageCategoryOptions)[number])) {
            return { error: 'Choose a valid package category.' } as const
          }
          if (!Number.isFinite(threshold) || threshold < 0) {
            return { error: 'Safety Threshold must be 0 or more.' } as const
          }
          if (contents.length === 0) {
            return { error: 'Add at least one package content row.' } as const
          }
          if (contents.some((entry) => !Number.isFinite(entry.item_id) || entry.item_id <= 0)) {
            return { error: 'Select an inventory item for every package row.' } as const
          }
          if (contents.some((entry) => !Number.isFinite(entry.quantity) || entry.quantity <= 0)) {
            return { error: 'Package item quantity must be at least 1.' } as const
          }
          if (new Set(contents.map((entry) => entry.item_id)).size !== contents.length) {
            return { error: 'Each inventory item can only appear once in a package.' } as const
          }

          return {
            value: {
              name,
              category,
              threshold,
              contents,
            },
          } as const
        }

        const renderPackingStockCheck = () => {
          if (!packingStockCheck) {
            return
          }

          const selectedPackage = getPackageById(packingPackageId)
          const packQuantity = Math.max(1, Number(packingQuantityInput?.value || '1'))

          if (!selectedPackage) {
            packingStockCheck.innerHTML = `
              <p style="font-size: 14px; font-weight: 500; margin-bottom: var(--spacing-xs);">Package Contents & Stock Check</p>
              <p style="font-size: 13px;">Select a package to view required contents.</p>
            `
            return
          }

          const rows = selectedPackage.package_items.length > 0
            ? selectedPackage.package_items
                .map((item) => {
                  const inventoryItem = getInventoryItemById(item.inventory_item_id)
                  const available = Number(inventoryItem?.total_stock ?? inventoryItem?.stock ?? 0)
                  const required = item.quantity * packQuantity
                  const color = available >= required ? 'var(--color-text-dark)' : 'var(--color-error)'
                  const label = `${item.inventory_item_name}${item.inventory_item_unit ? ` (${item.inventory_item_unit})` : ''}`
                  return `<p style="font-size: 13px; margin-bottom: 2px; color: ${color};">${escapeHtml(label)}: ${escapeHtml(String(available))} available / ${escapeHtml(String(required))} required</p>`
                })
                .join('')
            : '<p style="font-size: 13px;">This package has no contents configured yet.</p>'

          packingStockCheck.innerHTML = `
            <p style="font-size: 14px; font-weight: 500; margin-bottom: var(--spacing-xs);">Package Contents & Stock Check</p>
            ${rows}
            <p style="font-size: 13px; margin-top: 8px; font-weight: 600;">Current packaged stock: ${escapeHtml(String(selectedPackage.stock))}</p>
          `
        }

        const syncPackingSelectOptions = () => {
          if (!packingPackageSelect) {
            return
          }

          packingPackageSelect.innerHTML = `
            <option value="">Select a package</option>
            ${packageTemplates
              .map(
                (pkg) =>
                  `<option value="${pkg.id}"${pkg.id === packingPackageId ? ' selected' : ''}>${escapeHtml(pkg.name)}</option>`,
              )
              .join('')}
          `

          if (packingPackageId) {
            packingPackageSelect.value = String(packingPackageId)
          }
        }

        const prepareNewPackageEditor = () => {
          if (!newPackageEditor) {
            return
          }

          editingPackageId = null
          const title = newPackageEditor.querySelector('.editor-title')
          const nameField = getModalField(newPackageEditor, 'Package Name') as HTMLInputElement | null
          const categoryField = getModalField(newPackageEditor, 'Category') as HTMLSelectElement | null
          const thresholdField = getModalField(newPackageEditor, 'Safety Threshold') as HTMLInputElement | null
          if (title) {
            title.textContent = 'Add New Package'
          }
          if (nameField) {
            nameField.value = ''
          }
          setPackageCategoryOptions(categoryField, packageCategoryOptions[0])
          if (thresholdField) {
            thresholdField.value = '0'
          }
          setPackageItemRows(newPackageEditor, newPackageTemplateRow, [])
        }

        const prepareEditPackageEditor = (pkg: FoodPackageDetailRecord) => {
          if (!editPackageEditor) {
            return
          }

          editingPackageId = pkg.id
          editPackageEditor.setAttribute('data-package-id', String(pkg.id))
          const title = editPackageEditor.querySelector('.editor-title')
          const nameField = getModalField(editPackageEditor, 'Package Name') as HTMLInputElement | null
          const categoryField = getModalField(editPackageEditor, 'Category') as HTMLSelectElement | null
          const thresholdField = getModalField(editPackageEditor, 'Safety Threshold') as HTMLInputElement | null
          if (title) {
            title.textContent = 'Edit Package'
          }
          if (nameField) {
            nameField.value = pkg.name
          }
          setPackageCategoryOptions(categoryField, pkg.category)
          if (thresholdField) {
            thresholdField.value = String(pkg.threshold)
          }
          setPackageItemRows(
            editPackageEditor,
            editPackageTemplateRow,
            pkg.package_items.map((item) => ({
              item_id: item.inventory_item_id,
              quantity: item.quantity,
            })),
          )
        }

        const preparePackingEditor = (packageId?: number | null) => {
          if (!packingEditor) {
            return
          }

          const nextPackageId = packageId ?? packingPackageId ?? packageTemplates[0]?.id ?? null
          packingPackageId = nextPackageId
          syncPackingSelectOptions()
          if (packingPackageSelect && nextPackageId) {
            packingPackageSelect.value = String(nextPackageId)
          }
          if (packingQuantityInput) {
            packingQuantityInput.value = '1'
          }
          renderPackingStockCheck()
        }

        const prepareDeletePackageConfirm = (pkg: FoodPackageDetailRecord) => {
          pendingDeletePackage = pkg
          const description = deletePackageConfirm?.querySelector('.confirm-desc')
          if (description) {
            description.textContent = `Delete ${pkg.name}? This cannot be undone.`
          }
        }

        const renderPackageGrid = () => {
          if (!packageGrid) {
            return
          }

          const filteredPackages = getFilteredPackages()

          if (filteredPackages.length === 0) {
            packageGrid.innerHTML = `
              <div class="card">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">No food packages found</h3>
                <p style="color: var(--color-text-light); font-size: 13px; margin-bottom: var(--spacing-sm);">Adjust your search or create a new package.</p>
              </div>
            `
            return
          }

          packageGrid.innerHTML = filteredPackages
            .map((pkg) => {
              const itemMarkup = pkg.package_items.length > 0
                ? pkg.package_items
                    .map((item) => `
                      <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
                        <span>${escapeHtml(item.inventory_item_name)}</span>
                        <span>x${escapeHtml(String(item.quantity))}</span>
                      </div>
                    `)
                    .join('')
                : '<div style="font-size: 14px; color: var(--color-text-light);">No contents configured</div>'

              return `
                <div class="card" data-package-id="${pkg.id}">
                  <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${escapeHtml(pkg.name)}</h3>
                  <p style="color: var(--color-text-light); font-size: 13px; margin-bottom: var(--spacing-sm);">${escapeHtml(buildPackageDescription(pkg))}</p>
                  <div style="margin-bottom: var(--spacing-sm);">
                    ${itemMarkup}
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--color-text-light); margin-bottom: var(--spacing-sm);">
                    <span>Pack stock: ${escapeHtml(String(pkg.stock))}</span>
                    <span>Threshold: ${escapeHtml(String(pkg.threshold))}</span>
                  </div>
                  <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm packing-btn" data-package-id="${pkg.id}">Packing</button>
                    <button class="btn btn-secondary btn-sm edit-package-btn" data-package-id="${pkg.id}">Edit</button>
                    <button class="btn btn-danger btn-sm delete-package-btn" data-package-id="${pkg.id}">Delete</button>
                  </div>
                </div>
              `
            })
            .join('')
        }

        const getFilteredDonations = (): DonationListRow[] => {
          const donorTypeFilter = donationFilterSelects[0]?.value ?? ''
          const statusFilter = donationFilterSelects[1]?.value ?? ''
          const keyword = safeSearch(donationSearchInput?.value ?? '')

          return donations.filter((row) => {
            const donorType = inferDonationDonorType(row)
            if (donorTypeFilter && donorType !== donorTypeFilter) {
              return false
            }
            if (statusFilter && (row.status ?? 'pending') !== statusFilter) {
              return false
            }
            if (!keyword) {
              return true
            }
            const haystack = [
              buildDonationDisplayId(row),
              row.donor_name ?? '',
              row.donor_email ?? '',
              row.notes ?? '',
              donorTypeLabelMap[donorType],
              donationStatusLabel(row.status),
            ]
              .join(' ')
              .toLowerCase()
            return haystack.includes(keyword)
          })
        }

        const getFilteredLots = (): InventoryLotRecord[] => {
          const keyword = safeSearch(lotSearchInput?.value ?? '')
          const categoryFilter = lotFilterSelects[0]?.value?.trim() || ''
          const statusFilter = lotFilterSelects[1]?.value?.trim() || ''

          return lotRecords.filter((lot) => {
            const item = getInventoryRecordById(lot.inventory_item_id)
            const displayStatus = getLotDisplayStatus(lot).label.toLowerCase()

            if (categoryFilter && item?.category !== categoryFilter) {
              return false
            }

            if (statusFilter) {
              if (statusFilter === 'Expiring Soon' && !isExpiringSoon(lot)) {
                return false
              }
              if (statusFilter !== 'Expiring Soon' && displayStatus !== statusFilter.toLowerCase()) {
                return false
              }
            }

            if (!keyword) {
              return true
            }

            return [
              lot.item_name,
              getLotReference(lot),
              formatIsoDate(lot.received_date),
              formatIsoDate(lot.expiry_date),
              displayStatus,
            ]
              .join(' ')
              .toLowerCase()
              .includes(keyword)
          })
        }

        const getFilteredInventoryItems = (): AdminInventoryItemRecord[] => {
          const categoryFilter = inventoryCategoryFilter?.value?.trim() || ''
          const keyword = safeSearch(inventorySearchInput?.value ?? '')
          return inventoryItems.filter((item) => {
            if (categoryFilter && item.category !== categoryFilter) {
              return false
            }
            if (!keyword) {
              return true
            }
            return [item.name, item.category, item.unit]
              .join(' ')
              .toLowerCase()
              .includes(keyword)
          })
        }

        const getFilteredPackages = (): FoodPackageDetailRecord[] => {
          const keyword = safeSearch(packageSearchInput?.value ?? '')
          return packageTemplates.filter((pkg) => {
            if (!keyword) {
              return true
            }
            const contents = pkg.package_items
              .map((item) => `${item.inventory_item_name} x${item.quantity}`)
              .join(' ')
            return [pkg.name, pkg.category, buildPackageDescription(pkg), contents]
              .join(' ')
              .toLowerCase()
              .includes(keyword)
          })
        }

        const getFilteredCodes = (): AdminApplicationRecord[] => {
          const keyword = safeSearch(codeSearchInput?.value ?? '')
          return applications.filter((record) => {
            if (!keyword) {
              return true
            }
            const statusMeta = getCodeStatusMeta(record)
            const haystack = [
              record.redemption_code,
              record.package_name ?? '',
              statusMeta.label,
              formatIsoDate(record.created_at),
              formatIsoDate(record.redeemed_at),
            ]
              .join(' ')
              .toLowerCase()
            return haystack.includes(keyword)
          })
        }

        let xlsxModulePromise: Promise<typeof import('xlsx')> | null = null
        const loadXlsx = () => {
          if (!xlsxModulePromise) {
            xlsxModulePromise = import('xlsx')
          }
          return xlsxModulePromise
        }

        const exportRowsAsWorkbook = async (
          filename: string,
          sheetName: string,
          rows: Array<Record<string, string | number | null>>,
        ) => {
          if (rows.length === 0) {
            showToast('No rows are available to export.', 'error')
            return
          }

          const XLSX = await loadXlsx()
          const worksheet = XLSX.utils.json_to_sheet(rows)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
          XLSX.writeFile(workbook, filename)
        }

        const reloadPackageData = async () => {
          try {
            const [foodBankResponse, inventoryResponse, lotResponse] = await Promise.all([
              foodBanksAPI.getFoodBanks(),
              adminAPI.getInventoryItems(accessToken),
              adminAPI.getInventoryLots(accessToken, true),
            ])

            const bankIds = (Array.isArray(foodBankResponse.items) ? foodBankResponse.items : [])
              .map((bank) => Number(bank.id))
              .filter((bankId) => Number.isFinite(bankId) && bankId > 0)

            const packageLists = await Promise.all(
              bankIds.map(async (bankId) => {
                try {
                  return await adminAPI.listFoodBankPackages(bankId, accessToken)
                } catch {
                  return []
                }
              }),
            )

            const summaries = Array.from(
              new Map(
                packageLists
                  .flat()
                  .map((pkg) => [Number(pkg.id), pkg] as const),
              ).values(),
            )

            const packageDetails = await Promise.all(
              summaries.map(async (pkg) => {
                try {
                  return await adminAPI.getFoodPackageDetail(pkg.id, accessToken)
                } catch {
                  return {
                    ...pkg,
                    package_items: [],
                  } as FoodPackageDetailRecord
                }
              }),
            )

            if (isCancelled) {
              return
            }

            inventoryItems = Array.isArray(inventoryResponse.items)
              ? inventoryResponse.items.map((item) => ({
                  ...item,
                  id: Number(item.id),
                  stock: Number(item.stock ?? 0),
                  total_stock: Number(item.total_stock ?? item.stock ?? 0),
                  threshold: Number(item.threshold ?? 0),
                }))
              : []
            lotRecords = Array.isArray(lotResponse)
              ? lotResponse.map((lot) => ({
                  ...lot,
                  id: Number(lot.id),
                  inventory_item_id: Number(lot.inventory_item_id),
                  quantity: Number(lot.quantity ?? 0),
                  expiry_date: formatIsoDate(String(lot.expiry_date)),
                  received_date: formatIsoDate(String(lot.received_date)),
                }))
              : []
            packageTemplates = packageDetails
              .map((pkg) => ({
                ...pkg,
                id: Number(pkg.id),
                stock: Number(pkg.stock ?? 0),
                threshold: Number(pkg.threshold ?? 0),
                applied_count: Number(pkg.applied_count ?? 0),
                food_bank_id: pkg.food_bank_id == null ? null : Number(pkg.food_bank_id),
                package_items: Array.isArray(pkg.package_items)
                  ? pkg.package_items.map((item: FoodPackageContentRecord) => ({
                      ...item,
                      id: Number(item.id),
                      inventory_item_id: Number(item.inventory_item_id),
                      quantity: Number(item.quantity),
                    }))
                  : [],
              }))
              .sort((left, right) => left.id - right.id)
            packageBankId = packageTemplates[0]?.food_bank_id ?? bankIds[0] ?? null

            const newPackageCategoryField = newPackageEditor
              ? (getModalField(newPackageEditor, 'Category') as HTMLSelectElement | null)
              : null
            const editPackageCategoryField = editPackageEditor
              ? (getModalField(editPackageEditor, 'Category') as HTMLSelectElement | null)
              : null
            const newItemCategoryField = newItemEditor
              ? (getModalField(newItemEditor, 'Category') as HTMLSelectElement | null)
              : null
            const editItemCategoryField = editItemEditor
              ? (getModalField(editItemEditor, 'Category') as HTMLSelectElement | null)
              : null
            setPackageCategoryOptions(newPackageCategoryField, newPackageCategoryField?.value || packageCategoryOptions[0])
            setPackageCategoryOptions(editPackageCategoryField, editPackageCategoryField?.value || packageCategoryOptions[0])
            setInventoryCategoryOptions(inventoryCategoryFilter, { includeAll: true, selected: inventoryCategoryFilter?.value || '' })
            setInventoryCategoryOptions(newItemCategoryField, { selected: newItemCategoryField?.value || inventoryCategoryOptions[0] })
            setInventoryCategoryOptions(editItemCategoryField, { selected: editItemCategoryField?.value || inventoryCategoryOptions[0] })
            if (lotFilterSelects[0]) {
              setInventoryCategoryOptions(lotFilterSelects[0], {
                includeAll: true,
                selected: lotFilterSelects[0].value || '',
              })
            }
            if (lotFilterSelects[1]) {
              const selectedStatus = lotFilterSelects[1].value || ''
              lotFilterSelects[1].innerHTML = `
                <option value="">All Status</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
                <option value="Active">Active</option>
                <option value="Wasted">Wasted</option>
              `
              lotFilterSelects[1].value = selectedStatus
            }
            refreshPackageEditorSelects(newPackageEditor)
            refreshPackageEditorSelects(editPackageEditor)
            syncPackingSelectOptions()
            renderPackingStockCheck()
            renderPackageGrid()
            renderInventoryGrid()
            renderLotTable(true)
          } catch (error) {
            if (isCancelled) {
              return
            }
            showToast(error instanceof Error ? error.message : 'Failed to load management data', 'error')
          }
        }

        const bindPackageEditorRowActions = (
          editor: HTMLElement | null,
          templateRow: HTMLElement | null,
        ) => {
          if (!editor) {
            return
          }

          const handleEditorClick = (event: Event) => {
            const target = event.target as Element | null
            const addButton = target?.closest('.add-package-item-btn')
            if (addButton) {
              event.preventDefault()
              event.stopImmediatePropagation()
              const row = createPackageItemRow(templateRow, { quantity: 1 })
              if (row && addButton.parentElement) {
                addButton.parentElement.insertBefore(row, addButton)
              }
              return
            }

            const removeButton = target?.closest('.remove-package-item-btn')
            if (!removeButton) {
              return
            }

            event.preventDefault()
            event.stopImmediatePropagation()
            const currentRow = removeButton.closest('.package-item-row')
            const rows = Array.from(editor.querySelectorAll('.package-item-row'))
            if (rows.length <= 1) {
              const select = currentRow?.querySelector('select') as HTMLSelectElement | null
              const quantityInput = currentRow?.querySelector('input[type="number"]') as HTMLInputElement | null
              setInventoryItemOptions(select, null)
              if (quantityInput) {
                quantityInput.value = '1'
              }
              return
            }
            currentRow?.remove()
          }

          editor.addEventListener('click', handleEditorClick, true)
          cleanupFns.push(() => editor.removeEventListener('click', handleEditorClick, true))
        }

        const getInventoryRecordById = (itemId: number | null | undefined): AdminInventoryItemRecord | null => {
          if (!itemId) {
            return null
          }
          return inventoryItems.find((entry) => entry.id === itemId) ?? null
        }

        const getLotRecordById = (lotId: number | null | undefined): InventoryLotRecord | null => {
          if (!lotId) {
            return null
          }
          return lotRecords.find((entry) => entry.id === lotId) ?? null
        }

        const isExpiringSoon = (lot: InventoryLotRecord): boolean => {
          if (lot.status !== 'active') {
            return false
          }
          const now = new Date()
          const expiry = new Date(lot.expiry_date)
          const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return diffDays >= 0 && diffDays <= 14
        }

        const getLotDisplayStatus = (lot: InventoryLotRecord): {
          label: string
          color: string
        } => {
          if (lot.status === 'wasted') {
            return { label: 'Wasted', color: 'var(--color-error)' }
          }
          if (lot.status === 'expired') {
            return { label: 'Expired', color: 'var(--color-error)' }
          }
          if (isExpiringSoon(lot)) {
            return { label: 'Expiring Soon', color: 'var(--color-warning)' }
          }
          return { label: 'Active', color: 'var(--color-text-dark)' }
        }

        const getLotReference = (lot: InventoryLotRecord): string =>
          lot.batch_reference?.trim() || `LOT-${String(lot.id).padStart(4, '0')}`

        const setInventoryCategoryOptions = (
          select: HTMLSelectElement | null,
          options?: {
            includeAll?: boolean
            selected?: string | null
          },
        ) => {
          if (!select) {
            return
          }

          const optionMarkup = inventoryCategoryOptions
            .map(
              (category) =>
                `<option value="${escapeHtml(category)}"${category === options?.selected ? ' selected' : ''}>${escapeHtml(category)}</option>`,
            )
            .join('')

          select.innerHTML = options?.includeAll
            ? `<option value="">All Categories</option>${optionMarkup}`
            : optionMarkup

          if (options?.selected) {
            select.value = options.selected
          } else if (options?.includeAll) {
            select.value = ''
          } else if (inventoryCategoryOptions.length > 0) {
            select.value = inventoryCategoryOptions[0]
          }
        }

        const readInventoryEditorDraft = (editor: HTMLElement | null) => {
          if (!editor) {
            return { error: 'Inventory editor is unavailable.' } as const
          }

          const nameField = getModalField(editor, 'Item Name') as HTMLInputElement | null
          const categoryField = getModalField(editor, 'Category') as HTMLSelectElement | null
          const unitField = getModalField(editor, 'Unit') as HTMLInputElement | null
          const thresholdField = getModalField(editor, 'Safety Threshold') as HTMLInputElement | null

          const name = nameField?.value.trim() || ''
          const category = categoryField?.value.trim() || ''
          const unit = unitField?.value.trim() || ''
          const threshold = Number(thresholdField?.value || '0')

          if (!name) {
            return { error: 'Item name is required.' } as const
          }
          if (!inventoryCategoryOptions.includes(category as (typeof inventoryCategoryOptions)[number])) {
            return { error: 'Choose a valid item category.' } as const
          }
          if (!unit) {
            return { error: 'Unit is required.' } as const
          }
          if (!Number.isFinite(threshold) || threshold < 0) {
            return { error: 'Safety Threshold must be 0 or more.' } as const
          }

          return {
            value: {
              name,
              category,
              unit,
              threshold,
            } satisfies InventoryDraft,
          } as const
        }

        const prepareNewItemEditor = () => {
          if (!newItemEditor) {
            return
          }

          editingItemId = null
          const nameField = getModalField(newItemEditor, 'Item Name') as HTMLInputElement | null
          const categoryField = getModalField(newItemEditor, 'Category') as HTMLSelectElement | null
          const unitField = getModalField(newItemEditor, 'Unit') as HTMLInputElement | null
          const thresholdField = getModalField(newItemEditor, 'Safety Threshold') as HTMLInputElement | null
          if (nameField) {
            nameField.value = ''
          }
          setInventoryCategoryOptions(categoryField, { selected: inventoryCategoryOptions[0] })
          if (unitField) {
            unitField.value = ''
          }
          if (thresholdField) {
            thresholdField.value = '0'
          }
        }

        const prepareEditItemEditor = (item: AdminInventoryItemRecord) => {
          if (!editItemEditor) {
            return
          }

          editingItemId = item.id
          editItemEditor.setAttribute('data-item-id', String(item.id))
          const nameField = getModalField(editItemEditor, 'Item Name') as HTMLInputElement | null
          const categoryField = getModalField(editItemEditor, 'Category') as HTMLSelectElement | null
          const unitField = getModalField(editItemEditor, 'Unit') as HTMLInputElement | null
          const thresholdField = getModalField(editItemEditor, 'Safety Threshold') as HTMLInputElement | null
          if (nameField) {
            nameField.value = item.name
          }
          setInventoryCategoryOptions(categoryField, { selected: item.category })
          if (unitField) {
            unitField.value = item.unit
          }
          if (thresholdField) {
            thresholdField.value = String(item.threshold)
          }
        }

        const prepareStockInEditor = (item: AdminInventoryItemRecord) => {
          if (!stockInEditor) {
            return
          }

          stockInTargetId = item.id
          stockInEditor.setAttribute('data-item-id', String(item.id))
          const nameField = getModalField(stockInEditor, 'Item Name') as HTMLInputElement | null
          const quantityField = getModalField(stockInEditor, 'Quantity') as HTMLInputElement | null
          const expiryField = getModalField(stockInEditor, 'Expiry Date') as HTMLInputElement | null
          if (nameField) {
            nameField.value = item.name
          }
          if (quantityField) {
            quantityField.value = '1'
          }
          if (expiryField) {
            expiryField.value = ''
          }
        }

        const prepareDeleteItemConfirm = (item: AdminInventoryItemRecord) => {
          pendingDeleteItem = item
          const description = deleteItemConfirm?.querySelector('.confirm-desc')
          if (description) {
            description.textContent = `Delete ${item.name}? This cannot be undone.`
          }
        }

        const renderInventoryGrid = () => {
          if (!inventoryCardGrid) {
            return
          }

          const filteredItems = getFilteredInventoryItems()

          if (filteredItems.length === 0) {
            inventoryCardGrid.innerHTML = `
              <div class="card">
                <h4>No inventory items found</h4>
                <p>Adjust your search or create a new item.</p>
              </div>
            `
            return
          }

          inventoryCardGrid.innerHTML = filteredItems
            .map((item) => {
              const deficit = Math.max(item.threshold - item.total_stock, 0)
              const lowStockNotice = deficit > 0
                ? '<span class="low-stock-notice">Stock is below the safety threshold and needs replenishment.</span>'
                : ''
              return `
                <div class="card${deficit > 0 ? ' card-error' : ''}" data-item-id="${item.id}">
                  <h4>${escapeHtml(item.name)}</h4>
                  <p><strong>Current Stock:</strong> ${escapeHtml(String(item.total_stock))} ${escapeHtml(item.unit)}</p>
                  <p><strong>Safety Threshold:</strong> ${escapeHtml(String(item.threshold))} ${escapeHtml(item.unit)}</p>
                  <p><strong>Deficit:</strong> ${escapeHtml(String(deficit))}</p>
                  ${lowStockNotice}
                  <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-sm edit-item-btn" data-item-id="${item.id}">Edit</button>
                    <button class="btn btn-primary btn-sm stock-in-btn" data-item-id="${item.id}">+ Stock</button>
                    <button class="btn btn-danger btn-sm delete-item-btn" data-item-id="${item.id}">Delete</button>
                  </div>
                </div>
              `
            })
            .join('')
        }

        const renderLotTable = (resetPage = false) => {
          if (!lotTableBody) {
            return
          }

          if (resetPage) {
            lotPage = 1
          }

          const filteredLots = getFilteredLots()

          const pageSize = 5
          const totalPages = Math.max(1, Math.ceil(filteredLots.length / pageSize))
          lotPage = Math.min(lotPage, totalPages)
          const pageItems = filteredLots.slice((lotPage - 1) * pageSize, lotPage * pageSize)

          lotTableBody.innerHTML =
            pageItems.length > 0
              ? pageItems
                  .map((lot) => {
                    const statusMeta = getLotDisplayStatus(lot)
                    const canEdit = lot.status !== 'wasted'
                    const actions = [
                      canEdit
                        ? `<button class="btn btn-sm btn-secondary edit-lot-btn" data-lot-id="${lot.id}">Edit</button>`
                        : '',
                      lot.status === 'active'
                        ? `<button class="btn btn-sm btn-danger mark-wasted-btn" data-lot-id="${lot.id}">Mark Wasted</button>`
                        : '',
                      lot.status !== 'active'
                        ? `<button class="btn btn-sm btn-danger delete-lot-btn" data-lot-id="${lot.id}">Delete</button>`
                        : '',
                    ]
                      .filter(Boolean)
                      .join('')

                    return `
                      <tr data-id="${lot.id}">
                        <td><input type="checkbox" class="row-checkbox"></td>
                        <td>${escapeHtml(lot.item_name)}</td>
                        <td>${escapeHtml(getLotReference(lot))}</td>
                        <td>${escapeHtml(formatIsoDate(lot.received_date))}</td>
                        <td>${escapeHtml(formatIsoDate(lot.expiry_date))}</td>
                        <td>${escapeHtml(String(lot.quantity))}</td>
                        <td style="color: ${statusMeta.color}; font-weight: 600;">${escapeHtml(statusMeta.label)}</td>
                        <td><div class="table-actions">${actions}</div></td>
                      </tr>
                    `
                  })
                  .join('')
              : `
                  <tr>
                    <td colspan="8" style="text-align: center; color: var(--color-text-light);">No lot records found.</td>
                  </tr>
                `

          resetBatchControls('select-all-lots', 'lot-selected-count', ['batch-waste-lots', 'batch-delete-lots'])
          renderPagination('lot-pagination', lotPage, totalPages, (page) => {
            lotPage = page
            renderLotTable()
          })
        }

        const prepareEditLotEditor = (lot: InventoryLotRecord) => {
          if (!editLotEditor) {
            return
          }

          editingLotId = lot.id
          editLotEditor.setAttribute('data-lot-id', String(lot.id))
          const itemField = getModalField(editLotEditor, 'Item Name') as HTMLInputElement | null
          const lotField = getModalField(editLotEditor, 'Lot Number') as HTMLInputElement | null
          const stockField = getModalField(editLotEditor, 'Remaining Stock') as HTMLInputElement | null
          const expiryField = getModalField(editLotEditor, 'Expiry Date') as HTMLInputElement | null
          if (itemField) {
            itemField.value = lot.item_name
          }
          if (lotField) {
            lotField.value = getLotReference(lot)
          }
          if (stockField) {
            stockField.value = String(lot.quantity)
          }
          if (expiryField) {
            expiryField.value = formatIsoDate(lot.expiry_date)
          }
        }

        const prepareMarkWastedConfirm = (lot: InventoryLotRecord) => {
          pendingWasteLot = lot
          const description = markWastedConfirm?.querySelector('.confirm-desc')
          if (description) {
            description.textContent = `Mark lot ${getLotReference(lot)} as wasted? This will deduct the remaining stock from inventory, and cannot be undone.`
          }
        }

        const prepareDeleteLotConfirm = (lot: InventoryLotRecord) => {
          pendingDeleteLot = lot
          const description = deleteLotConfirm?.querySelector('.confirm-desc')
          if (description) {
            description.textContent = `Delete expired lot ${getLotReference(lot)}? This cannot be undone.`
          }
        }

        const renderPagination = (
          containerId: string,
          currentPage: number,
          totalPages: number,
          onSelect: (page: number) => void,
        ) => {
          const container = doc.getElementById(containerId)
          if (!container) {
            return
          }

          const compactPages = (() => {
            if (totalPages <= 5) {
              return Array.from({ length: totalPages }, (_, index) => index + 1)
            }

            const pages = new Set<number>([1, totalPages, currentPage])
            for (let offset = -1; offset <= 1; offset += 1) {
              const candidate = currentPage + offset
              if (candidate >= 1 && candidate <= totalPages) {
                pages.add(candidate)
              }
            }

            return Array.from(pages).sort((left, right) => left - right)
          })()

          const paginationPagesMarkup = compactPages
            .map((page, index) => {
              const previousPage = compactPages[index - 1]
              const gapMarkup = previousPage && page - previousPage > 1
                ? '<span class="page-btn page-ellipsis" aria-hidden="true">...</span>'
                : ''

              return `${gapMarkup}<button class="page-btn page-num${page === currentPage ? ' active' : ''}" data-page-number="${page}">${page}</button>`
            })
            .join('')

          container.innerHTML = `
            <button class="page-btn page-nav" data-page-action="prev" ${currentPage <= 1 ? 'disabled' : ''}>
              <span class="page-btn-arrow">&#8249;</span><span class="page-btn-label">Previous</span>
            </button>
            <div class="pagination-pages">
              ${paginationPagesMarkup}
            </div>
            <button class="page-btn page-nav" data-page-action="next" ${currentPage >= totalPages ? 'disabled' : ''}>
              <span class="page-btn-label">Next</span><span class="page-btn-arrow">&#8250;</span>
            </button>
          `

          const handlePaginationClick = (event: Event) => {
            const target = event.target as Element | null
            const pageButton = target?.closest('[data-page-number]') as HTMLElement | null
            if (pageButton) {
              const page = Number(pageButton.getAttribute('data-page-number'))
              if (page >= 1 && page <= totalPages) {
                onSelect(page)
              }
              return
            }

            const navButton = target?.closest('[data-page-action]') as HTMLElement | null
            const action = navButton?.getAttribute('data-page-action')
            if (action === 'prev' && currentPage > 1) {
              onSelect(currentPage - 1)
            }
            if (action === 'next' && currentPage < totalPages) {
              onSelect(currentPage + 1)
            }
          }

          const paginationContainer = container as HTMLElement & {
            __paginationClickHandler?: EventListener
          }

          if (paginationContainer.__paginationClickHandler) {
            container.removeEventListener('click', paginationContainer.__paginationClickHandler)
          }

          paginationContainer.__paginationClickHandler = handlePaginationClick as EventListener
          container.addEventListener('click', paginationContainer.__paginationClickHandler)
          cleanupFns.push(() => {
            if (paginationContainer.__paginationClickHandler) {
              container.removeEventListener('click', paginationContainer.__paginationClickHandler)
              delete paginationContainer.__paginationClickHandler
            }
          })
        }

        const setDonationItemRows = (
          items: Array<{ item_name: string; quantity: number; expiry_date?: string | null }>,
        ) => {
          if (!donationEditor || !donationItemTemplate || !donationItemsAddButton) {
            return
          }

          donationEditor.querySelectorAll('.donation-item-row').forEach((row) => row.remove())
          const rowsToRender = items.length > 0 ? items : [{ item_name: '', quantity: 1, expiry_date: '' }]

          for (const item of rowsToRender) {
            const row = donationItemTemplate.cloneNode(true) as HTMLElement
            const select = row.querySelector('select') as HTMLSelectElement | null
            const quantityInput = row.querySelector('input[type="number"]') as HTMLInputElement | null
            const expiryInput = row.querySelector('input[type="text"]') as HTMLInputElement | null

            if (select) {
              const normalizedTarget = normalizeLooseText(item.item_name)
              const matchingOption = Array.from(select.options).find((option) => {
                const normalizedOption = normalizeLooseText(option.textContent || '')
                return (
                  normalizedOption === normalizedTarget ||
                  normalizedOption.startsWith(normalizedTarget) ||
                  normalizedTarget.startsWith(normalizedOption)
                )
              })

              if (item.item_name && !matchingOption) {
                const customOption = doc.createElement('option')
                customOption.value = `custom-${item.item_name}`
                customOption.textContent = item.item_name
                select.appendChild(customOption)
                select.value = customOption.value
              } else if (matchingOption) {
                select.value = matchingOption.value
              } else {
                select.value = ''
              }
            }

            if (quantityInput) {
              quantityInput.value = String(item.quantity || 1)
            }
            if (expiryInput) {
              expiryInput.value = item.expiry_date ? formatIsoDate(item.expiry_date) : ''
            }

            donationItemsAddButton.parentElement?.insertBefore(row, donationItemsAddButton)
          }
        }

        const prepareDonationEditor = (donation: DonationListRow | null) => {
          if (!donationEditor) {
            return
          }

          donationEditor.setAttribute('data-mode', donation ? 'edit' : 'create')
          donationEditor.setAttribute('data-donation-id', donation?.id ?? '')
          const donorTypeField = getModalField(donationEditor, 'Donor Type') as HTMLSelectElement | null
          const donorNameField = getModalField(donationEditor, 'Donor Name') as HTMLInputElement | null
          const contactEmailField = getModalField(donationEditor, 'Contact Email') as HTMLInputElement | null
          const receivedDateField = getModalField(donationEditor, 'Received Date') as HTMLInputElement | null

          if (donation) {
            donorTypeField && (donorTypeField.value = inferDonationDonorType(donation))
            donorNameField && (donorNameField.value = donation.donor_name ?? '')
            contactEmailField && (contactEmailField.value = donation.donor_email ?? '')
            receivedDateField &&
              (receivedDateField.value = formatIsoDate(donation.pickup_date || donation.created_at) || '')
            setDonationItemRows(
              donation.donation_type === 'cash'
                ? []
                : (donation.items ?? []).map((item) => ({
                    item_name: item.item_name,
                    quantity: item.quantity,
                    expiry_date: item.expiry_date,
                  })),
            )
          } else {
            donorTypeField && (donorTypeField.value = '')
            donorNameField && (donorNameField.value = '')
            contactEmailField && (contactEmailField.value = '')
            receivedDateField && (receivedDateField.value = new Date().toISOString().slice(0, 10))
            setDonationItemRows([])
          }
        }

        const populateDonationView = (donation: DonationListRow) => {
          if (!viewDonationEditor) {
            return
          }

          const donationIdField = getModalField(viewDonationEditor, 'Donation ID') as HTMLInputElement | null
          const statusField = getModalField(viewDonationEditor, 'Status') as HTMLInputElement | null
          const donorTypeField = getModalField(viewDonationEditor, 'Donor Type') as HTMLInputElement | null
          const donorNameField = getModalField(viewDonationEditor, 'Donor Name') as HTMLInputElement | null
          if (donationIdField) {
            donationIdField.value = buildDonationDisplayId(donation)
          }
          if (statusField) {
            statusField.value = donationStatusLabel(donation.status)
          }
          if (donorTypeField) {
            donorTypeField.value = donorTypeLabelMap[inferDonationDonorType(donation)]
          }
          if (donorNameField) {
            donorNameField.value = donation.donor_name ?? 'Anonymous'
          }

          const tbody = viewDonationEditor.querySelector('tbody')
          if (tbody) {
            if (donation.donation_type === 'cash') {
              tbody.innerHTML = `
                <tr>
                  <td>Cash Donation</td>
                  <td>${escapeHtml(formatMoney(donation.amount_pence))}</td>
                  <td>-</td>
                </tr>
              `
            } else {
              tbody.innerHTML =
                donation.items && donation.items.length > 0
                  ? donation.items
                      .map(
                        (item) => `
                          <tr>
                            <td>${escapeHtml(item.item_name)}</td>
                            <td>${escapeHtml(String(item.quantity))}</td>
                            <td>${escapeHtml(formatIsoDate(item.expiry_date))}</td>
                          </tr>
                        `,
                      )
                      .join('')
                  : `
                      <tr>
                        <td colspan="3" style="text-align: center; color: var(--color-text-light);">No item rows.</td>
                      </tr>
                    `
            }
          }
        }

        const populateCodeView = (record: AdminApplicationRecord) => {
          if (!viewCodeEditor) {
            return
          }

          const codeField = getModalField(viewCodeEditor, 'Redemption Code') as HTMLInputElement | null
          const statusField = getModalField(viewCodeEditor, 'Status') as HTMLInputElement | null
          const packageField = getModalField(viewCodeEditor, 'Package') as HTMLInputElement | null
          const redeemedAtField = getModalField(viewCodeEditor, 'Redeemed At') as HTMLInputElement | null
          const statusMeta = getCodeStatusMeta(record)

          if (codeField) {
            codeField.value = record.redemption_code
          }
          if (statusField) {
            statusField.value = statusMeta.label
          }
          if (packageField) {
            packageField.value = record.package_name ?? 'Package unavailable'
          }
          if (redeemedAtField) {
            redeemedAtField.value = formatIsoDate(record.redeemed_at)
          }
        }

        const populateVerifyResult = (record: AdminApplicationRecord | null, errorMessage?: string) => {
          if (!codeVerifyResult) {
            return
          }

          if (!record) {
            codeVerifyResult.style.display = 'block'
            codeVerifyResult.style.backgroundColor = 'var(--color-error-light)'
            codeVerifyResult.innerHTML = `
              <p style="font-weight: 600; color: var(--color-error);">${escapeHtml(errorMessage || 'Code not found')}</p>
            `
            if (redeemCodeButton) {
              redeemCodeButton.disabled = true
            }
            return
          }

          const statusMeta = getCodeStatusMeta(record)
          const headerText =
            record.is_voided
              ? 'Code Voided'
              : record.status === 'collected'
                ? 'Already Redeemed'
                : record.status === 'expired'
                  ? 'Code Expired'
                  : 'Code Valid'
          const canRedeem = !record.is_voided && record.status === 'pending'
          if (redeemCodeButton) {
            redeemCodeButton.disabled = !canRedeem
          }
          codeVerifyResult.style.display = 'block'
          codeVerifyResult.style.backgroundColor =
            record.is_voided
              ? 'var(--color-error-light)'
              : record.status === 'expired'
                ? '#FFF3E0'
                : '#E8F5E9'
          codeVerifyResult.innerHTML = `
            <p style="font-weight: 600; color: ${record.is_voided ? 'var(--color-error)' : statusMeta.color};">${escapeHtml(headerText)}</p>
            <p><strong>Package:</strong> ${escapeHtml(record.package_name ?? 'Package unavailable')}</p>
            <p><strong>Generated At:</strong> ${escapeHtml(formatIsoDate(record.created_at))}</p>
            <p><strong>Status:</strong> ${escapeHtml(statusMeta.label)}</p>
          `
        }

        const renderDonationTable = (resetPage = false) => {
          if (!donationTableBody) {
            return
          }

          if (resetPage) {
            donationPage = 1
          }

          const filtered = getFilteredDonations()

          const totalPages = Math.max(1, Math.ceil(filtered.length / donationPageSize))
          donationPage = Math.min(donationPage, totalPages)
          const pageItems = filtered.slice(
            (donationPage - 1) * donationPageSize,
            donationPage * donationPageSize,
          )

          donationTableBody.innerHTML =
            pageItems.length > 0
              ? pageItems
                  .map((row) => {
                    const donorType = inferDonationDonorType(row)
                    const isPendingGoods = row.donation_type === 'goods' && row.status === 'pending'
                    const actions = isPendingGoods
                      ? `
                          <button class="btn btn-sm btn-primary receive-donation-btn">Receive</button>
                          <button class="btn btn-sm btn-danger delete-donation-btn">Delete</button>
                        `
                      : row.donation_type === 'goods'
                        ? `
                            <button class="btn btn-sm btn-secondary view-donation-btn">View</button>
                            <button class="btn btn-sm btn-secondary edit-donation-btn">Edit</button>
                          `
                        : `
                            <button class="btn btn-sm btn-secondary view-donation-btn">View</button>
                            <button class="btn btn-sm btn-danger delete-donation-btn">Delete</button>
                          `

                    return `
                      <tr data-id="${escapeHtml(row.id)}" data-kind="${escapeHtml(row.donation_type)}">
                        <td><input type="checkbox" class="row-checkbox"></td>
                        <td>${escapeHtml(buildDonationDisplayId(row))}</td>
                        <td>${escapeHtml(donorTypeLabelMap[donorType])}</td>
                        <td>${escapeHtml(row.donor_name ?? 'Anonymous')}</td>
                        <td>${escapeHtml(formatIsoDate(row.pickup_date || row.created_at))}</td>
                        <td>${escapeHtml(buildDonationTotalLabel(row))}</td>
                        <td>${escapeHtml(donationStatusLabel(row.status))}</td>
                        <td><div class="table-actions">${actions}</div></td>
                      </tr>
                    `
                  })
                  .join('')
              : `
                  <tr>
                    <td colspan="8" style="text-align: center; color: var(--color-text-light);">No donation records found.</td>
                  </tr>
                `

          resetBatchControls(
            'select-all-donations',
            'donation-selected-count',
            ['batch-delete-donations', 'batch-receive-donations'],
          )
          renderPagination('donation-pagination', donationPage, totalPages, (page) => {
            donationPage = page
            renderDonationTable()
          })
        }

        const renderCodeTable = (resetPage = false) => {
          if (!codeTableBody) {
            return
          }

          if (resetPage) {
            codePage = 1
          }

          const filtered = getFilteredCodes()

          const totalPages = Math.max(1, Math.ceil(filtered.length / codePageSize))
          codePage = Math.min(codePage, totalPages)
          const pageItems = filtered.slice((codePage - 1) * codePageSize, codePage * codePageSize)

          codeTableBody.innerHTML =
            pageItems.length > 0
              ? pageItems
                  .map((record) => {
                    const statusMeta = getCodeStatusMeta(record)
                    const actions =
                      !record.is_voided && record.status === 'pending'
                        ? `<button class="btn btn-sm btn-danger void-code-btn">Void</button>`
                        : `<button class="btn btn-sm btn-secondary view-code-btn">View</button>`

                    return `
                      <tr data-id="${escapeHtml(record.id)}">
                        <td><input type="checkbox" class="row-checkbox"></td>
                        <td>${escapeHtml(record.redemption_code)}</td>
                        <td>${escapeHtml(record.package_name ?? 'Package unavailable')}</td>
                        <td>${escapeHtml(formatIsoDate(record.created_at))}</td>
                        <td style="color: ${statusMeta.color}; font-weight: 600;">${escapeHtml(statusMeta.label)}</td>
                        <td>${escapeHtml(formatIsoDate(record.redeemed_at))}</td>
                        <td><div class="table-actions">${actions}</div></td>
                      </tr>
                    `
                  })
                  .join('')
              : `
                  <tr>
                    <td colspan="7" style="text-align: center; color: var(--color-text-light);">No redemption code records found.</td>
                  </tr>
                `

          resetBatchControls('select-all-codes', 'code-selected-count', ['batch-void-codes'])
          renderPagination('code-pagination', codePage, totalPages, (page) => {
            codePage = page
            renderCodeTable()
          })
        }

        const reloadAdminData = async (options?: { resetDonationPage?: boolean; resetCodePage?: boolean }) => {
          try {
            const [donationRows, applicationResponse] = await Promise.all([
              adminAPI.getDonations(accessToken),
              applicationsAPI.getAdminApplications(accessToken),
            ])

            if (isCancelled) {
              return
            }

            donations = donationRows
            applications = applicationResponse.items
            renderDonationTable(options?.resetDonationPage ?? true)
            renderCodeTable(options?.resetCodePage ?? true)
          } catch (error) {
            if (isCancelled) {
              return
            }
            showToast(error instanceof Error ? error.message : 'Failed to load admin data', 'error')
          }
        }

        if (donationSearchInput) {
          const handleDonationSearch = () => renderDonationTable(true)
          donationSearchInput.addEventListener('input', handleDonationSearch)
          cleanupFns.push(() => donationSearchInput.removeEventListener('input', handleDonationSearch))
        }
        for (const select of donationFilterSelects) {
          const handleDonationFilter = () => renderDonationTable(true)
          select.addEventListener('change', handleDonationFilter)
          cleanupFns.push(() => select.removeEventListener('change', handleDonationFilter))
        }
        if (codeSearchInput) {
          const handleCodeSearch = () => renderCodeTable(true)
          codeSearchInput.addEventListener('input', handleCodeSearch)
          cleanupFns.push(() => codeSearchInput.removeEventListener('input', handleCodeSearch))
        }
        if (inventorySearchInput) {
          const handleInventorySearch = () => renderInventoryGrid()
          inventorySearchInput.addEventListener('input', handleInventorySearch)
          cleanupFns.push(() => inventorySearchInput.removeEventListener('input', handleInventorySearch))
        }
        if (packageSearchInput) {
          const handlePackageSearch = () => renderPackageGrid()
          packageSearchInput.addEventListener('input', handlePackageSearch)
          cleanupFns.push(() => packageSearchInput.removeEventListener('input', handlePackageSearch))
        }
        if (inventoryCategoryFilter) {
          const handleInventoryCategoryChange = () => renderInventoryGrid()
          inventoryCategoryFilter.addEventListener('change', handleInventoryCategoryChange)
          cleanupFns.push(() => inventoryCategoryFilter.removeEventListener('change', handleInventoryCategoryChange))
        }
        if (lotSearchInput) {
          const handleLotSearch = () => renderLotTable(true)
          lotSearchInput.addEventListener('input', handleLotSearch)
          cleanupFns.push(() => lotSearchInput.removeEventListener('input', handleLotSearch))
        }
        for (const select of lotFilterSelects) {
          const handleLotFilter = () => renderLotTable(true)
          select.addEventListener('change', handleLotFilter)
          cleanupFns.push(() => select.removeEventListener('change', handleLotFilter))
        }

        if (donationTableBody) {
          const handleDonationActionClick = (event: Event) => {
            const target = event.target as Element | null
            const button = target?.closest('button')
            if (!button) {
              return
            }

            const rowElement = button.closest('tr')
            const donationId = rowElement?.getAttribute('data-id')
            if (!donationId) {
              return
            }

            const donation = donations.find((row) => row.id === donationId)
            if (!donation) {
              return
            }

            if (button.classList.contains('receive-donation-btn')) {
              void (async () => {
                try {
                  await adminAPI.updateGoodsDonation(donation.id, { status: 'received' }, accessToken)
                  showToast('Donation marked as received.')
                  await reloadAdminData({ resetDonationPage: false })
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Failed to mark donation as received', 'error')
                }
              })()
              return
            }

            if (button.classList.contains('delete-donation-btn')) {
              pendingDeleteDonation = donation
              const description = deleteDonationConfirm?.querySelector('.confirm-desc')
              if (description) {
                description.textContent = `Delete donation ${buildDonationDisplayId(donation)}? This cannot be undone.`
              }
              showEditor('delete-donation-confirm')
              return
            }

            if (button.classList.contains('view-donation-btn')) {
              populateDonationView(donation)
              showEditor('view-donation-editor')
              return
            }

            if (button.classList.contains('edit-donation-btn') && donation.donation_type === 'goods') {
              prepareDonationEditor(donation)
              showEditor('new-donation-editor')
            }
          }

          donationTableBody.addEventListener('click', handleDonationActionClick)
          cleanupFns.push(() => donationTableBody.removeEventListener('click', handleDonationActionClick))
        }

        if (codeTableBody) {
          const handleCodeActionClick = (event: Event) => {
            const target = event.target as Element | null
            const button = target?.closest('button')
            if (!button) {
              return
            }

            const rowElement = button.closest('tr')
            const applicationId = rowElement?.getAttribute('data-id')
            if (!applicationId) {
              return
            }

            const record = applications.find((entry) => entry.id === applicationId)
            if (!record) {
              return
            }

            if (button.classList.contains('void-code-btn')) {
              pendingVoidApplication = record
              const description = voidCodeConfirm?.querySelector('.confirm-desc')
              if (description) {
                description.textContent = `Void code ${record.redemption_code}? This code will no longer be valid for redemption, and cannot be undone.`
              }
              showEditor('void-code-confirm')
              return
            }

            if (button.classList.contains('view-code-btn')) {
              populateCodeView(record)
              showEditor('view-code-editor')
            }
          }

          codeTableBody.addEventListener('click', handleCodeActionClick)
          cleanupFns.push(() => codeTableBody.removeEventListener('click', handleCodeActionClick))
        }

        if (inventoryCardGrid) {
          const handleInventoryActionClick = (event: Event) => {
            const target = event.target as Element | null
            const button = target?.closest('button')
            if (!button) {
              return
            }

            const itemId = Number(button.getAttribute('data-item-id') || button.closest('.card')?.getAttribute('data-item-id') || '0')
            if (!Number.isFinite(itemId) || itemId <= 0) {
              return
            }

            const item = getInventoryRecordById(itemId)
            if (!item) {
              showToast('Inventory item could not be loaded.', 'error')
              return
            }

            event.preventDefault()

            if (button.classList.contains('edit-item-btn')) {
              prepareEditItemEditor(item)
              showEditor('edit-item-editor')
              return
            }

            if (button.classList.contains('stock-in-btn')) {
              prepareStockInEditor(item)
              showEditor('stock-in-editor')
              return
            }

            if (button.classList.contains('delete-item-btn')) {
              prepareDeleteItemConfirm(item)
              showEditor('delete-item-confirm')
            }
          }

          inventoryCardGrid.addEventListener('click', handleInventoryActionClick)
          cleanupFns.push(() => inventoryCardGrid.removeEventListener('click', handleInventoryActionClick))
        }

        if (lotTableBody) {
          const handleLotActionClick = (event: Event) => {
            const target = event.target as Element | null
            const button = target?.closest('button')
            if (!button) {
              return
            }

            const lotId = Number(button.getAttribute('data-lot-id') || button.closest('tr')?.getAttribute('data-id') || '0')
            if (!Number.isFinite(lotId) || lotId <= 0) {
              return
            }

            const lot = getLotRecordById(lotId)
            if (!lot) {
              showToast('Inventory lot could not be loaded.', 'error')
              return
            }

            event.preventDefault()

            if (button.classList.contains('edit-lot-btn')) {
              prepareEditLotEditor(lot)
              showEditor('edit-lot-editor')
              return
            }

            if (button.classList.contains('mark-wasted-btn')) {
              prepareMarkWastedConfirm(lot)
              showEditor('mark-wasted-confirm')
              return
            }

            if (button.classList.contains('delete-lot-btn')) {
              prepareDeleteLotConfirm(lot)
              showEditor('delete-lot-confirm')
            }
          }

          lotTableBody.addEventListener('click', handleLotActionClick)
          cleanupFns.push(() => lotTableBody.removeEventListener('click', handleLotActionClick))
        }

        bindPackageEditorRowActions(newPackageEditor, newPackageTemplateRow)
        bindPackageEditorRowActions(editPackageEditor, editPackageTemplateRow)

        if (packageGrid) {
          const handlePackageActionClick = (event: Event) => {
            const target = event.target as Element | null
            const button = target?.closest('button')
            if (!button) {
              return
            }

            const packageId = Number(button.getAttribute('data-package-id') || '0')
            if (!Number.isFinite(packageId) || packageId <= 0) {
              return
            }

            const selectedPackage = getPackageById(packageId)
            if (!selectedPackage) {
              showToast('Package details could not be loaded.', 'error')
              return
            }

            event.preventDefault()

            if (button.classList.contains('edit-package-btn')) {
              prepareEditPackageEditor(selectedPackage)
              showEditor('edit-package-editor')
              return
            }

            if (button.classList.contains('packing-btn')) {
              preparePackingEditor(selectedPackage.id)
              showEditor('packing-editor')
              return
            }

            if (button.classList.contains('delete-package-btn')) {
              prepareDeletePackageConfirm(selectedPackage)
              showEditor('delete-package-confirm')
            }
          }

          packageGrid.addEventListener('click', handlePackageActionClick)
          cleanupFns.push(() => packageGrid.removeEventListener('click', handlePackageActionClick))
        }

        if (packingPackageSelect) {
          const handlePackingPackageChange = () => {
            const nextPackageId = Number(packingPackageSelect.value || '0')
            packingPackageId = Number.isFinite(nextPackageId) && nextPackageId > 0 ? nextPackageId : null
            renderPackingStockCheck()
          }

          packingPackageSelect.addEventListener('change', handlePackingPackageChange)
          cleanupFns.push(() => packingPackageSelect.removeEventListener('change', handlePackingPackageChange))
        }

        if (packingQuantityInput) {
          const handlePackingQuantityChange = () => renderPackingStockCheck()
          packingQuantityInput.addEventListener('input', handlePackingQuantityChange)
          cleanupFns.push(() => packingQuantityInput.removeEventListener('input', handlePackingQuantityChange))
        }

        if (newPackageButton) {
          newPackageButton.style.pointerEvents = 'auto'
        }

        bindCaptureClick('#new-package-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          prepareNewPackageEditor()
          showEditor('new-package-editor')
        })

        if (newItemButton) {
          newItemButton.style.pointerEvents = 'auto'
        }

        if (batchReceiveDonationsButton) {
          batchReceiveDonationsButton.className = 'btn btn-primary btn-sm'
        }
        if (batchDeleteDonationsButton) {
          batchDeleteDonationsButton.className = 'btn btn-danger btn-sm'
        }

        bindCaptureClick('#new-item-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          prepareNewItemEditor()
          showEditor('new-item-editor')
        })

        bindClick('#new-donation-btn', () => {
          frameWindow?.requestAnimationFrame(() => prepareDonationEditor(null))
        })
        bindClick('#verify-code-btn', () => {
          frameWindow?.requestAnimationFrame(() => {
            verifiedApplication = null
            if (verifyCodeInput) {
              verifyCodeInput.value = ''
            }
            if (codeVerifyResult) {
              codeVerifyResult.style.display = 'none'
              codeVerifyResult.innerHTML = ''
            }
            if (redeemCodeButton) {
              redeemCodeButton.disabled = true
            }
          })
        })

        bindCaptureClick('#export-donation-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          void (async () => {
            try {
              if (exportDonationButton) {
                exportDonationButton.disabled = true
              }

              await exportRowsAsWorkbook(
                'donation-intake-records.xlsx',
                'Donations',
                getFilteredDonations().map((row) => {
                  const donorType = inferDonationDonorType(row)
                  return {
                    ID: buildDonationDisplayId(row),
                    Type: row.donation_type === 'cash' ? 'Cash' : 'Goods',
                    'Donor Type': donorTypeLabelMap[donorType],
                    Donor: row.donor_name ?? 'Anonymous',
                    Email: row.donor_email ?? '',
                    Date: formatIsoDate(row.pickup_date || row.created_at),
                    Total: buildDonationTotalLabel(row),
                    Status: donationStatusLabel(row.status),
                  }
                }),
              )
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to export donations', 'error')
            } finally {
              if (exportDonationButton) {
                exportDonationButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#export-inventory-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          void (async () => {
            try {
              if (exportInventoryButton) {
                exportInventoryButton.disabled = true
              }

              await exportRowsAsWorkbook(
                'inventory-items.xlsx',
                'Inventory Items',
                getFilteredInventoryItems().map((item) => {
                  const deficit = Math.max(item.threshold - item.total_stock, 0)
                  return {
                    Item: item.name,
                    Category: item.category,
                    'Current Stock': item.total_stock,
                    'Safety Threshold': item.threshold,
                    Deficit: deficit,
                    Unit: item.unit,
                  }
                }),
              )
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to export inventory items', 'error')
            } finally {
              if (exportInventoryButton) {
                exportInventoryButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#export-package-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          void (async () => {
            try {
              if (exportPackageButton) {
                exportPackageButton.disabled = true
              }

              await exportRowsAsWorkbook(
                'food-packages.xlsx',
                'Food Packages',
                getFilteredPackages().map((pkg) => ({
                  'Package Name': pkg.name,
                  Category: pkg.category,
                  'Pack Stock': pkg.stock,
                  Threshold: pkg.threshold,
                  'Applied Count': pkg.applied_count,
                  Contents:
                    pkg.package_items.length > 0
                      ? pkg.package_items
                          .map((item) => `${item.inventory_item_name} x${item.quantity}`)
                          .join('; ')
                      : 'No contents configured',
                })),
              )
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to export food packages', 'error')
            } finally {
              if (exportPackageButton) {
                exportPackageButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#export-lot-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          void (async () => {
            try {
              if (exportLotButton) {
                exportLotButton.disabled = true
              }

              await exportRowsAsWorkbook(
                'inventory-lots.xlsx',
                'Lots',
                getFilteredLots().map((lot) => ({
                  Item: lot.item_name,
                  'Lot Number': getLotReference(lot),
                  'Received Date': formatIsoDate(lot.received_date),
                  'Expiry Date': formatIsoDate(lot.expiry_date),
                  Quantity: lot.quantity,
                  Status: getLotDisplayStatus(lot).label,
                })),
              )
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to export lots', 'error')
            } finally {
              if (exportLotButton) {
                exportLotButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#export-code-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          void (async () => {
            try {
              if (exportCodeButton) {
                exportCodeButton.disabled = true
              }

              await exportRowsAsWorkbook(
                'redemption-codes.xlsx',
                'Redemption Codes',
                getFilteredCodes().map((record) => {
                  const statusMeta = getCodeStatusMeta(record)
                  return {
                    Code: record.redemption_code,
                    Package: record.package_name ?? 'Package unavailable',
                    'Created At': formatIsoDate(record.created_at),
                    Status: statusMeta.label,
                    'Redeemed At': formatIsoDate(record.redeemed_at),
                  }
                }),
              )
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to export redemption codes', 'error')
            } finally {
              if (exportCodeButton) {
                exportCodeButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#new-package-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const draft = readPackageEditorDraft(newPackageEditor)
          if ('error' in draft) {
            showToast(draft.error || 'Package data is incomplete.', 'error')
            return
          }
          if (!packageBankId) {
            showToast('No food bank is available for package creation.', 'error')
            return
          }

          void (async () => {
            try {
              if (newPackageSubmitButton) {
                newPackageSubmitButton.disabled = true
              }

              await adminAPI.createFoodPackage(
                {
                  ...draft.value,
                  food_bank_id: packageBankId,
                },
                accessToken,
              )
              showToast('Package added.')
              closeAllEditors()
              prepareNewPackageEditor()
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to add package', 'error')
            } finally {
              if (newPackageSubmitButton) {
                newPackageSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#edit-package-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const packageId = Number(editPackageEditor?.getAttribute('data-package-id') || editingPackageId || '0')
          if (!Number.isFinite(packageId) || packageId <= 0) {
            showToast('Choose a package before saving.', 'error')
            return
          }

          const existingPackage = getPackageById(packageId)
          if (!existingPackage) {
            showToast('Package details could not be loaded.', 'error')
            return
          }

          const draft = readPackageEditorDraft(editPackageEditor)
          if ('error' in draft) {
            showToast(draft.error || 'Package data is incomplete.', 'error')
            return
          }

          void (async () => {
            try {
              if (editPackageSubmitButton) {
                editPackageSubmitButton.disabled = true
              }

              await adminAPI.updateFoodPackage(
                packageId,
                {
                  ...draft.value,
                  food_bank_id: existingPackage.food_bank_id ?? packageBankId ?? undefined,
                },
                accessToken,
              )
              showToast('Package saved.')
              closeAllEditors()
              editingPackageId = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to save package', 'error')
            } finally {
              if (editPackageSubmitButton) {
                editPackageSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#packing-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const selectedPackageId = Number(packingPackageSelect?.value || packingPackageId || '0')
          const quantity = Number(packingQuantityInput?.value || '0')

          if (!Number.isFinite(selectedPackageId) || selectedPackageId <= 0) {
            showToast('Select a package before submitting packing.', 'error')
            return
          }
          if (!Number.isFinite(quantity) || quantity <= 0) {
            showToast('Pack Quantity must be at least 1.', 'error')
            return
          }

          void (async () => {
            try {
              if (packingSubmitButton) {
                packingSubmitButton.disabled = true
              }

              const response = await adminAPI.packPackage(selectedPackageId, quantity, accessToken)
              showToast(`Packing submitted. Stock is now ${response.new_stock}.`)
              closeAllEditors()
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to submit packing', 'error')
            } finally {
              if (packingSubmitButton) {
                packingSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#delete-package-confirm .btn.btn-danger', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          if (!pendingDeletePackage) {
            showToast('Choose a package before deleting.', 'error')
            return
          }

          void (async () => {
            try {
              if (deletePackageConfirmButton) {
                deletePackageConfirmButton.disabled = true
              }

              await adminAPI.deleteFoodPackage(pendingDeletePackage.id, accessToken)
              showToast('Package deleted.')
              closeAllEditors()
              pendingDeletePackage = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to delete package', 'error')
            } finally {
              if (deletePackageConfirmButton) {
                deletePackageConfirmButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#new-item-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const draft = readInventoryEditorDraft(newItemEditor)
          if ('error' in draft) {
            showToast(draft.error || 'Item data is incomplete.', 'error')
            return
          }

          void (async () => {
            try {
              if (newItemSubmitButton) {
                newItemSubmitButton.disabled = true
              }

              await adminAPI.createInventoryItem(
                {
                  ...draft.value,
                  initial_stock: 0,
                  food_bank_id: packageBankId ?? undefined,
                },
                accessToken,
              )
              showToast('Item added.')
              closeAllEditors()
              prepareNewItemEditor()
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to add item', 'error')
            } finally {
              if (newItemSubmitButton) {
                newItemSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#edit-item-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const itemId = Number(editItemEditor?.getAttribute('data-item-id') || editingItemId || '0')
          if (!Number.isFinite(itemId) || itemId <= 0) {
            showToast('Choose an item before saving.', 'error')
            return
          }

          const draft = readInventoryEditorDraft(editItemEditor)
          if ('error' in draft) {
            showToast(draft.error || 'Item data is incomplete.', 'error')
            return
          }

          void (async () => {
            try {
              if (editItemSubmitButton) {
                editItemSubmitButton.disabled = true
              }

              await adminAPI.updateInventoryItem(itemId, draft.value, accessToken)
              showToast('Item saved.')
              closeAllEditors()
              editingItemId = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to save item', 'error')
            } finally {
              if (editItemSubmitButton) {
                editItemSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#stock-in-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const itemId = Number(stockInEditor?.getAttribute('data-item-id') || stockInTargetId || '0')
          if (!Number.isFinite(itemId) || itemId <= 0) {
            showToast('Choose an item before applying stock in.', 'error')
            return
          }

          const quantityField = stockInEditor
            ? (getModalField(stockInEditor, 'Quantity') as HTMLInputElement | null)
            : null
          const expiryField = stockInEditor
            ? (getModalField(stockInEditor, 'Expiry Date') as HTMLInputElement | null)
            : null

          const quantity = Number(quantityField?.value || '0')
          const expiryDate = expiryField?.value.trim() || ''

          if (!Number.isFinite(quantity) || quantity <= 0) {
            showToast('Quantity must be at least 1.', 'error')
            return
          }

          if (expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
            showToast('Expiry Date must use YYYY-MM-DD.', 'error')
            return
          }

          void (async () => {
            try {
              if (stockInSubmitButton) {
                stockInSubmitButton.disabled = true
              }

              await adminAPI.stockInInventoryItem(
                itemId,
                {
                  quantity,
                  reason: 'admin manual stock in',
                  expiry_date: expiryDate || undefined,
                },
                accessToken,
              )
              showToast('Stock updated.')
              closeAllEditors()
              stockInTargetId = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to update stock', 'error')
            } finally {
              if (stockInSubmitButton) {
                stockInSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#delete-item-confirm .btn.btn-danger', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          if (!pendingDeleteItem) {
            showToast('Choose an item before deleting.', 'error')
            return
          }

          void (async () => {
            try {
              if (deleteItemConfirmButton) {
                deleteItemConfirmButton.disabled = true
              }

              await adminAPI.deleteInventoryItem(pendingDeleteItem.id, accessToken)
              showToast('Item deleted.')
              closeAllEditors()
              pendingDeleteItem = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to delete item', 'error')
            } finally {
              if (deleteItemConfirmButton) {
                deleteItemConfirmButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#edit-lot-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const lotId = Number(editLotEditor?.getAttribute('data-lot-id') || editingLotId || '0')
          if (!Number.isFinite(lotId) || lotId <= 0) {
            showToast('Choose a lot before saving.', 'error')
            return
          }

          const expiryField = editLotEditor
            ? (getModalField(editLotEditor, 'Expiry Date') as HTMLInputElement | null)
            : null
          const expiryDate = expiryField?.value.trim() || ''
          if (!expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate)) {
            showToast('Expiry Date must use YYYY-MM-DD.', 'error')
            return
          }

          void (async () => {
            try {
              if (editLotSubmitButton) {
                editLotSubmitButton.disabled = true
              }

              await adminAPI.adjustInventoryLot(lotId, { expiry_date: expiryDate }, accessToken)
              showToast('Expiry saved.')
              closeAllEditors()
              editingLotId = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to save expiry', 'error')
            } finally {
              if (editLotSubmitButton) {
                editLotSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#mark-wasted-confirm .btn.btn-danger', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          if (!pendingWasteLot) {
            showToast('Choose a lot before marking it as wasted.', 'error')
            return
          }

          void (async () => {
            try {
              if (markWastedConfirmButton) {
                markWastedConfirmButton.disabled = true
              }

              await adminAPI.adjustInventoryLot(pendingWasteLot.id, { status: 'wasted' }, accessToken)
              showToast('Lot marked as wasted.')
              closeAllEditors()
              pendingWasteLot = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to mark lot as wasted', 'error')
            } finally {
              if (markWastedConfirmButton) {
                markWastedConfirmButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#delete-lot-confirm .btn.btn-danger', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          if (!pendingDeleteLot) {
            showToast('Choose a lot before deleting.', 'error')
            return
          }

          void (async () => {
            try {
              if (deleteLotConfirmButton) {
                deleteLotConfirmButton.disabled = true
              }

              await adminAPI.deleteInventoryLot(pendingDeleteLot.id, accessToken)
              showToast('Lot deleted.')
              closeAllEditors()
              pendingDeleteLot = null
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to delete lot', 'error')
            } finally {
              if (deleteLotConfirmButton) {
                deleteLotConfirmButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#batch-waste-lots', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const selectedLotIds = new Set(
            selectedIdsFromTable('lot-table-body').map((value) => Number(value)).filter((value) => Number.isFinite(value)),
          )
          const lotsToWaste = lotRecords.filter((lot) => selectedLotIds.has(lot.id) && lot.status === 'active')
          if (lotsToWaste.length === 0) {
            showToast('Select at least one active lot.', 'error')
            return
          }

          const batchWasteButton = doc.getElementById('batch-waste-lots') as HTMLButtonElement | null

          void (async () => {
            try {
              if (batchWasteButton) {
                batchWasteButton.disabled = true
              }

              await Promise.all(
                lotsToWaste.map((lot) => adminAPI.adjustInventoryLot(lot.id, { status: 'wasted' }, accessToken)),
              )
              showToast('Selected lots marked as wasted.')
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to update selected lots', 'error')
            } finally {
              if (batchWasteButton) {
                batchWasteButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#batch-delete-lots', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          const selectedLotIds = new Set(
            selectedIdsFromTable('lot-table-body').map((value) => Number(value)).filter((value) => Number.isFinite(value)),
          )
          const lotsToDelete = lotRecords.filter((lot) => selectedLotIds.has(lot.id) && lot.status !== 'active')
          if (lotsToDelete.length === 0) {
            showToast('Select at least one inactive lot to delete.', 'error')
            return
          }

          const batchDeleteButton = doc.getElementById('batch-delete-lots') as HTMLButtonElement | null

          void (async () => {
            try {
              if (batchDeleteButton) {
                batchDeleteButton.disabled = true
              }

              await Promise.all(lotsToDelete.map((lot) => adminAPI.deleteInventoryLot(lot.id, accessToken)))
              showToast('Selected lots deleted.')
              await reloadPackageData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to delete selected lots', 'error')
            } finally {
              if (batchDeleteButton) {
                batchDeleteButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#new-donation-editor .editor-actions .btn.btn-primary', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()

          if (!donationEditor) {
            return
          }

          const donorTypeField = getModalField(donationEditor, 'Donor Type') as HTMLSelectElement | null
          const donorNameField = getModalField(donationEditor, 'Donor Name') as HTMLInputElement | null
          const contactEmailField = getModalField(donationEditor, 'Contact Email') as HTMLInputElement | null
          const receivedDateField = getModalField(donationEditor, 'Received Date') as HTMLInputElement | null
          const itemRows = Array.from(donationEditor.querySelectorAll('.donation-item-row'))
          const items = itemRows
            .map((row) => {
              const select = row.querySelector('select') as HTMLSelectElement | null
              const quantityInput = row.querySelector('input[type="number"]') as HTMLInputElement | null
              const expiryInput = row.querySelector('input[type="text"]') as HTMLInputElement | null
              const itemName = select?.selectedOptions[0]?.textContent?.trim() || ''
              const quantity = Number(quantityInput?.value || '0')
              return {
                item_name: itemName === 'Select item' ? '' : itemName,
                quantity,
                expiry_date: expiryInput?.value?.trim() || undefined,
              }
            })
            .filter((item) => item.item_name || item.quantity > 0)

          const donorType = (donorTypeField?.value.trim() || '') as
            | keyof typeof donorTypeLabelMap
            | ''
          const donorName = donorNameField?.value.trim() || ''
          const donorEmail = contactEmailField?.value.trim() || ''
          const receivedDate = receivedDateField?.value.trim() || ''

          if (!donorType || !donorName || !donorEmail || !receivedDate || items.length === 0) {
            showToast('Please complete all donation fields before submitting.', 'error')
            return
          }

          if (!/\S+@\S+\.\S+/.test(donorEmail)) {
            showToast('Enter a valid contact email address.', 'error')
            return
          }

          if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
            showToast('Received Date must use YYYY-MM-DD.', 'error')
            return
          }

          if (items.some((item) => !item.item_name || item.quantity <= 0)) {
            showToast('Each donation row needs an item and quantity.', 'error')
            return
          }

          const mode = donationEditor.getAttribute('data-mode')
          const donationId = donationEditor.getAttribute('data-donation-id') || ''
          void (async () => {
            try {
              if (donationSubmitButton instanceof HTMLButtonElement) {
                donationSubmitButton.disabled = true
              }

              const payload = {
                donor_name: donorName,
                donor_type: donorType,
                donor_email: donorEmail,
                donor_phone: 'Not provided',
                pickup_date: receivedDate,
                status: 'received' as const,
                items,
              }

              if (mode === 'edit' && donationId) {
                await adminAPI.updateGoodsDonation(donationId, payload, accessToken)
                showToast('Donation saved.')
              } else {
                await adminAPI.createGoodsDonation(payload, accessToken)
                showToast('Donation submitted.')
              }

              closeAllEditors()
              await reloadAdminData()
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to save donation', 'error')
            } finally {
              if (donationSubmitButton instanceof HTMLButtonElement) {
                donationSubmitButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#delete-donation-confirm .btn.btn-danger', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          if (!pendingDeleteDonation) {
            return
          }

          void (async () => {
            try {
              if (deleteDonationConfirmButton instanceof HTMLButtonElement) {
                deleteDonationConfirmButton.disabled = true
              }

              if (pendingDeleteDonation.donation_type === 'cash') {
                await adminAPI.deleteCashDonation(pendingDeleteDonation.id, accessToken)
              } else {
                await adminAPI.deleteGoodsDonation(pendingDeleteDonation.id, accessToken)
              }
              showToast('Donation record deleted.')
              closeAllEditors()
              pendingDeleteDonation = null
              await reloadAdminData({ resetDonationPage: false })
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to delete donation', 'error')
            } finally {
              if (deleteDonationConfirmButton instanceof HTMLButtonElement) {
                deleteDonationConfirmButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#batch-receive-donations', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          const selected = selectedIdsFromTable('donation-table-body')
          const receivable = donations.filter(
            (row) => selected.includes(row.id) && row.donation_type === 'goods' && row.status === 'pending',
          )
          if (receivable.length === 0) {
            showToast('Select at least one pending goods donation.', 'error')
            return
          }

          void (async () => {
            try {
              await Promise.all(
                receivable.map((row) => adminAPI.updateGoodsDonation(row.id, { status: 'received' }, accessToken)),
              )
              showToast('Selected donations marked as received.')
              await reloadAdminData({ resetDonationPage: false })
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to receive selected donations', 'error')
            }
          })()
        })

        bindCaptureClick('#batch-delete-donations', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          const selected = selectedIdsFromTable('donation-table-body')
          const rowsToDelete = donations.filter((row) => selected.includes(row.id))
          if (rowsToDelete.length === 0) {
            showToast('Select at least one donation record to delete.', 'error')
            return
          }

          void (async () => {
            try {
              await Promise.all(
                rowsToDelete.map((row) =>
                  row.donation_type === 'cash'
                    ? adminAPI.deleteCashDonation(row.id, accessToken)
                    : adminAPI.deleteGoodsDonation(row.id, accessToken),
                ),
              )
              showToast('Selected donation records deleted.')
              await reloadAdminData({ resetDonationPage: false })
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to delete selected donations', 'error')
            }
          })()
        })

        bindCaptureClick('#verify-code-editor #check-code-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          const normalizedCode = normalizeRedemptionCode(verifyCodeInput?.value ?? '')
          if (!normalizedCode) {
            populateVerifyResult(null, 'Enter a redemption code first.')
            return
          }

          void (async () => {
            try {
              const record = await applicationsAPI.getApplicationByCode(normalizedCode, accessToken)
              verifiedApplication = record
              if (verifyCodeInput) {
                verifyCodeInput.value = normalizedCode
              }
              populateVerifyResult(record)
            } catch (error) {
              verifiedApplication = null
              populateVerifyResult(
                null,
                error instanceof Error ? error.message : 'Redemption code not found',
              )
            }
          })()
        })

        bindCaptureClick('#verify-code-editor #redeem-code-btn', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          if (!verifiedApplication) {
            showToast('Check a redemption code before redeeming.', 'error')
            return
          }

          void (async () => {
            try {
              if (redeemCodeButton) {
                redeemCodeButton.disabled = true
              }
              const record = await applicationsAPI.redeemApplication(verifiedApplication.id, accessToken)
              verifiedApplication = record
              showToast('Redemption completed.')
              closeAllEditors()
              await reloadAdminData({ resetCodePage: false })
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to redeem code', 'error')
            } finally {
              if (redeemCodeButton) {
                redeemCodeButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#void-code-confirm .btn.btn-danger', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          if (!pendingVoidApplication) {
            return
          }

          void (async () => {
            try {
              if (voidCodeConfirmButton instanceof HTMLButtonElement) {
                voidCodeConfirmButton.disabled = true
              }
              await applicationsAPI.voidApplication(pendingVoidApplication.id, accessToken)
              showToast('Redemption code voided.')
              closeAllEditors()
              pendingVoidApplication = null
              await reloadAdminData({ resetCodePage: false })
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to void code', 'error')
            } finally {
              if (voidCodeConfirmButton instanceof HTMLButtonElement) {
                voidCodeConfirmButton.disabled = false
              }
            }
          })()
        })

        bindCaptureClick('#batch-void-codes', (event) => {
          event.preventDefault()
          event.stopImmediatePropagation()
          const selected = selectedIdsFromTable('code-table-body')
          const rowsToVoid = applications.filter(
            (record) => selected.includes(record.id) && !record.is_voided && record.status === 'pending',
          )
          if (rowsToVoid.length === 0) {
            showToast('Select at least one pending code to void.', 'error')
            return
          }

          void (async () => {
            try {
              await Promise.all(rowsToVoid.map((record) => applicationsAPI.voidApplication(record.id, accessToken)))
              showToast('Selected redemption codes voided.')
              await reloadAdminData({ resetCodePage: false })
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Failed to void selected codes', 'error')
            }
          })()
        })

        prepareNewPackageEditor()
        preparePackingEditor()
        void reloadPackageData()
        void reloadAdminData()
        cleanupFns.push(() => {
          isCancelled = true
        })
      }

      return () => {
        cleanupFns.forEach((cleanup) => cleanup())
      }
    }

    let cleanup = syncIframe()
    const handleLoad = () => {
      cleanup?.()
      cleanup = syncIframe()
    }
    iframe.addEventListener('load', handleLoad)

    return () => {
      cleanup?.()
      iframe.removeEventListener('load', handleLoad)
    }
  }, [accessToken, isAuthenticated, location.key, logout, navigate, user?.role])

  if (!referenceHtmlWithoutScripts.trim()) {
    return (
      <>
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-slate-600">
          Unable to load `scripts/food_management.html`. Save the file content and refresh this page.
        </div>
        <LoginModal
          isOpen={loginModal.open}
          onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
          initialTab={loginModal.tab}
        />
      </>
    )
  }

  return (
    <>
      <iframe
        ref={iframeRef}
        title="Food Management Preview"
        srcDoc={referenceHtmlWithoutScripts}
        style={{
          display: 'block',
          width: '100%',
          minHeight: '100vh',
          height: '100vh',
          border: '0',
          backgroundColor: '#FFFFFF',
        }}
      />
      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
