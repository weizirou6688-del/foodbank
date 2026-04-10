import type { ImageWithFallbackProps } from '@/shared/ui/ImageWithFallback'
import { ImageWithFallback as SharedImageWithFallback } from '@/shared/ui/ImageWithFallback'

export function ImageWithFallback(props: ImageWithFallbackProps) {
  return (
    <SharedImageWithFallback
      {...props}
      centerFallback={false}
      fallbackContainerClassName=""
      fallbackContentClassName=""
    />
  )
}
