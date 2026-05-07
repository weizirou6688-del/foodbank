import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/shared/lib/cn";
import adminStyles from "./admin.module.css";
export type AdminButtonTone = "primary" | "secondary" | "danger";
type AdminButtonSize = "md" | "sm";
type AdminActionGroupVariant = "table" | "card";
function getAdminButtonClassName(
  tone: AdminButtonTone = "primary",
  size: AdminButtonSize = "md",
  className?: string,
) {
  return cn(
    adminStyles.btn,
    adminStyles[`btn-${tone}`],
    size === "sm" && adminStyles["btn-sm"],
    className,
  );
}
interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: AdminButtonTone;
  size?: AdminButtonSize;
  children: ReactNode;
}
export function AdminButton({
  tone = "primary",
  size = "md",
  className,
  children,
  ...props
}: AdminButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={getAdminButtonClassName(tone, size, className)}
    >
      {children}
    </button>
  );
}
interface AdminNavButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  tone?: AdminButtonTone;
  size?: AdminButtonSize;
  children: ReactNode;
}
export function AdminNavButton({
  tone = "primary",
  size = "md",
  className,
  children,
  ...props
}: AdminNavButtonProps) {
  return (
    <a {...props} className={getAdminButtonClassName(tone, size, className)}>
      {children}
    </a>
  );
}
export function AdminActionGroup({
  variant = "table",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: AdminActionGroupVariant;
  children: ReactNode;
}) {
  return (
    <div
      {...props}
      className={cn(
        variant === "card"
          ? adminStyles["admin-card-actions"]
          : adminStyles["table-actions"],
        className,
      )}
    >
      {children}
    </div>
  );
}
