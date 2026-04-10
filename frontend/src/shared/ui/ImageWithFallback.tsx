import { useEffect, useState, type ImgHTMLAttributes } from 'react'

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

export interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackContainerClassName?: string
  fallbackContentClassName?: string
  centerFallback?: boolean
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function ImageWithFallback({
  src,
  alt,
  style,
  className,
  onError,
  fallbackContainerClassName = 'inline-block bg-gray-100 text-center align-middle',
  fallbackContentClassName = 'flex items-center justify-center w-full h-full',
  centerFallback = true,
  ...rest
}: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false)

  useEffect(() => {
    setDidError(false)
  }, [src])

  return didError ? (
    <div
      className={joinClassNames(className, fallbackContainerClassName)}
      style={style}
    >
      {centerFallback ? (
        <div className={fallbackContentClassName}>
          <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
        </div>
      ) : (
        <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
      )}
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      {...rest}
      onError={(event) => {
        setDidError(true)
        onError?.(event)
      }}
    />
  )
}

export default ImageWithFallback
