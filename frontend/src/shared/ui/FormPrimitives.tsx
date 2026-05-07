import {
  type FormEventHandler,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/shared/lib/cn";
import { PublicBanner } from "./PublicPagePatterns";
import styles from "./PublicPagePatterns.module.css";

type FeedbackTone = "neutral" | "info" | "success" | "warning" | "error";

type FormPanelProps = {
  children: ReactNode;
  className?: string;
  noValidate?: boolean;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onSubmitAction?: () => void | Promise<void>;
};

type FieldErrorProps = {
  message?: ReactNode | null;
  className?: string;
  role?: "alert" | "status";
  ariaLive?: "off" | "polite" | "assertive";
};

type FieldProps = {
  id?: string;
  label?: ReactNode;
  required?: boolean;
  requiredMark?: ReactNode;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  requiredClassName?: string;
  helperText?: ReactNode | null;
  helperTextClassName?: string;
  error?: ReactNode | null;
  errorClassName?: string;
  errorRole?: "alert" | "status";
  errorAriaLive?: "off" | "polite" | "assertive";
};

type InlineFeedbackProps = {
  message?: ReactNode | null;
  tone?: FeedbackTone;
  variant?: "banner" | "text";
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  messageClassName?: string;
  actionsClassName?: string;
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  role?: "status" | "alert";
  ariaLive?: "off" | "polite" | "assertive";
  split?: boolean;
};

type PublicFormFieldProps = FieldProps & {
  helperTone?: "default" | "error";
};

type PublicTextInputProps = InputHTMLAttributes<HTMLInputElement>;
type PublicSelectProps = SelectHTMLAttributes<HTMLSelectElement>;
type PublicTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  compact?: boolean;
};

export function FormPanel({
  children,
  className,
  noValidate,
  onSubmit,
  onSubmitAction,
}: FormPanelProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    // 部分公开流程倾向于用按钮驱动的异步动作而非原生 submit 事件,此封装同时支持两种模式
    if (onSubmitAction) {
      event.preventDefault();
      void onSubmitAction();
      return;
    }
    onSubmit?.(event);
  };

  return (
    <form className={className} onSubmit={handleSubmit} noValidate={noValidate}>
      {children}
    </form>
  );
}

export function FieldError({
  message,
  className,
  role,
  ariaLive,
}: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p className={className} role={role} aria-live={ariaLive}>
      {message}
    </p>
  );
}

export function Field({
  id,
  label,
  required = false,
  requiredMark = "*",
  children,
  className,
  labelClassName,
  requiredClassName,
  helperText,
  helperTextClassName,
  error,
  errorClassName,
  errorRole,
  errorAriaLive,
}: FieldProps) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className={labelClassName}>
          {label}
          {required ? (
            <span className={requiredClassName}>{requiredMark}</span>
          ) : null}
        </label>
      ) : null}
      {children}
      {helperText ? <p className={helperTextClassName}>{helperText}</p> : null}
      <FieldError
        message={error}
        className={errorClassName}
        role={errorRole}
        ariaLive={errorAriaLive}
      />
    </div>
  );
}

export function InlineFeedback({
  message,
  tone = "info",
  variant = "banner",
  className,
  bodyClassName,
  titleClassName,
  messageClassName,
  actionsClassName,
  title,
  icon,
  actions,
  children,
  role,
  ariaLive,
  split = false,
}: InlineFeedbackProps) {
  if (!message && !title && !children) {
    return null;
  }

  if (variant === "text") {
    return (
      <p
        className={cn(className, messageClassName)}
        role={role}
        aria-live={ariaLive}
      >
        {message}
      </p>
    );
  }

  return (
    <PublicBanner
      title={title}
      message={message}
      tone={tone}
      icon={icon}
      actions={actions}
      className={className}
      bodyClassName={bodyClassName}
      titleClassName={titleClassName}
      messageClassName={messageClassName}
      actionsClassName={actionsClassName}
      role={role}
      ariaLive={ariaLive}
      split={split}
    >
      {children}
    </PublicBanner>
  );
}

export function PublicFormField({
  className,
  labelClassName,
  requiredClassName,
  helperTextClassName,
  errorClassName,
  errorRole = "alert",
  errorAriaLive = "polite",
  helperTone = "default",
  ...props
}: PublicFormFieldProps) {
  // 集中处理辅助文本和错误绑定,确保各页面字段样式不同时无障碍反馈仍保持一致
  return (
    <Field
      {...props}
      className={cn(styles.formField, className)}
      labelClassName={cn(styles.formLabel, labelClassName)}
      requiredClassName={cn(styles.formRequired, requiredClassName)}
      helperTextClassName={cn(
        helperTone === "error"
          ? styles.formHelperTextError
          : styles.formHelperText,
        helperTextClassName,
      )}
      errorClassName={cn(styles.formError, errorClassName)}
      errorRole={errorRole}
      errorAriaLive={errorAriaLive}
    />
  );
}

export function PublicTextInput({
  className,
  ...props
}: PublicTextInputProps) {
  return (
    <input
      {...props}
      className={cn(styles.formControl, styles.formControlInput, className)}
    />
  );
}

export function PublicSelect({ className, ...props }: PublicSelectProps) {
  return (
    <select
      {...props}
      className={cn(styles.formControl, styles.formControlSelect, className)}
    />
  );
}

export function PublicTextArea({
  className,
  compact = false,
  ...props
}: PublicTextAreaProps) {
  return (
    <textarea
      {...props}
      className={cn(
        styles.formControl,
        styles.formControlTextarea,
        compact && styles.formControlTextareaCompact,
        className,
      )}
    />
  );
}
