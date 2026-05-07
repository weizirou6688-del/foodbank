import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type FormEventHandler,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib/cn";
import styles from "./PublicPagePatterns.module.css";

type PublicSectionIntroSize = "section" | "hero" | "compact";
type PublicSectionIntroAlign = "center" | "left";
type PublicPageSectionTone = "default" | "muted";
type PublicPageSectionWidth = "page" | "content" | "form";
type ActionButtonTone =
  | "primary"
  | "outline"
  | "secondary"
  | "dark"
  | "ghost"
  | "danger";
type ActionButtonSize = "sm" | "md" | "lg";
type PublicBannerTone = "neutral" | "info" | "success" | "warning" | "error";

const introSizeClassNames: Record<PublicSectionIntroSize, string | undefined> =
  {
    section: undefined,
    hero: styles.sectionIntroHero,
    compact: styles.sectionIntroCompact,
  };

const actionButtonToneClassNames: Record<ActionButtonTone, string> = {
  primary: styles.actionButtonPrimary,
  outline: styles.actionButtonOutline,
  secondary: styles.actionButtonSecondary,
  dark: styles.actionButtonDark,
  ghost: styles.actionButtonGhost,
  danger: styles.actionButtonDanger,
};

const actionButtonSizeClassNames: Record<ActionButtonSize, string> = {
  sm: styles.actionButtonSm,
  md: "",
  lg: styles.actionButtonLg,
};

const bannerToneClassNames: Record<PublicBannerTone, string> = {
  neutral: styles.bannerToneNeutral,
  info: styles.bannerToneInfo,
  success: styles.bannerToneSuccess,
  warning: styles.bannerToneWarning,
  error: styles.bannerToneError,
};

const sectionWidthClassNames: Record<PublicPageSectionWidth, string> = {
  page: styles.pageSectionInnerPage,
  content: styles.pageSectionInnerContent,
  form: styles.pageSectionInnerForm,
};

type PublicSectionIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  descriptionExtraLine?: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  size?: PublicSectionIntroSize;
  align?: PublicSectionIntroAlign;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  contentClassName?: string;
  children?: ReactNode;
};

export function PublicSectionIntro({
  title,
  description,
  descriptionExtraLine,
  titleAs = "h2",
  size = "section",
  align = "center",
  className,
  titleClassName,
  descriptionClassName,
  contentClassName,
  children,
}: PublicSectionIntroProps) {
  const TitleTag = titleAs;

  return (
    <div
      className={cn(
        styles.sectionIntro,
        introSizeClassNames[size],
        align === "left" && styles.sectionIntroLeft,
        className,
      )}
    >
      <TitleTag className={cn(styles.sectionIntroTitle, titleClassName)}>
        {title}
      </TitleTag>
      {description ? (
        <p
          className={cn(styles.sectionIntroDescription, descriptionClassName)}
        >
          {description}
          {descriptionExtraLine ? (
            <span className={styles.sectionIntroDescriptionLine}>
              {descriptionExtraLine}
            </span>
          ) : null}
        </p>
      ) : null}
      {children ? (
        <div className={cn(styles.sectionIntroContent, contentClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

type ActionButtonCommonProps = {
  children: ReactNode;
  tone?: ActionButtonTone;
  size?: ActionButtonSize;
  className?: string;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  fullWidth?: boolean;
  fullWidthOnMobile?: boolean;
};

type ActionButtonProps =
  | (ActionButtonCommonProps &
      ButtonHTMLAttributes<HTMLButtonElement> & { href?: never })
  | (ActionButtonCommonProps &
      AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

export function ActionButton(props: ActionButtonProps) {
  const {
    children,
    tone = "primary",
    size = "md",
    className,
    iconStart,
    iconEnd,
    fullWidth = false,
    fullWidthOnMobile = false,
    ...nativeProps
  } = props;

  const sharedClassName = cn(
    styles.actionButton,
    actionButtonToneClassNames[tone],
    actionButtonSizeClassNames[size],
    fullWidth && styles.actionButtonFullWidth,
    fullWidthOnMobile && styles.actionButtonFullWidthOnMobile,
    className,
  );

  // 锚点和按钮共用同一视觉基元,使导航链接与表单操作在各公开页面可互换
  const content = (
    <>
      {iconStart ? (
        <span className={styles.actionButtonIcon}>{iconStart}</span>
      ) : null}
      <span>{children}</span>
      {iconEnd ? <span className={styles.actionButtonIcon}>{iconEnd}</span> : null}
    </>
  );

  if ("href" in nativeProps && nativeProps.href) {
    const { href, ...anchorProps } = nativeProps as AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    return (
      <a {...anchorProps} href={href} className={sharedClassName}>
        {content}
      </a>
    );
  }

  const { type = "button", ...buttonProps } =
    nativeProps as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button {...buttonProps} type={type} className={sharedClassName}>
      {content}
    </button>
  );
}

type PublicBannerProps = {
  title?: ReactNode;
  message?: ReactNode;
  tone?: PublicBannerTone;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  messageClassName?: string;
  actionsClassName?: string;
  children?: ReactNode;
  role?: "status" | "alert";
  ariaLive?: "off" | "polite" | "assertive";
  split?: boolean;
};

export function PublicBanner({
  title,
  message,
  tone = "info",
  icon,
  actions,
  className,
  bodyClassName,
  titleClassName,
  messageClassName,
  actionsClassName,
  children,
  role,
  ariaLive,
  split = false,
}: PublicBannerProps) {
  return (
    <div
      className={cn(
        styles.banner,
        bannerToneClassNames[tone],
        split && styles.bannerSplit,
        className,
      )}
      role={role}
      aria-live={ariaLive}
    >
      <div className={styles.bannerMain}>
        {icon ? <div className={styles.bannerIconWrap}>{icon}</div> : null}
        <div className={cn(styles.bannerBody, bodyClassName)}>
          {title ? (
            <p className={cn(styles.bannerTitle, titleClassName)}>{title}</p>
          ) : null}
          {message ? (
            <div className={cn(styles.bannerMessage, messageClassName)}>
              {message}
            </div>
          ) : null}
          {children ? <div className={styles.bannerExtra}>{children}</div> : null}
        </div>
      </div>
      {actions ? (
        <div className={cn(styles.bannerActions, actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

type PublicPageSectionProps = ComponentPropsWithoutRef<"section"> & {
  children: ReactNode;
  tone?: PublicPageSectionTone;
  width?: PublicPageSectionWidth;
  innerClassName?: string;
};

export function PublicPageSection({
  children,
  tone = "default",
  width = "page",
  className,
  innerClassName,
  ...sectionProps
}: PublicPageSectionProps) {
  return (
    <section
      {...sectionProps}
      className={cn(
        styles.pageSection,
        tone === "muted" && styles.pageSectionMuted,
        className,
      )}
    >
      <div
        className={cn(
          styles.pageSectionInner,
          sectionWidthClassNames[width],
          innerClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

type PublicSearchPanelProps = {
  title: ReactNode;
  description?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  placeholder: string;
  submitLabel: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  icon?: ReactNode;
  error?: ReactNode;
  className?: string;
  introClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  variant?: "surface" | "embedded";
  align?: PublicSectionIntroAlign;
  introSize?: PublicSectionIntroSize;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "placeholder"
  >;
};

export function PublicSearchPanel({
  title,
  description,
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  submittingLabel,
  isSubmitting = false,
  icon,
  error,
  className,
  introClassName,
  inputClassName,
  buttonClassName,
  variant = "surface",
  align = "left",
  introSize = "compact",
  inputProps,
}: PublicSearchPanelProps) {
  // 搜索面板在邮编流程中共用同一结构,间距、键盘行为和加载态保持一致
  return (
    <div
      className={cn(
        styles.searchPanel,
        variant === "surface"
          ? styles.searchPanelSurface
          : styles.searchPanelEmbedded,
        className,
      )}
    >
      <PublicSectionIntro
        title={title}
        description={description}
        size={introSize}
        align={align}
        className={introClassName}
      />
      <form className={styles.searchForm} onSubmit={onSubmit}>
        <div className={styles.searchInputWrap}>
          {icon ? <span className={styles.searchInputIcon}>{icon}</span> : null}
          <input
            {...inputProps}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={cn(
              styles.searchInput,
              Boolean(icon) && styles.searchInputWithIcon,
              inputClassName,
            )}
          />
        </div>
        <ActionButton
          type="submit"
          disabled={isSubmitting}
          className={buttonClassName}
          fullWidthOnMobile
        >
          {isSubmitting ? submittingLabel ?? submitLabel : submitLabel}
        </ActionButton>
      </form>
      {error ? <p className={styles.searchError}>{error}</p> : null}
    </div>
  );
}

type PublicPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
};

export function PublicPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  previousLabel = "Prev",
  nextLabel = "Next",
}: PublicPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className={cn(styles.pagination, className)} aria-label="Pagination">
      <ActionButton
        tone="secondary"
        size="sm"
        disabled={currentPage === 1}
        className={styles.paginationButton}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        {previousLabel}
      </ActionButton>
      {Array.from({ length: totalPages }, (_, index) => {
        const page = index + 1;
        const isActive = page === currentPage;

        return (
          <ActionButton
            key={page}
            tone={isActive ? "primary" : "secondary"}
            size="sm"
            className={cn(
              styles.paginationButton,
              isActive && styles.paginationButtonActive,
            )}
            onClick={() => onPageChange(page)}
            aria-current={isActive ? "page" : undefined}
          >
            {page}
          </ActionButton>
        );
      })}
      <ActionButton
        tone="secondary"
        size="sm"
        disabled={currentPage === totalPages}
        className={styles.paginationButton}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        {nextLabel}
      </ActionButton>
    </nav>
  );
}
