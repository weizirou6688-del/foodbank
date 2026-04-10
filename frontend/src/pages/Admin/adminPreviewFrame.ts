export type PreviewCleanup = () => void

type FrameWindowBase = Window & typeof globalThis

export interface FrameDomContext<FrameWindow extends FrameWindowBase = FrameWindowBase> {
  doc: Document
  frameWindow: FrameWindow | null
  scrollingElement: HTMLElement
  isFrameHTMLElement: (value: Element | null | undefined) => value is HTMLElement
  isFrameHTMLAnchorElement: (value: Element | null | undefined) => value is HTMLAnchorElement
  scrollFrameTo: (top: number, behavior?: ScrollBehavior) => void
  scrollToElement: (element: HTMLElement, behavior?: ScrollBehavior) => void
}

export const ADMIN_PREVIEW_IFRAME_STYLE = {
  display: 'block',
  width: '100%',
  minHeight: '100vh',
  height: '100vh',
  border: '0',
  backgroundColor: '#FFFFFF',
} as const

export const ADMIN_PREVIEW_HEADER_GRID_OVERRIDES = `
  .header-content {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 360px minmax(0, 1fr) !important;
    align-items: center !important;
    column-gap: 24px !important;
  }

  .header-content nav {
    width: 100% !important;
    max-width: 360px !important;
    justify-self: center !important;
  }

  .header-content .nav-links {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 16px !important;
    width: 100% !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .header-content .nav-links li {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 0 !important;
  }

  .header-content .nav-links a {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    min-height: 36px !important;
    text-align: center !important;
    line-height: 1.25 !important;
  }

  .header-content .logo {
    justify-self: start !important;
    min-width: 0 !important;
  }

  .header-content .header-actions {
    justify-self: end !important;
    min-width: 0 !important;
  }

  @media (max-width: 900px) {
    .header-content {
      grid-template-columns: minmax(0, 1fr) auto !important;
    }
  }
`

export function splitReferenceHtmlScripts(referenceHtml: string): {
  htmlWithoutScripts: string
  inlineScript: string
} {
  const htmlWithoutScripts = referenceHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  const inlineScript = Array.from(referenceHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))
    .map((match: RegExpMatchArray) => match[1]?.trim() ?? '')
    .filter(Boolean)
    .join('\n')

  return {
    htmlWithoutScripts,
    inlineScript,
  }
}

export function softenInlineDomEventBindings(script: string): string {
  return script
    .replace(
      /document\.getElementById\(([^)]+)\)\.addEventListener/g,
      'document.getElementById($1)?.addEventListener',
    )
    .replace(
      /document\.querySelector\(([^)]+)\)\.addEventListener/g,
      'document.querySelector($1)?.addEventListener',
    )
}

export function ensureDocumentStyle(doc: Document, styleId: string, cssText: string): void {
  if (doc.getElementById(styleId)) {
    return
  }

  const style = doc.createElement('style')
  style.id = styleId
  style.textContent = cssText
  doc.head.appendChild(style)
}

export function createFrameDomContext<FrameWindow extends FrameWindowBase = FrameWindowBase>(
  doc: Document,
): FrameDomContext<FrameWindow> {
  const frameWindow = doc.defaultView as FrameWindow | null
  const scrollingElement = (doc.scrollingElement ?? doc.documentElement) as HTMLElement

  const isFrameHTMLElement = (value: Element | null | undefined): value is HTMLElement =>
    Boolean(frameWindow && value instanceof frameWindow.HTMLElement)

  const isFrameHTMLAnchorElement = (value: Element | null | undefined): value is HTMLAnchorElement =>
    Boolean(frameWindow && value instanceof frameWindow.HTMLAnchorElement)

  const scrollFrameTo = (top: number, behavior: ScrollBehavior = 'smooth') => {
    if ('scrollTo' in scrollingElement) {
      scrollingElement.scrollTo({ top, behavior })
    }
    frameWindow?.scrollTo({ top, behavior })
    scrollingElement.scrollTop = top
  }

  const scrollToElement = (element: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
    const top = element.getBoundingClientRect().top + scrollingElement.scrollTop
    scrollFrameTo(top, behavior)
  }

  return {
    doc,
    frameWindow,
    scrollingElement,
    isFrameHTMLElement,
    isFrameHTMLAnchorElement,
    scrollFrameTo,
    scrollToElement,
  }
}

export function bindIframeSync(
  iframe: HTMLIFrameElement,
  sync: () => void | PreviewCleanup,
  options: {
    syncBeforeLoad?: boolean
  } = {},
): PreviewCleanup {
  let cleanup: void | PreviewCleanup

  const runSync = () => {
    cleanup?.()
    cleanup = sync()
  }

  const handleLoad = () => {
    runSync()
  }

  iframe.addEventListener('load', handleLoad)

  if (iframe.contentDocument?.readyState === 'complete' || options.syncBeforeLoad) {
    runSync()
  }

  return () => {
    cleanup?.()
    iframe.removeEventListener('load', handleLoad)
  }
}
