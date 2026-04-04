import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import dataDashboardReferenceHtml from 'virtual:data-dashboard-reference'
import { useAuthStore } from '@/app/store/authStore'
import LoginModal from '@/features/auth/components/LoginModal'
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter'
import { adminAPI, type DashboardAnalyticsResponse, type DashboardDisplayCard } from '@/shared/lib/api'

const roleLabelMap = {
  admin: 'Admin',
  supermarket: 'Supermarket',
  public: 'Account',
} as const

type DashboardRange = 'month' | 'quarter' | 'year'

type DashboardFrameWindow = Window &
  typeof globalThis & {
    dashboardDataService?: {
      getKpiData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['kpi']>
      getDonationData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['donation']>
      getInventoryData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['inventory']>
      getPackageData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['package']>
      getExpiryData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['expiry']>
      getRedemptionData: (range?: DashboardRange) => Promise<DashboardAnalyticsResponse['redemption']>
    }
    dashboardPostRender?: (range?: DashboardRange) => Promise<void>
    initAllData?: () => Promise<void>
  }

const toneColorMap: Record<string, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  muted: 'var(--color-text-medium)',
}

const dataDashboardAdminHtml = dataDashboardReferenceHtml.replace(
  '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js"></script>',
  '<script>window.__skipDashboardAutoInit = true;</script>\n<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js"></script>',
)

export default function AdminDataDashboardPreview() {
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
    document.title = 'Data Dashboard - ABC Foodbank'
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
        return undefined
      }

      const frameWindow = doc.defaultView as DashboardFrameWindow | null
      const scrollingElement = doc.scrollingElement ?? doc.documentElement
      const cleanupFns: Array<() => void> = []
      const isFrameHTMLElement = (value: Element | null | undefined): value is HTMLElement =>
        Boolean(frameWindow && value instanceof frameWindow.HTMLElement)
      const isFrameHTMLAnchorElement = (value: Element | null | undefined): value is HTMLAnchorElement =>
        Boolean(frameWindow && value instanceof frameWindow.HTMLAnchorElement)
      const toneToColor = (tone: string | undefined) => toneColorMap[tone || ''] || 'var(--color-text-medium)'
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

      const publicDashboardPath = location.pathname === '/data-dashboard-preview' ? '/data-dashboard-preview' : '/'
      const dashboardPath = location.pathname.startsWith('/admin')
        ? '/admin?section=statistics'
        : publicDashboardPath

      const logo = doc.querySelector('.logo')
      if (isFrameHTMLElement(logo)) {
        logo.style.cursor = 'pointer'
        const handleLogoClick = () => navigate(dashboardPath)
        logo.addEventListener('click', handleLogoClick)
        cleanupFns.push(() => logo.removeEventListener('click', handleLogoClick))
      }

      const adminTag = doc.querySelector('.admin-tag')
      if (isFrameHTMLElement(adminTag)) {
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

      const foodManagementPath = location.pathname.startsWith('/admin')
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
        }

        analyticsCache.clear()
        void frameWindow.initAllData?.()
        cleanupFns.push(() => {
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
  }, [accessToken, isAuthenticated, location.pathname, logout, navigate, user?.role])

  if (!dataDashboardAdminHtml.trim()) {
    return (
      <>
        <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-slate-600">
          Unable to load `scripts/Data_dashboard.html`. Save the file content and refresh this page.
        </div>
        <PublicSiteFooter />
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
        title="Data Dashboard Preview"
        srcDoc={dataDashboardAdminHtml}
        style={{
          display: 'block',
          width: '100%',
          minHeight: '100vh',
          height: '100vh',
          border: '0',
          backgroundColor: '#FFFFFF',
        }}
      />
      <PublicSiteFooter />
      <LoginModal
        isOpen={loginModal.open}
        onClose={() => setLoginModal((state) => ({ ...state, open: false }))}
        initialTab={loginModal.tab}
      />
    </>
  )
}
