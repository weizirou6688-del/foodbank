import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AllowedRole } from '@/features/auth/auth.helpers'

export type AdminTab = 'food' | 'statistics'
export type WorkspaceTab = AdminTab | 'restock'

type WorkspaceComponent = LazyExoticComponent<ComponentType>

export interface WorkspaceTabDef {
  key: WorkspaceTab
  label: string
  allowedRole: AllowedRole
  component: WorkspaceComponent
  preload: () => Promise<unknown>
}

type AdminTabDef = WorkspaceTabDef & {
  key: AdminTab
}

const loadAdminFoodManagement = () => import('./AdminFoodManagement')
const loadAdminStatistics = () => import('./AdminStatistics')
const loadSupermarketWorkspace = () => import('@/pages/Supermarket/Supermarket')

export const workspaceTabs: Record<WorkspaceTab, WorkspaceTabDef> = {
  food: {
    key: 'food',
    label: 'Inventory Management',
    allowedRole: 'admin',
    component: lazy(loadAdminFoodManagement),
    preload: loadAdminFoodManagement,
  },
  statistics: {
    key: 'statistics',
    label: 'Data Dashboard',
    allowedRole: 'admin',
    component: lazy(loadAdminStatistics),
    preload: loadAdminStatistics,
  },
  restock: {
    key: 'restock',
    label: 'Restock Requests',
    allowedRole: 'supermarket',
    component: lazy(loadSupermarketWorkspace),
    preload: loadSupermarketWorkspace,
  },
}

const adminTabs: AdminTabDef[] = [
  workspaceTabs.food as AdminTabDef,
  workspaceTabs.statistics as AdminTabDef,
]

export function makeWorkspaceUrl(tab: WorkspaceTab, pathname = '/workspace') {
  return `${pathname}?section=${tab}`
}

export function getTabsForRole(userRole: string | null | undefined) {
  if (userRole === 'supermarket') {
    return [workspaceTabs.restock]
  }

  return adminTabs
}

export function getAdminTabs() {
  return adminTabs
}

export function pickActiveTab(
  userRole: string | null | undefined,
  requestedSection: string | null | undefined,
) {
  if (userRole === 'supermarket') {
    return workspaceTabs.restock
  }

  if (requestedSection === 'statistics') {
    return workspaceTabs.statistics
  }

  return workspaceTabs.food
}

export function getPrefetchTab(
  currentSection: WorkspaceTab,
  userRole: string | null | undefined,
) {
  return getTabsForRole(userRole).find((section) => section.key !== currentSection) ?? null
}
