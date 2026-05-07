import { lazy, Suspense, useEffect, type ReactNode } from "react";
import {
  createBrowserRouter,
  Link,
  Navigate,
  Outlet,
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRouteError,
  useSearchParams,
} from "react-router-dom";
import { useAuthStore } from "@/app/store/authStore";
import { hasAllowedRole, type AllowedRole } from "@/features/auth/auth.helpers";
import LoginModal from "@/features/auth/components/LoginModal";
import { useLoginModalController } from "@/features/auth/components/loginModal.model";
import PublicSiteFooter from "@/shared/ui/PublicSiteFooter";
import { lazyWithRetry } from "@/shared/lib/lazyWithRetry";
import {
  getPrefetchTab,
  makeWorkspaceUrl,
  pickActiveTab,
} from "@/pages/Admin/workspaceTabs";
import routerChromeStyles from "./RouterChrome.module.css";
import routeErrorStyles from "./RouteErrorPage.module.css";
const Home = lazy(lazyWithRetry("home", () => import("@/pages/Home/Home")));
const FindFoodBank = lazy(
  lazyWithRetry(
    "find-foodbank",
    () => import("@/pages/FindFoodBank/FindFoodBank"),
  ),
);
const FoodPackages = lazy(
  lazyWithRetry(
    "food-packages",
    () => import("@/pages/FoodPackages/FoodPackages"),
  ),
);
const DonateCash = lazy(
  lazyWithRetry("donate-cash", () => import("@/pages/DonateCash/DonateCash")),
);
const DonateGoods = lazy(
  lazyWithRetry(
    "donate-goods",
    () => import("@/pages/DonateGoods/DonateGoods"),
  ),
);
type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
type RouteErrorDetails = {
  heading: string;
  message: string;
  code?: string;
  details?: string;
};
interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole?: AllowedRole;
  showFooterWhenBlocked?: boolean;
}
function LoadingMessage({ children }: { children: ReactNode }) {
  return <div className={routerChromeStyles.loadingMessage}>{children}</div>;
}
const stringifyErrorData = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "Unable to display additional error details.";
    }
  }
  return "";
};
const getRouteErrorDetails = (error: unknown): RouteErrorDetails => {
  if (isRouteErrorResponse(error)) {
    const responseDetails = stringifyErrorData(error.data);
    return {
      heading: `Request failed${error.status ? ` (${error.status})` : ""}`,
      message:
        responseDetails ||
        error.statusText ||
        "The page could not be loaded. Please try again.",
      code: error.status ? `HTTP ${error.status}` : undefined,
      details: responseDetails || error.statusText,
    };
  }
  if (error instanceof Error) {
    return {
      heading: "Something went wrong",
      message: error.message || "The page ran into an unexpected problem.",
      details: error.stack || error.message,
    };
  }
  return {
    heading: "Something went wrong",
    message: "The page ran into an unexpected problem.",
    details: stringifyErrorData(error) || undefined,
  };
};
function RouteFallback() {
  return <LoadingMessage>Loading...</LoadingMessage>;
}
function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}
function RouterRoot() {
  return <Outlet />;
}
function RouteErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const { heading, message, code, details } = getRouteErrorDetails(error);
  const reloadHref =
    `${location.pathname}${location.search}${location.hash}` || "/";
  return (
    <main className={routeErrorStyles.root}>
      <div className={routeErrorStyles.content}>
        <p className={routeErrorStyles.line}>Application error</p>
        <h1 className={routeErrorStyles.line}>{heading}</h1>
        <p className={routeErrorStyles.line}>{message}</p>
        {code ? <p className={routeErrorStyles.line}>{code}</p> : null}
        <p className={routeErrorStyles.line}>Page: {location.pathname}</p>
        <p className={routeErrorStyles.line}>
          <a href={reloadHref} className={routeErrorStyles.link}>
            {" "}
            Reload page
          </a>
        </p>
        <p className={routeErrorStyles.line}>
          <Link to="/home" className={routeErrorStyles.link}>
            {" "}
            Back to home
          </Link>
        </p>
        {details ? (
          <>
            <p className={routeErrorStyles.line}>Details:</p>
            <pre className={routeErrorStyles.details}>{details}</pre>
          </>
        ) : null}
      </div>
    </main>
  );
}
function AdminSectionFallback() {
  return (
    <>
      <LoadingMessage>Loading admin section...</LoadingMessage>
      <PublicSiteFooter />
    </>
  );
}
function ProtectedRoute({
  children,
  allowedRole,
  showFooterWhenBlocked = false,
}: ProtectedRouteProps) {
  // open auth in place, keep current route
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const redirectTo = `${location.pathname}${location.search}`;
  const { openSignIn, modalProps } = useLoginModalController({
    initialTab: "signin",
    redirectTo,
    requiredRole: allowedRole,
  });
  useEffect(() => {
    if (!isAuthenticated) {
      openSignIn({ redirectTo, requiredRole: allowedRole });
    }
  }, [allowedRole, isAuthenticated, openSignIn, redirectTo]);
  if (!isAuthenticated) {
    return (
      <>
        <div className={routerChromeStyles.gate}>
          <p className={routerChromeStyles.gateMessage}>
            Please sign in to access this page.
          </p>
          <button
            type="button"
            className={routerChromeStyles.gateButton}
            onClick={() =>
              openSignIn({ redirectTo, requiredRole: allowedRole })
            }
          >
            {" "}
            Sign In
          </button>
        </div>
        {showFooterWhenBlocked ? <PublicSiteFooter /> : null}
        <LoginModal {...modalProps} />
      </>
    );
  }
  if (!hasAllowedRole(user, allowedRole)) {
    return (
      <>
        <div className={routerChromeStyles.gate}>
          <p className={routerChromeStyles.gateMessage}>
            {" "}
            You do not have permission to access this page.
          </p>
        </div>
        {showFooterWhenBlocked ? <PublicSiteFooter /> : null}
      </>
    );
  }
  return <>{children}</>;
}
function WorkspaceRoot() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const userRole = useAuthStore((state) => state.user?.role);
  const sectionParam = searchParams.get("section");
  const activeSection = pickActiveTab(userRole, sectionParam);
  const ActiveSectionComponent = activeSection.component;
  useEffect(() => {
    if (sectionParam === activeSection.key) {
      return;
    }
    navigate(makeWorkspaceUrl(activeSection.key, location.pathname), {
      replace: true,
    });
  }, [activeSection.key, location.pathname, navigate, sectionParam]);
  useEffect(() => {
    const idleWindow = window as IdleWindow;
    const preloadTarget = getPrefetchTab(activeSection.key, userRole);
    if (!preloadTarget) {
      return;
    }
    // 在空闲时间预热下一个可能切换的工作区标签,使切换感觉即时而不拖慢首次渲染
    const preload = () => {
      void preloadTarget.preload();
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleHandle = idleWindow.requestIdleCallback(preload);
      return () => {
        if (typeof idleWindow.cancelIdleCallback === "function") {
          idleWindow.cancelIdleCallback(idleHandle);
        }
      };
    }
    const timer = window.setTimeout(preload, 300);
    return () => window.clearTimeout(timer);
  }, [activeSection.key, userRole]);
  return (
    <Suspense fallback={<AdminSectionFallback />}>
      <ActiveSectionComponent />
    </Suspense>
  );
}
export const router = createBrowserRouter([
  {
    path: "/",
    element: <RouterRoot />,
    errorElement: <RouteErrorPage />,
    children: [
      // 保留旧版管理员路由,但将其引导回共享工作区入口,确保基于角色的导航保持一致
      { index: true, element: <Navigate to="/home" replace /> },
      {
        path: "workspace",
        element: withSuspense(
          <ProtectedRoute
            allowedRole={["admin", "supermarket"]}
            showFooterWhenBlocked
          >
            <WorkspaceRoot />
          </ProtectedRoute>,
        ),
      },
      {
        path: "admin-statistics",
        element: withSuspense(
          <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
            <Navigate to="/workspace?section=statistics" replace />
          </ProtectedRoute>,
        ),
      },
      { path: "home", element: withSuspense(<Home />) },
      { path: "find-foodbank", element: withSuspense(<FindFoodBank />) },
      {
        path: "food-packages",
        element: withSuspense(
          <ProtectedRoute>
            <FoodPackages />
          </ProtectedRoute>,
        ),
      },
      { path: "donate/cash", element: withSuspense(<DonateCash />) },
      { path: "donate/goods", element: withSuspense(<DonateGoods />) },
      {
        path: "admin-food-management",
        element: withSuspense(
          <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
            <Navigate to="/workspace?section=food" replace />
          </ProtectedRoute>,
        ),
      },
      {
        path: "supermarket",
        element: withSuspense(
          <ProtectedRoute allowedRole="supermarket" showFooterWhenBlocked>
            <Navigate to="/workspace?section=restock" replace />
          </ProtectedRoute>,
        ),
      },
      {
        path: "admin",
        element: withSuspense(
          <ProtectedRoute allowedRole="admin" showFooterWhenBlocked>
            <Navigate to="/workspace?section=food" replace />
          </ProtectedRoute>,
        ),
      },
      { path: "*", element: <Navigate to="/home" replace /> },
    ],
  },
]);
