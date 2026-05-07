import type { FoodPackagesPageModel } from "./foodPackages.pageModel";
import { FoodPackagesCatalogSection } from "./FoodPackages.catalog";
import { FoodPackagesOutcomeSection } from "./FoodPackages.outcome";
import styles from "./FoodPackages.module.css";

export function FoodPackagesEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className={styles.emptyState}>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

export function FoodPackagesReadyState({
  model,
}: {
  model: FoodPackagesPageModel;
}) {
  const { foodBank } = model;

  if (!foodBank) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <FoodPackagesCatalogSection model={model} />
        <FoodPackagesOutcomeSection model={model} />
      </div>
    </div>
  );
}
