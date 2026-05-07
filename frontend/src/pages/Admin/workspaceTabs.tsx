import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { AllowedRole } from "@/features/auth/auth.helpers";
import { lazyWithRetry } from "@/shared/lib/lazyWithRetry";
export type AdminTab = "food" | "statistics";
type WorkspaceTab = AdminTab | "restock";
type WorkspaceComponent = LazyExoticComponent<ComponentType>;
interface WorkspaceTabDef {
  key: WorkspaceTab;
  label: string;
  allowedRole: AllowedRole;
  component: WorkspaceComponent;
  preload: () => Promise<unknown>;
}
type AdminTabDef = WorkspaceTabDef & { key: AdminTab };
const loadAdminFoodManagement = lazyWithRetry(
  "workspace-food",
  () => import("./AdminFoodManagement"),
);
const loadAdminStatistics = lazyWithRetry(
  "workspace-statistics",
  () => import("./AdminStatistics"),
);
const loadSupermarketWorkspace = lazyWithRetry(
  "workspace-restock",
  () => import("@/pages/Supermarket/Supermarket"),
);
// Keep the workspace tab registry here so routing, tab chrome, and idle
// preloading all read from the same role-aware source of truth.
const workspaceTabs: Record<WorkspaceTab, WorkspaceTabDef> = {
  food: {
    key: "food",
    label: "Inventory Management",
    allowedRole: "admin",
    component: lazy(loadAdminFoodManagement),
    preload: loadAdminFoodManagement,
  },
  statistics: {
    key: "statistics",
    label: "Data Dashboard",
    allowedRole: "admin",
    component: lazy(loadAdminStatistics),
    preload: loadAdminStatistics,
  },
  restock: {
    key: "restock",
    label: "Donation Form",
    allowedRole: "supermarket",
    component: lazy(loadSupermarketWorkspace),
    preload: loadSupermarketWorkspace,
  },
};
const adminTabs: AdminTabDef[] = [
  workspaceTabs.food as AdminTabDef,
  workspaceTabs.statistics as AdminTabDef,
];
export function makeWorkspaceUrl(tab: WorkspaceTab, pathname = "/workspace") {
  return `${pathname}?section=${tab}`;
}
function getTabsForRole(userRole: string | null | undefined) {
  if (userRole === "supermarket") {
    return [workspaceTabs.restock];
  }
  return adminTabs;
}
export function getAdminTabs() {
  return adminTabs;
}
export function pickActiveTab(
  userRole: string | null | undefined,
  requestedSection: string | null | undefined,
) {
  if (userRole === "supermarket") {
    return workspaceTabs.restock;
  }
  if (requestedSection === "statistics") {
    return workspaceTabs.statistics;
  }
  return workspaceTabs.food;
}
export function getPrefetchTab(
  currentSection: WorkspaceTab,
  userRole: string | null | undefined,
) {
  return (
    getTabsForRole(userRole).find(
      (section) => section.key !== currentSection,
    ) ?? null
  );
}
