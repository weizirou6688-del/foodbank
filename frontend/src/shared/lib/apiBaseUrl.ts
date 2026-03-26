const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1'

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
      if (envUrl) {
        try {
          const parsedEnvUrl = new URL(envUrl)
          const isRemoteHost = !isLoopbackHost(hostname)
          const isLoopbackEnv = isLoopbackHost(parsedEnvUrl.hostname)

          if (!(isRemoteHost && isLoopbackEnv)) {
            return normalizeBaseUrl(envUrl)
          }
        } catch {
          return normalizeBaseUrl(envUrl)
        }
      }

      // In dev, prefer same-origin + Vite proxy to avoid remote tunnel auth/CORS issues.
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
