import type { ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import { getAdminScopeMeta } from "@/shared/lib/adminScope";
import { cn } from "@/shared/lib/cn";
import { scrollToTop, useBackToTopVisibility } from "@/shared/lib/scroll";
import PublicSiteFooter from "@/shared/ui/PublicSiteFooter";
import { AdminButton, AdminNavButton } from "./chrome";
import adminStyles from "./admin.module.css";
import { getAdminTabs, makeWorkspaceUrl, type AdminTab } from "./workspaceTabs";
export interface HeroAction {
  label: string;
  sectionId?: string;
  href?: string;
  onClick?: () => void;
}
export type HeroFeatureGroupClassName = "hero-benefits" | "hero-features";
export type HeroFeatureItemClassName = "benefit-item" | "feature-item";
export interface PageMeta {
  section: AdminTab;
  title: string;
  description: string;
  features?: string[];
  actions?: HeroAction[];
  featureClassName?: HeroFeatureGroupClassName;
  featureItemClassName?: HeroFeatureItemClassName;
  showBackToTop?: boolean;
}
interface AdminLayoutProps extends PageMeta {
  children: ReactNode;
}
const sectionConfig: Record<AdminTab, Omit<PageMeta, "section">> = {
  food: {
    title: "Inventory Management",
    description: "",
    features: [],
    actions: [
      { label: "New Donation", href: "#donation-intake" },
      { label: "Inventory Items", href: "#inventory-items" },
      { label: "Package Management", href: "#package-management" },
      { label: "Expiry Tracking", href: "#expiry-tracking" },
      { label: "Code Verification", href: "#code-verification" },
    ],
    showBackToTop: true,
  },
  statistics: {
    title: "Data Dashboard",
    description: "",
    features: [],
    actions: [
      { sectionId: "donation-analysis", label: "Donation Analysis" },
      { sectionId: "inventory-health", label: "Inventory Health" },
      { sectionId: "distribution-analysis", label: "Package Management" },
      { sectionId: "waste-analysis", label: "Expiry Tracking" },
      { sectionId: "code-verification", label: "Code Verification" },
    ],
    featureClassName: "hero-features",
    featureItemClassName: "feature-item",
    showBackToTop: true,
  },
};
// This helper is intentionally colocated with the shell metadata it serves.
// eslint-disable-next-line react-refresh/only-export-components
export function getPageMeta(section: AdminTab): PageMeta {
  return {
    section,
    ...sectionConfig[section],
  };
}
export default function AdminLayout({
  section,
  title,
  description,
  features = [],
  actions = [],
  featureClassName = "hero-benefits",
  featureItemClassName = "benefit-item",
  showBackToTop = false,
  children,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const adminScope = getAdminScopeMeta(user);
  const backToTopVisible = useBackToTopVisibility({
    enabled: showBackToTop,
  });
  const currentPath = location.pathname;
  const navSections = getAdminTabs();
  const shouldAddHeroButtonGap = features.length === 0 && !description;
  // Preserve the current workspace path when switching tabs so scoped admin
  // URLs keep the same deployment or base-route context.
  const navigateToSection = (nextSection: AdminTab) => {
    navigate(makeWorkspaceUrl(nextSection, currentPath));
  };
  return (
    <>
      <div
        className={cn(
          adminStyles["admin-page"],
          adminStyles[`admin-page--${section}`],
        )}
      >
        {showBackToTop ? (
          <button
            type="button"
            id="scroll-top-btn"
            className={cn(
              adminStyles["scroll-top-btn"],
              backToTopVisible && adminStyles.show,
            )}
            onClick={() => scrollToTop()}
            aria-label="Back to top"
            title="Back to top"
          >
            <ArrowUp
              className={adminStyles["scroll-top-btn-icon"]}
              aria-hidden="true"
            />
          </button>
        ) : null}
        <header className={adminStyles.header}>
          <div className={adminStyles["header-content"]}>
            <a
              href={makeWorkspaceUrl(section, currentPath)}
              className={adminStyles.logo}
              onClick={(event) => {
                event.preventDefault();
                navigate(makeWorkspaceUrl(section, currentPath));
              }}
            >
              {" "}
              ABC Foodbank
            </a>
            <nav aria-label="Admin navigation">
              <ul className={adminStyles["nav-links"]}>
                {navSections.map((navSection) => (
                  <li key={navSection.key}>
                    <a
                      href={makeWorkspaceUrl(navSection.key, currentPath)}
                      className={cn(
                        section === navSection.key && adminStyles.active,
                      )}
                      onClick={(event) => {
                        event.preventDefault();
                        navigateToSection(navSection.key);
                      }}
                    >
                      {navSection.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={adminStyles["header-actions"]}>
              <div className={adminStyles["admin-tag"]}>
                {adminScope.roleLabel}
              </div>
              <AdminButton
                tone="secondary"
                className={adminStyles["header-auth-button"]}
                onClick={() => {
                  void signOut();
                  navigate("/home", { replace: true });
                }}
              >
                {" "}
                Sign Out
              </AdminButton>
            </div>
          </div>
        </header>
        <main>
          <section
            className={cn(adminStyles["hero-section"], adminStyles.section)}
            id="top"
          >
            <div className={adminStyles.container}>
              <div
                className={cn(
                  adminStyles["hero-text"],
                  shouldAddHeroButtonGap &&
                    adminStyles["hero-text--actions-only"],
                )}
              >
                <h1>{title}</h1>
                {description ? <p>{description}</p> : null}
              </div>
              {features.length > 0 ? (
                <div className={adminStyles[featureClassName]}>
                  {features.map((feature) => (
                    <div
                      key={feature}
                      className={adminStyles[featureItemClassName]}
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              ) : null}
              {actions.length > 0 ? (
                <div className={adminStyles["hero-buttons"]}>
                  {actions.map((action) =>
                    action.onClick ? (
                      <AdminButton
                        key={`${action.label}-${action.sectionId ?? action.href ?? "action"}`}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </AdminButton>
                    ) : (
                      <AdminNavButton
                        key={`${action.label}-${action.sectionId ?? action.href ?? "link"}`}
                        href={action.href ?? `#${action.sectionId ?? "top"}`}
                      >
                        {action.label}
                      </AdminNavButton>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </section>
          {children}
        </main>
      </div>
      <PublicSiteFooter />
    </>
  );
}
