import {
  Link,
  isRouteErrorResponse,
  useLocation,
  useRouteError,
} from 'react-router-dom'

type RouteErrorDetails = {
  heading: string
  message: string
  code?: string
  details?: string
}

const stringifyErrorData = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Error) {
    return value.message
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return 'Unable to display additional error details.'
    }
  }

  return ''
}

const getRouteErrorDetails = (error: unknown): RouteErrorDetails => {
  if (isRouteErrorResponse(error)) {
    const responseDetails = stringifyErrorData(error.data)
    return {
      heading: `Request failed${error.status ? ` (${error.status})` : ''}`,
      message:
        responseDetails
        || error.statusText
        || 'The page could not be loaded. Please try again.',
      code: error.status ? `HTTP ${error.status}` : undefined,
      details: responseDetails || error.statusText,
    }
  }

  if (error instanceof Error) {
    return {
      heading: 'Something went wrong',
      message: error.message || 'The page ran into an unexpected problem.',
      details: error.stack || error.message,
    }
  }

  return {
    heading: 'Something went wrong',
    message: 'The page ran into an unexpected problem.',
    details: stringifyErrorData(error) || undefined,
  }
}

export default function RouteErrorPage() {
  const error = useRouteError()
  const location = useLocation()
  const { heading, message, code, details } = getRouteErrorDetails(error)

  return (
    <main
      className="min-h-screen bg-[#F8F9FA] px-6 py-12 text-[#121212] md:px-8 md:py-16"
      style={{ fontStyle: 'normal' }}
    >
      <div className="mx-auto max-w-3xl rounded-[18px] border border-[#E5E8ED] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)] md:p-10">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#B45309]">
                Application Error
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0D1117]">
                {heading}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#4B5563]">
                {message}
              </p>
            </div>

            {code ? (
              <div className="inline-flex items-center rounded-full bg-[#FFF7ED] px-4 py-2 text-sm font-semibold text-[#9A3412]">
                {code}
              </div>
            ) : null}
          </div>

          <div className="rounded-[14px] border border-[#E5E8ED] bg-[#F8F9FA] px-4 py-4">
            <p className="text-sm font-semibold text-[#111827]">Page</p>
            <p className="mt-2 break-all text-sm leading-6 text-[#4B5563]">
              {location.pathname}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-[10px] bg-[#FFB800] px-5 py-3 text-sm font-semibold text-[#121212] transition-colors duration-200 hover:bg-[#E2A400]"
            >
              Reload Page
            </button>
            <Link
              to="/home"
              className="inline-flex items-center justify-center rounded-[10px] border border-[#D0D7DE] bg-white px-5 py-3 text-sm font-semibold text-[#121212] transition-colors duration-200 hover:bg-[#F3F4F6]"
            >
              Back to Home
            </Link>
          </div>

          {details ? (
            <details className="rounded-[14px] border border-[#E5E8ED] bg-[#F8F9FA] px-4 py-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#111827]">
                Technical details
              </summary>
              <pre
                className="mt-4 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-[#374151]"
                style={{ fontStyle: 'normal' }}
              >
                {details}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </main>
  )
}
