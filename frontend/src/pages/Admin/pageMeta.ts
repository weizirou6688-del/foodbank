import type { HeroAction } from './AdminPageShell'
import type { AdminTab } from './workspaceTabs'

interface PageMeta {
  title: string
  description: string
  features: string[]
  actions: HeroAction[]
  featureClassName?: string
  featureItemClassName?: string
  showScrollTopButton?: boolean
}

const pageMetaBySection: Record<AdminTab, PageMeta> = {
  food: {
    title: 'Inventory Management, Simplified',
    description:
      'Streamlined operations for food bank inventory, donations, and aid distribution. Track stock, process donations, and manage support in one unified platform.',
    features: [
      'Real-time inventory tracking',
      'Safety threshold tracking',
      'End-to-end donation tracking',
    ],
    actions: [
      { label: 'New Donation', href: '#donation-intake' },
      { label: 'Inventory Items', href: '#inventory-items' },
      { label: 'Package Management', href: '#package-management' },
      { label: 'Expiry Tracking', href: '#expiry-tracking' },
      { label: 'Code Verification', href: '#code-verification' },
    ],
  },
  statistics: {
    title: 'Data Dashboard, Simplified',
    description:
      'Real-time insights for food bank operations, donations, and community impact. Track performance, optimize workflows, and measure your social impact in one unified platform.',
    features: [
      'Real-time operational data',
      'Automated trend analysis',
      'End-to-end impact tracking',
    ],
    actions: [
      { targetId: 'donation-analysis', label: 'Donation Analysis' },
      { targetId: 'inventory-health', label: 'Inventory Health' },
      { targetId: 'distribution-analysis', label: 'Package Management' },
      { targetId: 'waste-analysis', label: 'Expiry Tracking' },
      { targetId: 'code-verification', label: 'Code Verification' },
    ],
    featureClassName: 'hero-features',
    featureItemClassName: 'feature-item',
    showScrollTopButton: true,
  },
}

export function getPageMeta(section: AdminTab) {
  return pageMetaBySection[section]
}
