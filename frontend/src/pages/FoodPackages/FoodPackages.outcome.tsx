import { ActionButton } from "@/shared/ui/PublicPagePatterns";
import type { FoodPackagesPageModel } from "./foodPackages.pageModel";
import styles from "./FoodPackages.module.css";

export function FoodPackagesOutcomeSection({
  model,
}: {
  model: FoodPackagesPageModel;
}) {
  const {
    foodBank,
    handleApply,
    handleNewApplication,
    hasAny,
    isBootstrapping,
    loading,
    redemptionCode,
    showSuccess,
    successRef,
    summaryTxt,
    totalFoods,
    totalFoodUnits,
    totalPkgs,
  } = model;

  if (!foodBank) {
    return null;
  }

  if (showSuccess) {
    return (
      <>
        <div ref={successRef} className={styles.successSection}>
          <div className={styles.successCard}>
            <div className={styles.successHeader}>
              <h3 className={styles.successTitle}>Application Successful</h3>
              <p className={styles.successDesc}>
                {" "}
                Your food package application has been approved. Please present
                this code at the collection point.
              </p>
            </div>
            <div className={styles.successCodeBlock}>
              <div className={styles.successCodeLabel}>Redemption Code</div>
              <div className={styles.successCode}>{redemptionCode}</div>
              <div className={styles.successCodeHint}>Valid for 7 days</div>
            </div>
            <div className={styles.successMetrics}>
              {totalPkgs > 0 ? (
                <div className={styles.successMetricRow}>
                  <span className={styles.successMetricLabel}>
                    Packages Selected
                  </span>
                  <span className={styles.successMetricValue}>{totalPkgs}</span>
                </div>
              ) : null}
              {totalFoods > 0 ? (
                <div className={styles.successMetricRow}>
                  <span className={styles.successMetricLabel}>
                    Individual Item Types
                  </span>
                  <span className={styles.successMetricValue}>{totalFoods}</span>
                </div>
              ) : null}
              {totalFoodUnits > 0 ? (
                <div className={styles.successMetricRow}>
                  <span className={styles.successMetricLabel}>
                    Individual Item Units
                  </span>
                  <span className={styles.successMetricValue}>
                    {totalFoodUnits}
                  </span>
                </div>
              ) : null}
              <div className={styles.successMetricRow}>
                <span className={styles.successMetricLabel}>
                  Collection Address
                </span>
                <span className={styles.successMetricValue}>{foodBank.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sectionActions}>
          <ActionButton
            className={styles.newAppBtn}
            onClick={handleNewApplication}
          >
            New Application
          </ActionButton>
        </div>
      </>
    );
  }

  return (
    <div className={styles.actionBar}>
      <div>
        {!hasAny ? (
          <p className={styles.actionMuted}>No items selected</p>
        ) : (
          <>
            <p className={styles.actionBold}>{summaryTxt}</p>
            <p className={styles.actionMuted}>Ready to apply</p>
          </>
        )}
      </div>
      <ActionButton
        onClick={handleApply}
        disabled={!hasAny || loading || isBootstrapping}
        tone={hasAny && !loading && !isBootstrapping ? "primary" : "secondary"}
        className={styles.submitBtn}
      >
        {isBootstrapping
          ? "Loading Availability..."
          : loading
            ? "Submitting..."
            : "Submit Application"}
      </ActionButton>
    </div>
  );
}
