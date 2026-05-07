import { useNavigate } from "react-router-dom";
import { scrollToId, useHashScroll } from "@/shared/lib/scroll";
import { usePublicImpactMetrics } from "@/shared/lib/usePublicImpactMetrics";

export function useHomePage() {
  const navigate = useNavigate();
  const { impactMetrics, status } = usePublicImpactMetrics();

  // hash 锚点导航(同一路由内滚动)
  useHashScroll();

  return {
    impactMetrics,
    impactStatus: status,
    goTo: (path: string) => navigate(path),
    goToSection: (id: string) => scrollToId(id),
  };
}
