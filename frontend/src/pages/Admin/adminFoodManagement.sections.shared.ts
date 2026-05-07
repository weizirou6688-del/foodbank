import type { ComponentProps } from "react";
import type {
  PublicImpactMetricCard,
  PublicImpactMetricsStatus,
} from "@/shared/lib/usePublicImpactMetrics";
import {
  inventoryCategoryOptions,
  packageCategoryOptions,
  type PageFeedback,
} from "./adminFoodManagement.types";
import type { AdminFoodManagementConfirmModalsProps } from "./ConfirmModals";
import {
  CodeDetailsModal,
  CodeVerifyModal,
} from "./adminFoodManagement.modals.codes";
import {
  DonationDetailsModal,
  DonationEditorModal,
} from "./adminFoodManagement.modals.donations";
import {
  InventoryItemEditorModal,
  InventoryStockInModal,
  LotExpiryModal,
  PackageEditorModal,
  PackingModal,
} from "./adminFoodManagement.modals.inventory";
import type {
  AdminCodesSectionProps,
  AdminDonationsSectionProps,
} from "./adminFoodManagement.sections.donations";
import type {
  AdminItemsSectionProps,
  AdminLotsSectionProps,
  AdminPackagesSectionProps,
} from "./adminFoodManagement.sections.inventory";

export const sessionExpiredMessage = "Please login again and retry.";
export const donorEmailPattern = /\S+@\S+\.\S+/;
export const inventoryEditorCategories = Array.from(inventoryCategoryOptions);
export const packageEditorCategories = Array.from(packageCategoryOptions);

export type SharedPublicImpactSectionProps = {
  impactMetrics: PublicImpactMetricCard[];
  publicImpactStatus: PublicImpactMetricsStatus;
  isLocalFoodBankView: boolean;
  foodBankName: string | null;
};

export type AdminFoodManagementSectionsProps = {
  sharedPublicImpact: SharedPublicImpactSectionProps;
  loadError?: string;
  pageFeedback: PageFeedback | null;
  onClosePageFeedback: () => void;
  donations: AdminDonationsSectionProps;
  items: AdminItemsSectionProps;
  packages: AdminPackagesSectionProps;
  lots: AdminLotsSectionProps;
  codes: AdminCodesSectionProps;
};

export type AdminFoodManagementEditorModalProps = {
  inventoryItemEditor: ComponentProps<typeof InventoryItemEditorModal>;
  inventoryStockIn: ComponentProps<typeof InventoryStockInModal>;
  packageEditor: ComponentProps<typeof PackageEditorModal>;
  packing: ComponentProps<typeof PackingModal>;
  lotExpiry: ComponentProps<typeof LotExpiryModal>;
  donationEditor: ComponentProps<typeof DonationEditorModal>;
};

export type AdminFoodManagementDetailModalProps = {
  donationDetails: ComponentProps<typeof DonationDetailsModal>;
  codeVerify: ComponentProps<typeof CodeVerifyModal>;
  codeDetails: ComponentProps<typeof CodeDetailsModal>;
};

export type AdminFoodManagementChromeBindings = {
  overlay: { isVisible: boolean; onClose: () => void };
  toast: { isVisible: boolean; message: string };
};

export type AdminFoodManagementSectionsModel = {
  sectionsProps: AdminFoodManagementSectionsProps;
  editorModalProps: AdminFoodManagementEditorModalProps;
  confirmModalProps: AdminFoodManagementConfirmModalsProps;
  detailModalProps: AdminFoodManagementDetailModalProps;
  chrome: AdminFoodManagementChromeBindings;
};
