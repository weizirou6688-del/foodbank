const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const buildCodespacesApiUrl = (
  protocol: string,
  hostname: string,
): string | null => {
  const appGithubDevMatch = hostname.match(/^(.*)-(\d+)\.app\.github\.dev$/)
  if (appGithubDevMatch) {
    const prefix = appGithubDevMatch[1]
    return `${protocol}//${prefix}-8000.app.github.dev`
  }

  const githubPreviewMatch = hostname.match(/^(.*)-(\d+)\.githubpreview\.dev$/)
  if (githubPreviewMatch) {
    const prefix = githubPreviewMatch[1]
    return `${protocol}//${prefix}-8000.githubpreview.dev`
  }

  return null
}

export const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL?.trim()

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location

    if (import.meta.env.DEV) {
      // In dev, always go through the same-origin Vite proxy. The proxy target
      // is configured in `vite.config.ts` from shared startup settings.
      return ''
    }

    if (envUrl) {
      return normalizeBaseUrl(envUrl)
    }

    const codespacesApiUrl = buildCodespacesApiUrl(protocol, hostname)
    if (codespacesApiUrl) {
      return normalizeBaseUrl(codespacesApiUrl)
    }

    return `${protocol}//${hostname}:8000`
  }

  if (envUrl) {
    return normalizeBaseUrl(envUrl)
  }

  return 'http://localhost:8000'
}

export const API_BASE_URL = getApiBaseUrl()
