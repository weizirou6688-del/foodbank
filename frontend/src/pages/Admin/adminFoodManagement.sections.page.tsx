import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { AdminFoodManagementConfirmModals } from "./ConfirmModals";
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
import {
  AdminCodesSection,
  AdminDonationsSection,
} from "./adminFoodManagement.sections.donations";
import {
  AdminItemsSection,
  AdminLotsSection,
  AdminPackagesSection,
} from "./adminFoodManagement.sections.inventory";
import type {
  AdminFoodManagementSectionsModel,
  AdminFoodManagementSectionsProps,
} from "./adminFoodManagement.sections.shared";
import {
  AdminSectionFeedback,
  AdminSummaryCard,
} from "./sectionBits.sections.cards";
import adminStyles from "./admin.module.css";

const impactLoadingCardCount = 4;

function ManagementSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={adminStyles.section} id={id}>
      <div className={adminStyles.container}>
        <h2
          className={cn(
            adminStyles["section-title"],
            !description && adminStyles["section-title--without-subtitle"],
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className={adminStyles["section-subtitle"]}>{description}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}

function SharedPublicImpactSection({
  impactMetrics,
  publicImpactStatus,
  isLocalFoodBankView,
  foodBankName,
}: AdminFoodManagementSectionsProps["sharedPublicImpact"]) {
  const localScopeLabel = foodBankName || "your food bank";
  const hasImpactMetrics = impactMetrics.length > 0;
  const publicImpactMessageTone =
    publicImpactStatus === "error"
      ? "warning"
      : publicImpactStatus === "ready"
        ? "success"
        : "default";
  const publicImpactMessageTitle =
    publicImpactStatus === "loading"
      ? hasImpactMetrics
        ? isLocalFoodBankView
          ? "Refreshing your food bank snapshot"
          : "Refreshing shared public totals"
        : isLocalFoodBankView
          ? "Loading your food bank snapshot"
          : "Loading shared public totals"
      : publicImpactStatus === "error"
        ? hasImpactMetrics
          ? isLocalFoodBankView
            ? "Showing the latest available local snapshot"
            : "Showing the latest available public snapshot"
          : isLocalFoodBankView
            ? "Your food bank snapshot is unavailable"
            : "Shared public totals are unavailable"
        : isLocalFoodBankView
          ? "Your food bank snapshot is in sync"
          : "Shared public totals are in sync";
  // Keep the status copy explicit about data scope so admins can tell whether
  // these cards reflect one bank or the shared public totals.
  const publicImpactMessageLine =
    publicImpactStatus === "loading"
      ? hasImpactMetrics
        ? isLocalFoodBankView
          ? `Visible cards only include activity from ${localScopeLabel} while fresh values load.`
          : "Visible cards use the same live public source as Home while fresh values load."
        : isLocalFoodBankView
          ? `Loading live activity from ${localScopeLabel}.`
          : "Loading the same live public source used on Home."
      : publicImpactStatus === "error"
        ? hasImpactMetrics
          ? isLocalFoodBankView
            ? "The latest refresh did not complete, so the most recent successful local values remain visible."
            : "The latest refresh did not complete, so the most recent successful values remain visible."
          : isLocalFoodBankView
            ? `We could not load the latest snapshot for ${localScopeLabel} yet.`
            : "We could not load live public totals right now."
        : isLocalFoodBankView
          ? `Updates to donations and redemption activity for ${localScopeLabel} refresh these cards automatically.`
          : "Updates to donations and redemption activity refresh these cards automatically.";

  return (
    <>
      <div
        className={cn(
          adminStyles["admin-inline-message"],
          adminStyles[`admin-inline-message--${publicImpactMessageTone}`],
        )}
      >
        <p className={adminStyles["admin-inline-message-title"]}>
          {publicImpactMessageTitle}
        </p>
        <div className={adminStyles["admin-inline-message-body"]}>
          <p className={adminStyles["admin-inline-message-line"]}>
            {publicImpactMessageLine}
          </p>
        </div>
      </div>
      <div
        className={cn(
          adminStyles["admin-card-grid"],
          adminStyles["admin-impact-card-grid"],
        )}
      >
        {publicImpactStatus === "loading" && !hasImpactMetrics
          ? Array.from({ length: impactLoadingCardCount }, (_, index) => (
              <div
                key={`impact-loading-${index}`}
                className={cn(
                  adminStyles.card,
                  adminStyles["admin-summary-card"],
                )}
                aria-hidden="true"
              >
                <div
                  className={cn(
                    adminStyles["admin-skeleton-bar"],
                    adminStyles["admin-skeleton-bar--label"],
                  )}
                />
                <div
                  className={cn(
                    adminStyles["admin-skeleton-bar"],
                    adminStyles["admin-skeleton-bar--note"],
                  )}
                />
                <div
                  className={cn(
                    adminStyles["admin-skeleton-bar"],
                    adminStyles["admin-skeleton-bar--value"],
                  )}
                />
                <div
                  className={cn(
                    adminStyles["admin-skeleton-bar"],
                    adminStyles["admin-skeleton-bar--trend"],
                  )}
                />
              </div>
            ))
          : hasImpactMetrics
            ? impactMetrics.map((metric) => (
                <AdminSummaryCard
                  key={metric.label}
                  title={metric.label}
                  description={metric.note}
                >
                  <div className={adminStyles["kpi-value"]}>{metric.value}</div>
                  <div
                    className={cn(
                      adminStyles["kpi-trend"],
                      metric.positive === false
                        ? adminStyles["trend-down"]
                        : adminStyles["trend-up"],
                    )}
                  >
                    {metric.change}
                  </div>
                </AdminSummaryCard>
              ))
            : (
              <div
                className={cn(
                  adminStyles.card,
                  adminStyles["admin-summary-card"],
                  adminStyles["admin-impact-status-card"],
                )}
              >
                <div className={adminStyles["admin-summary-card-title"]}>
                  Live totals unavailable
                </div>
                <p className={adminStyles["admin-summary-card-description"]}>
                  We could not load the latest public snapshot right now.
                </p>
              </div>
            )}
      </div>
    </>
  );
}

function DonationSectionFeedback({
  loadError = "",
  pageFeedback,
  onClosePageFeedback,
}: Pick<
  AdminFoodManagementSectionsProps,
  "loadError" | "pageFeedback" | "onClosePageFeedback"
>) {
  return (
    <>
      {loadError ? (
        <AdminSectionFeedback tone="error" message={loadError} />
      ) : null}
      {pageFeedback && pageFeedback.tone !== "success" ? (
        <AdminSectionFeedback
          tone={pageFeedback.tone}
          message={pageFeedback.message}
          onClose={onClosePageFeedback}
        />
      ) : null}
    </>
  );
}

export function AdminFoodManagementPageSections({
  sharedPublicImpact,
  loadError = "",
  pageFeedback,
  onClosePageFeedback,
  donations,
  items,
  packages,
  lots,
  codes,
}: AdminFoodManagementSectionsProps) {
  const sharedPublicImpactDescription = sharedPublicImpact.isLocalFoodBankView
    ? `These live cards show the public-facing totals for ${sharedPublicImpact.foodBankName || "your food bank"} only.`
    : "These are the same live public totals shown on Home.";
  // Declare the page sections as data so hero anchors and future reordering do
  // not require duplicated wrapper markup around each business area.
  const sections: Array<{
    id: string;
    title: string;
    description?: string;
    content: ReactNode;
  }> = [
    {
      id: "shared-public-impact",
      title: "Public Impact",
      description: sharedPublicImpactDescription,
      content: <SharedPublicImpactSection {...sharedPublicImpact} />,
    },
    {
      id: "donation-intake",
      title: "Donation Intake & Recording",
      content: (
        <>
          <DonationSectionFeedback
            loadError={loadError}
            pageFeedback={pageFeedback}
            onClosePageFeedback={onClosePageFeedback}
          />
          <AdminDonationsSection {...donations} />
        </>
      ),
    },
    {
      id: "inventory-items",
      title: "Item Inventory Management",
      content: <AdminItemsSection {...items} />,
    },
    {
      id: "package-management",
      title: "Food Package Building & Management",
      content: <AdminPackagesSection {...packages} />,
    },
    {
      id: "expiry-tracking",
      title: "Lot Tracking & Expiry Management",
      content: <AdminLotsSection {...lots} />,
    },
    {
      id: "code-verification",
      title: "Redemption Code Verification",
      content: <AdminCodesSection {...codes} />,
    },
  ];

  return (
    <>
      {sections.map(({ id, title, description, content }) => (
        <ManagementSection
          key={id}
          id={id}
          title={title}
          description={description}
        >
          {content}
        </ManagementSection>
      ))}
    </>
  );
}

export function AdminFoodManagementPageChrome({
  editorModalProps,
  confirmModalProps,
  detailModalProps,
  chrome,
}: Pick<
  AdminFoodManagementSectionsModel,
  "editorModalProps" | "confirmModalProps" | "detailModalProps" | "chrome"
>) {
  return (
    <>
      <div
        className={cn(
          adminStyles["modal-overlay"],
          chrome.overlay.isVisible && adminStyles.visible,
        )}
        id="global-modal-overlay"
        onClick={chrome.overlay.onClose}
      />
      <InventoryItemEditorModal {...editorModalProps.inventoryItemEditor} />
      <InventoryStockInModal {...editorModalProps.inventoryStockIn} />
      <PackageEditorModal {...editorModalProps.packageEditor} />
      <PackingModal {...editorModalProps.packing} />
      <LotExpiryModal {...editorModalProps.lotExpiry} />
      <DonationEditorModal {...editorModalProps.donationEditor} />
      <AdminFoodManagementConfirmModals {...confirmModalProps} />
      <DonationDetailsModal {...detailModalProps.donationDetails} />
      <CodeVerifyModal {...detailModalProps.codeVerify} />
      <CodeDetailsModal {...detailModalProps.codeDetails} />
      <div
        className={cn(
          adminStyles["action-toast"],
          chrome.toast.isVisible && adminStyles.show,
        )}
        id="action-toast"
      >
        {chrome.toast.message}
      </div>
    </>
  );
}
