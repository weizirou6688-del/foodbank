import { ImageWithFallback } from '@/shared/ui/ImageWithFallback'
import type { FeatureCardContent } from '../donateGoods.types'
import { styles } from '../donateGoodsStyles'

export function FeatureCard({ title, description, image }: FeatureCardContent) {
  if (image) {
    return (
      <article className={styles.featureImageCard}>
        <ImageWithFallback src={image} alt={title} className={styles.featureImage} />
        <div className={styles.featureImageOverlay}>
          <div className={styles.featureImageContent}>
            <h3 className={styles.featureImageTitle}>{title}</h3>
            <p className={styles.featureImageText}>{description}</p>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.featureCard}>
      <h3 className={styles.featureCardTitle}>{title}</h3>
      <p className={styles.featureCardText}>{description}</p>
    </article>
  )
}
