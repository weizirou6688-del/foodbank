import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

const DEFAULT_SCROLL_DELAY_MS = 50
const DEFAULT_SCROLL_OPTIONS: ScrollIntoViewOptions = {
  behavior: 'smooth',
  block: 'start',
}

export function scrollToElementById(
  id: string,
  options: ScrollIntoViewOptions = DEFAULT_SCROLL_OPTIONS,
) {
  if (!id) {
    return false
  }

  const element = document.getElementById(id)
  if (!element) {
    return false
  }

  element.scrollIntoView(options)
  return true
}

export function scrollToTop(behavior: ScrollBehavior = 'smooth') {
  window.scrollTo({ top: 0, behavior })
}

export function useScrollToHash({
  enabled = true,
  delayMs = DEFAULT_SCROLL_DELAY_MS,
  options = DEFAULT_SCROLL_OPTIONS,
}: {
  enabled?: boolean
  delayMs?: number
  options?: ScrollIntoViewOptions
} = {}) {
  const location = useLocation()

  useEffect(() => {
    if (!enabled || !location.hash) {
      return
    }

    const targetId = location.hash.slice(1)
    const timeoutHandle = window.setTimeout(() => {
      scrollToElementById(targetId, options)
    }, delayMs)

    return () => window.clearTimeout(timeoutHandle)
  }, [delayMs, enabled, location.hash, options])
}

export function useScrollTopVisibility({
  enabled = true,
  threshold = 400,
}: {
  enabled?: boolean
  threshold?: number
} = {}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false)
      return
    }

    const updateVisibility = () => {
      setIsVisible(window.scrollY > threshold)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [enabled, threshold])

  return isVisible
}

export function useScrollToTopOnMount(behavior: ScrollBehavior = 'auto') {
  useEffect(() => {
    scrollToTop(behavior)
  }, [behavior])
}

export function useScrollToTopOnRouteChange({
  enabled = true,
  behavior = 'auto',
  preserveHash = true,
}: {
  enabled?: boolean
  behavior?: ScrollBehavior
  preserveHash?: boolean
} = {}) {
  const location = useLocation()

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (preserveHash && location.hash) {
      return
    }

    scrollToTop(behavior)
  }, [behavior, enabled, location.hash, location.pathname, location.search, preserveHash])
}
