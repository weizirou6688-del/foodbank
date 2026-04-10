import type { NavigateFunction } from 'react-router-dom'
import type { AdminScopeMeta } from '@/shared/lib/adminScope'
import { adminAPI, type DashboardAnalyticsResponse, type DashboardDisplayCard } from '@/shared/lib/api'
import {
  dataDashboardAdminHtml,
  dashboardHeroButtonConfig,
  type DashboardFrameWindow,
  type DashboardRange,
  dashboardToneColorMap,
} from './adminDataDashboardPreview.shared'
import {
  ADMIN_PREVIEW_HEADER_GRID_OVERRIDES,
  createFrameDomContext,
  ensureDocumentStyle,
  type PreviewCleanup,
} from './adminPreviewFrame'

type LoginModalState = {
  open: boolean
  tab: 'signin' | 'register'
}

interface SyncAdminDataDashboardPreviewOptions {
  iframe: HTMLIFrameElement
  navigate: NavigateFunction
  locationPathname: string
  adminScope: AdminScopeMeta
  accessToken: string | null
  isAuthenticated: boolean
  logout: () => void
  setLoginModal: (nextState: LoginModalState) => void
}

export function syncAdminDataDashboardPreviewIframe({
  iframe,
  navigate,
  locationPathname,
  adminScope,
  accessToken,
  isAuthenticated,
  logout,
  setLoginModal,
}: SyncAdminDataDashboardPreviewOptions): PreviewCleanup | undefined {
  const doc = iframe.contentDocument
  if (!doc) {
    return undefined
  }

  const {
    frameWindow,
    isFrameHTMLElement,
    isFrameHTMLAnchorElement,
    scrollingElement,
    scrollFrameTo,
    scrollToElement,
  } = createFrameDomContext<DashboardFrameWindow>(doc)
  const cleanupFns: PreviewCleanup[] = []

  const toneToColor = (tone: string | undefined) =>
    dashboardToneColorMap[tone || ''] || 'var(--color-text-medium)'

  const setText = (id: string, value: string) => {
    const element = doc.getElementById(id)
    if (isFrameHTMLElement(element)) {
      element.textContent = value
    }
  }

  const setCardValue = (cardId: string, value: string, label: string) => {
    const card = doc.getElementById(cardId)
    if (!isFrameHTMLElement(card)) {
      return
    }

    const valueElement = card.querySelector('.impact-value')
    const labelElement = card.querySelector('.impact-label')
    if (isFrameHTMLElement(valueElement)) {
      valueElement.textContent = value
    }
    if (isFrameHTMLElement(labelElement)) {
      labelElement.textContent = label
    }
  }

  const createCell = (text: string, color?: string) => {
    const cell = doc.createElement('td')
    cell.textContent = text
    if (color) {
      cell.style.color = color
      cell.style.fontWeight = '600'
    }
    return cell
  }

  const renderEmptyStateRow = (tbodyId: string, colspan: number, message: string) => {
    const tbody = doc.getElementById(tbodyId)
    if (!tbody) {
      return
    }

    tbody.replaceChildren()
    const row = doc.createElement('tr')
    const cell = doc.createElement('td')
    cell.colSpan = colspan
    cell.textContent = message
    cell.style.textAlign = 'center'
    cell.style.color = 'var(--color-text-light)'
    row.appendChild(cell)
    tbody.appendChild(row)
  }

  const renderDisplayCard = (
    titleId: string,
    valueId: string,
    subtitleId: string,
    card: DashboardDisplayCard,
  ) => {
    setText(titleId, card.title)
    setText(valueId, card.value)
    setText(subtitleId, card.subtitle)
  }

  const bindNavigation = (selector: string, path: string) => {
    const element = doc.querySelector(selector)
    if (isFrameHTMLAnchorElement(element)) {
      element.href = path
    }
    if (!isFrameHTMLElement(element)) {
      return
    }

    const handleClick = (event: MouseEvent) => {
      event.preventDefault()
      navigate(path)
    }
    element.addEventListener('click', handleClick as EventListener)
    cleanupFns.push(() => element.removeEventListener('click', handleClick as EventListener))
  }

  const bindCaptureAction = (selector: string, handler: (event: MouseEvent) => void) => {
    const element = doc.querySelector(selector)
    if (!isFrameHTMLElement(element)) {
      return
    }

    element.addEventListener('click', handler as EventListener, true)
    cleanupFns.push(() => element.removeEventListener('click', handler as EventListener, true))
  }

  const publicDashboardPath = locationPathname === '/data-dashboard-preview' ? '/data-dashboard-preview' : '/'
  const dashboardPath = locationPathname.startsWith('/admin')
    ? '/admin?section=statistics'
    : publicDashboardPath

  const logo = doc.querySelector('.logo')
  if (isFrameHTMLElement(logo)) {
    logo.style.fontSize = '20px'
    logo.style.fontFamily = 'Inter, system-ui, sans-serif'
    logo.style.cursor = 'pointer'
    const handleLogoClick = () => navigate(dashboardPath)
    logo.addEventListener('click', handleLogoClick)
    cleanupFns.push(() => logo.removeEventListener('click', handleLogoClick))
  }

  const adminTag = doc.querySelector('.admin-tag')
  if (isFrameHTMLElement(adminTag)) {
    adminTag.textContent = adminScope.roleLabel
  }

  ensureDocumentStyle(doc, 'admin-dashboard-runtime-overrides', ADMIN_PREVIEW_HEADER_GRID_OVERRIDES)

  doc.getElementById('admin-scope-banner')?.remove()
  doc.getElementById('admin-scope-banner-styles')?.remove()

  const applyDashboardScopeVisibility = () => {}
  applyDashboardScopeVisibility()

  const heroButtonsContainer = doc.querySelector('.hero-buttons')
  if (isFrameHTMLElement(heroButtonsContainer)) {
    heroButtonsContainer.innerHTML = dashboardHeroButtonConfig
      .filter(({ targetId }) => {
        const section = doc.getElementById(targetId)
        return isFrameHTMLElement(section) && section.style.display !== 'none'
      })
      .map(
        ({ targetId, label }) =>
          `<a href="#${targetId}" class="btn btn-primary">${label}</a>`,
      )
      .join('')
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

  const signButton = doc.querySelector('.header-actions .btn.btn-secondary')
  if (isFrameHTMLAnchorElement(signButton)) {
    signButton.className = 'btn btn-secondary'
    signButton.href = '#'
    signButton.textContent = isAuthenticated ? 'Sign Out' : 'Sign In'
    signButton.target = ''
    signButton.rel = ''
    signButton.style.cursor = 'pointer'
  }

  bindCaptureAction('.header-actions .btn.btn-secondary', (event) => {
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

  const foodManagementPath = locationPathname.startsWith('/admin')
    ? '/admin?section=food'
    : '/food-management-preview'

  bindNavigation('.nav-links li:first-child a', foodManagementPath)
  bindNavigation('.nav-links li:nth-child(2) a', dashboardPath)

  const previewFooter = doc.querySelector('footer')
  if (previewFooter) {
    previewFooter.remove()
  }

  if (frameWindow && accessToken) {
    const analyticsCache = new Map<DashboardRange, Promise<DashboardAnalyticsResponse>>()
    const loadDashboardAnalytics = (range: DashboardRange = 'month', force = false) => {
      if (!force && analyticsCache.has(range)) {
        return analyticsCache.get(range)!
      }

      const request = adminAPI.getDashboardAnalytics(accessToken, range).catch((error) => {
        analyticsCache.delete(range)
        throw error
      })
      analyticsCache.set(range, request)
      return request
    }

    frameWindow.dashboardDataService = {
      getKpiData: async (range = 'month') => (await loadDashboardAnalytics(range)).kpi,
      getDonationData: async (range = 'month') => (await loadDashboardAnalytics(range)).donation,
      getInventoryData: async (range = 'month') => (await loadDashboardAnalytics(range)).inventory,
      getPackageData: async (range = 'month') => (await loadDashboardAnalytics(range)).package,
      getExpiryData: async (range = 'month') => (await loadDashboardAnalytics(range)).expiry,
      getRedemptionData: async (range = 'month') => (await loadDashboardAnalytics(range)).redemption,
    }

    frameWindow.dashboardPostRender = async (range = 'month') => {
      const analytics = await loadDashboardAnalytics(range)
      const impactCardIds: Record<string, string> = {
        families_supported: 'impact-card-families-supported',
        food_units_distributed: 'impact-card-food-units-distributed',
        partner_supermarkets: 'impact-card-partner-supermarkets',
        partner_organizations: 'impact-card-partner-supermarkets',
        goods_units_year: 'impact-card-goods-units-year',
        aid_packages_distributed: 'impact-card-aid-packages-distributed',
      }

      for (const metric of analytics.impactMetrics) {
        const cardId = impactCardIds[metric.key]
        if (cardId) {
          setCardValue(cardId, metric.value, metric.label)
        }
      }

      setText('average-donation-value', analytics.donation.averageValue.value)
      setText('average-donation-subtitle', analytics.donation.averageValue.subtitle)
      setText('average-donation-trend', analytics.donation.averageValue.trend || '')

      renderDisplayCard(
        'average-support-title',
        'average-support-value',
        'average-support-unit',
        analytics.package.averageSupportDuration,
      )
      renderDisplayCard(
        'items-per-package-title',
        'items-per-package-value',
        'items-per-package-unit',
        analytics.package.itemsPerPackage,
      )

      const lowStockBody = doc.getElementById('low-stock-alerts-body')
      if (lowStockBody) {
        lowStockBody.replaceChildren()
        if (analytics.inventory.lowStockAlerts.length === 0) {
          renderEmptyStateRow('low-stock-alerts-body', 6, 'No low stock alerts right now.')
        } else {
          for (const alert of analytics.inventory.lowStockAlerts) {
            const row = doc.createElement('tr')
            row.appendChild(createCell(alert.item_name))
            row.appendChild(createCell(alert.category))
            row.appendChild(createCell(alert.current_stock_label))
            row.appendChild(createCell(alert.threshold_label))
            row.appendChild(createCell(String(alert.deficit)))
            row.appendChild(createCell(alert.status, toneToColor(alert.status_tone)))
            lowStockBody.appendChild(row)
          }
        }
      }

      const expiringLotsBody = doc.getElementById('expiring-lots-body')
      if (expiringLotsBody) {
        expiringLotsBody.replaceChildren()
        if (analytics.expiry.expiringLots.length === 0) {
          renderEmptyStateRow('expiring-lots-body', 5, 'No lots are expiring in the next 30 days.')
        } else {
          for (const lot of analytics.expiry.expiringLots) {
            const row = doc.createElement('tr')
            const daysLabel = `${lot.days_until_expiry} Day${lot.days_until_expiry === 1 ? '' : 's'}`
            row.appendChild(createCell(lot.item_name))
            row.appendChild(createCell(lot.lot_number))
            row.appendChild(createCell(lot.expiry_date))
            row.appendChild(createCell(lot.remaining_stock_label))
            row.appendChild(createCell(daysLabel, toneToColor(lot.status_tone)))
            expiringLotsBody.appendChild(row)
          }
        }
      }

      const verificationBody = doc.getElementById('recent-verification-body')
      if (verificationBody) {
        verificationBody.replaceChildren()
        if (analytics.redemption.recentVerificationRecords.length === 0) {
          renderEmptyStateRow('recent-verification-body', 4, 'No recent verification records yet.')
        } else {
          for (const record of analytics.redemption.recentVerificationRecords) {
            const row = doc.createElement('tr')
            row.appendChild(createCell(record.redemption_code))
            row.appendChild(createCell(record.package_type))
            row.appendChild(createCell(record.verified_at))
            row.appendChild(createCell(record.status, toneToColor(record.status_tone)))
            verificationBody.appendChild(row)
          }
        }
      }

      applyDashboardScopeVisibility()
    }

    let dashboardInitTimer: number | null = null
    let dashboardInitCancelled = false
    const queueDashboardInit = (attempt = 0) => {
      if (dashboardInitCancelled) {
        return
      }

      const runtimeReady =
        doc.readyState === 'complete' &&
        typeof frameWindow.initAllData === 'function' &&
        typeof frameWindow.Chart !== 'undefined'

      if (!runtimeReady) {
        if (attempt >= 50) {
          console.error('Dashboard runtime was not ready before initialization timed out.')
          return
        }

        dashboardInitTimer = frameWindow.setTimeout(() => {
          queueDashboardInit(attempt + 1)
        }, 100)
        return
      }

      const initAllData = frameWindow.initAllData
      if (typeof initAllData !== 'function') {
        return
      }

      analyticsCache.clear()
      void initAllData()
    }

    queueDashboardInit()
    cleanupFns.push(() => {
      dashboardInitCancelled = true
      if (dashboardInitTimer != null) {
        frameWindow.clearTimeout(dashboardInitTimer)
      }
      if (frameWindow.dashboardDataService) {
        delete frameWindow.dashboardDataService
      }
      if (frameWindow.dashboardPostRender) {
        delete frameWindow.dashboardPostRender
      }
    })
  }

  return () => {
    cleanupFns.forEach((cleanup) => cleanup())
  }
}

export function isDashboardPreviewSourceAvailable(): boolean {
  return Boolean(dataDashboardAdminHtml.trim())
}
