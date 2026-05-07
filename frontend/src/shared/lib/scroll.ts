import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
// 锚点目标常在路由状态稳定后延迟一个 tick 挂载,尤其是页面区块依赖异步视图数据时
const hashScrollDelay = 50;
const defaultScrollOptions: ScrollIntoViewOptions = {
  behavior: "smooth",
  block: "start",
};
export function scrollToId(
  id: string,
  options: ScrollIntoViewOptions = defaultScrollOptions,
) {
  if (!id) {
    return false;
  }
  const element = document.getElementById(id);
  if (!element) {
    return false;
  }
  element.scrollIntoView(options);
  return true;
}
export function scrollToTop(behavior: ScrollBehavior = "smooth") {
  window.scrollTo({ top: 0, behavior });
}
export function useHashScroll({
  enabled = true,
  delayMs = hashScrollDelay,
  options = defaultScrollOptions,
}: {
  enabled?: boolean;
  delayMs?: number;
  options?: ScrollIntoViewOptions;
} = {}) {
  const location = useLocation();
  useEffect(() => {
    if (!enabled || !location.hash) {
      return;
    }
    const sectionId = location.hash.slice(1);
    const timer = window.setTimeout(() => {
      scrollToId(sectionId, options);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, enabled, location.hash, options]);
}
export function useBackToTopVisibility({
  enabled = true,
  threshold = 400,
}: { enabled?: boolean; threshold?: number } = {}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }
    const updateVisibility = () => {
      setIsVisible(window.scrollY > threshold);
    };
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateVisibility);
    };
  }, [enabled, threshold]);
  return isVisible;
}
export function useScrollToTopOnMount(behavior: ScrollBehavior = "auto") {
  useEffect(() => {
    scrollToTop(behavior);
  }, [behavior]);
}
export function useScrollToTopOnRouteChange({
  enabled = true,
  behavior = "auto",
  preserveHash = true,
}: {
  enabled?: boolean;
  behavior?: ScrollBehavior;
  preserveHash?: boolean;
} = {}) {
  const location = useLocation();
  useEffect(() => {
    if (!enabled) {
      return;
    }
    // 锚点导航交由专用的 hash-scroll hook 处理,避免先滚到顶部再立即回滚
    if (preserveHash && location.hash) {
      return;
    }
    scrollToTop(behavior);
  }, [
    behavior,
    enabled,
    location.hash,
    location.pathname,
    location.search,
    preserveHash,
  ]);
}
