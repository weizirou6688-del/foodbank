import { type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import LoginModal from "@/features/auth/components/LoginModal";
import { useLoginModalController } from "@/features/auth/components/loginModal.model";
import { cn } from "@/shared/lib/cn";
import { scrollToTop, useScrollToTopOnRouteChange } from "@/shared/lib/scroll";
import PublicSiteFooter from "@/shared/ui/PublicSiteFooter";
import styles from "./PublicPageShell.module.css";
type PublicPageShellVariant = "public" | "supermarket";
interface PublicPageShellProps {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  variant?: PublicPageShellVariant;
  showFooter?: boolean;
  navCenterText?: string;
}
const DEFAULT_SHELL_CLASS_NAME = cn(styles.shell, "public-page-font");
const DEFAULT_MAIN_CLASS_NAME = styles.main;
interface NavItem {
  key: string;
  label: string;
  path: string;
}
const publicNavItems: NavItem[] = [
  { key: "home", label: "Home", path: "/home" },
  { key: "support", label: "Get Support", path: "/find-foodbank" },
  { key: "cash", label: "Donate Cash", path: "/donate/cash" },
  { key: "goods", label: "Donate Goods", path: "/donate/goods" },
];
const supermarketNavItems: NavItem[] = [
  {
    key: "restock",
    label: "Donation Form",
    path: "/workspace?section=restock",
  },
];
function getActiveKey(
  pathname: string,
  search: string,
  variant: PublicPageShellVariant,
) {
  if (variant === "supermarket") {
    // 超市页面可在独立路由或共享 workspace shell 内渲染,导航栏将二者视为同一目的地
    const section = new URLSearchParams(search).get("section");
    return pathname === "/supermarket" ||
      (pathname === "/workspace" && section === "restock")
      ? "restock"
      : "";
  }
  if (pathname === "/home") {
    return "home";
  }
  if (
    pathname === "/find-foodbank" ||
    pathname === "/food-packages" ||
    pathname === "/get-support"
  ) {
    return "support";
  }
  if (pathname === "/donate/cash" || pathname === "/donate-cash") {
    return "cash";
  }
  if (pathname === "/donate/goods" || pathname === "/donate-goods") {
    return "goods";
  }
  return "";
}
function PrimaryNavbar({
  variant = "public",
  centerText,
}: {
  variant?: PublicPageShellVariant;
  centerText?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, signOut } = useAuthStore();
  const loginModal = useLoginModalController({ initialTab: "signin" });
  const navItems =
    variant === "supermarket" ? supermarketNavItems : publicNavItems;
  const activeKey = getActiveKey(location.pathname, location.search, variant);
  const roleLabel = variant === "supermarket" ? "Supermarket" : "Public";
  const authLabel = isAuthenticated ? "Sign Out" : "Sign In";
  const currentPath = `${location.pathname}${location.search}`;
  const goTo = (path: string) => {
    // 再次点击当前顶级目标时回到页面顶部,不推入重复的历史记录
    if (currentPath === path) {
      scrollToTop();
      return;
    }
    navigate(path);
  };
  const handleAuthClick = () => {
    if (isAuthenticated) {
      void signOut();
      navigate("/home");
      return;
    }
    loginModal.openSignIn();
  };
  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <button
            type="button"
            className={styles.brandButton}
            onClick={() => goTo("/home")}
          >
            <span className={styles.brand}>ABC Foodbank</span>
          </button>
          {centerText ? (
            <span>{centerText}</span>
          ) : (
            <nav className={styles.nav} aria-label={`${variant} navigation`}>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goTo(item.path)}
                  className={cn(
                    styles.navButton,
                    activeKey === item.key && styles.navButtonActive,
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
          <div className={styles.actions}>
            <span className={styles.roleBadge}>{roleLabel}</span>
            <button
              type="button"
              onClick={handleAuthClick}
              className={styles.authButton}
            >
              {authLabel}
            </button>
          </div>
        </div>
      </header>
      <LoginModal {...loginModal.modalProps} />
    </>
  );
}
export default function PublicPageShell({
  children,
  className,
  mainClassName,
  variant = "public",
  showFooter = true,
  navCenterText,
}: PublicPageShellProps) {
  useScrollToTopOnRouteChange();
  return (
    <div className={cn(DEFAULT_SHELL_CLASS_NAME, className)}>
      <PrimaryNavbar variant={variant} centerText={navCenterText} />
      <main className={cn(DEFAULT_MAIN_CLASS_NAME, mainClassName)}>
        {children}
      </main>
      {showFooter ? <PublicSiteFooter /> : null}
    </div>
  );
}
