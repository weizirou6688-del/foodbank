import { API_BASE_URL } from './apiBaseUrl'

interface ApiValidationError {
  field?: string
  message?: string
}

interface ApiErrorPayload {
  detail?: string
  message?: string
  errors?: ApiValidationError[]
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  token?: string
  body?: unknown
  headers?: HeadersInit
  expectJson?: boolean
}

const REQUEST_FAILED_MESSAGE = 'Request failed'

const normalizeHeaders = (headers?: HeadersInit): HeadersInit | undefined => {
  if (!headers) {
    return undefined
  }

  return headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : headers
}

const resolveToken = (token?: string) => token ?? undefined

const parseErrorPayload = async (response: Response): Promise<ApiErrorPayload> =>
  response.json().catch(() => ({ detail: REQUEST_FAILED_MESSAGE }))

const getValidationMessage = (errors?: ApiValidationError[]) =>
  Array.isArray(errors)
    ? errors
        .map((entry) => entry.message || entry.field)
        .filter((entry): entry is string => Boolean(entry))
        .join(' ')
    : ''

class ApiClient {
  constructor(private readonly baseURL: string) {}

  private buildHeaders(headers?: HeadersInit) {
    return new Headers({
      'Content-Type': 'application/json',
      ...(normalizeHeaders(headers) ?? {}),
    })
  }

  private async performRequest(url: string, init: RequestInit, headers: Headers) {
    return fetch(url, {
      ...init,
      headers,
    })
  }

  private handleUnauthorizedResponse(response: Response, requestHeaders: Headers) {
    if (response.status === 401 && requestHeaders.has('Authorization')) {
      void import('@/app/store/authStore')
        .then(({ useAuthStore }) => {
          useAuthStore.getState().logout()
        })
        .catch(() => undefined)
    }
  }

  private async request<T>(
    endpoint: string,
    {
      method = 'GET',
      token,
      body,
      headers,
      expectJson = true,
    }: ApiRequestOptions = {},
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const requestHeaders = this.buildHeaders(headers)
    const currentToken = resolveToken(token)

    if (currentToken) {
      requestHeaders.set('Authorization', `Bearer ${currentToken}`)
    }

    const init: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }

    const response = await this.performRequest(url, init, requestHeaders)
    this.handleUnauthorizedResponse(response, requestHeaders)

    if (!response.ok) {
      const error = await parseErrorPayload(response)
      throw new Error(
        error.detail
          || getValidationMessage(error.errors)
          || error.message
          || `HTTP ${response.status}`,
      )
    }

    if (!expectJson || response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  get<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { token })
  }

  post<T>(endpoint: string, body?: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'POST', body, token })
  }

  postNoContent(endpoint: string, body?: unknown, token?: string) {
    return this.request<void>(endpoint, {
      method: 'POST',
      body,
      token,
      expectJson: false,
    })
  }

  patch<T>(endpoint: string, body?: unknown, token?: string) {
    return this.request<T>(endpoint, { method: 'PATCH', body, token })
  }

  delete(endpoint: string, token?: string) {
    return this.request<void>(endpoint, {
      method: 'DELETE',
      token,
      expectJson: false,
    })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
