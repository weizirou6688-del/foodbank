import styles from "./AdminFeedbackBanner.module.css";

interface AdminFeedbackBannerProps {
  tone: "success" | "error" | "info";
  message: string;
  onClose?: () => void;
}

export default function AdminFeedbackBanner({
  tone,
  message,
  onClose,
}: AdminFeedbackBannerProps) {
  if (tone === "error") {
    return (
      <p role="alert" aria-live="polite" className={styles.errorText}>
        {message}
      </p>
    );
  }

  return (
    <div
      className={`${styles.banner} ${tone === "success" ? styles.successTone : styles.infoTone}`}
    >
      <div className={styles.bannerRow}>
        <span>{message}</span>
        {onClose ? (
          <button type="button" onClick={onClose} className={styles.closeButton}>
            x
          </button>
        ) : null}
      </div>
    </div>
  );
}
