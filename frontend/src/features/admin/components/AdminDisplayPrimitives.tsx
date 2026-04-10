import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

import { cn } from '@/shared/lib/cn'
import { getAdminButtonClassName } from './AdminButtonStyles'

interface AdminPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

interface AdminPageHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
}

export function AdminPageHeading({ children, className, ...props }: AdminPageHeadingProps) {
  return (
    <h2
      className={cn(
        'text-2xl md:text-[1.6rem] font-bold text-[#1A1A1A] border-l-[6px] border-[#F7DC6F] pl-4',
        className,
      )}
      style={{ fontFamily: 'serif' }}
      {...props}
    >
      {children}
    </h2>
  )
}

export function AdminPanel({ children, className, ...props }: AdminPanelProps) {
  return (
    <div
      className={cn('bg-white border-[1.5px] border-[#E8E8E8] rounded-xl p-6 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface AdminSectionHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode
  icon?: ReactNode
}

export function AdminSectionHeading({
  children,
  icon,
  className,
  ...props
}: AdminSectionHeadingProps) {
  return (
    <h3 className={cn('text-xl font-bold flex items-center gap-2 text-[#1A1A1A]', className)} {...props}>
      {icon}
      {children}
    </h3>
  )
}

export function AdminTableHeaderCell({
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('py-3 border-b-2 border-[#F7DC6F] font-semibold text-[#1A1A1A]', className)}
      {...props}
    >
      {children}
    </th>
  )
}

export function AdminTableCell({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('py-3 border-b border-[#E8E8E8] text-[#1A1A1A]', className)} {...props}>
      {children}
    </td>
  )
}

export function AdminDataTableHeaderCell({
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'p-4 font-semibold text-gray-600 border-b-[1.5px] border-[#E8E8E8] text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

interface AdminTablePanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function AdminTablePanel({ children, className, ...props }: AdminTablePanelProps) {
  return (
    <div
      className={cn('overflow-x-auto bg-white border-[1.5px] border-[#E8E8E8] rounded-xl shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface AdminLabeledFieldProps extends HTMLAttributes<HTMLLabelElement> {
  label: string
  children: ReactNode
}

export function AdminLabeledField({
  label,
  className,
  children,
  ...props
}: AdminLabeledFieldProps) {
  return (
    <label className={cn('block', className)} {...props}>
      <span className="block text-sm font-medium text-gray-600 mb-2">{label}</span>
      {children}
    </label>
  )
}

export function AdminRoundedInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full h-11 px-4 border-[1.5px] border-[#E8E8E8] rounded-full bg-white text-[#1A1A1A] outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function AdminRoundedSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full h-11 px-4 border-[1.5px] border-[#E8E8E8] rounded-full bg-white text-[#1A1A1A] outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function AdminSearchField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn('flex items-center border-[1.5px] border-[#E8E8E8] rounded-full px-4 h-12 bg-white', className)}>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mr-2 shrink-0">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        className="flex-1 bg-transparent border-none outline-none text-[#1A1A1A] w-full text-sm"
        {...props}
      />
    </div>
  )
}

export function AdminInfoBox({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-[#E8E8E8] bg-[#F5F5F5] px-4 py-3 text-sm text-[#1A1A1A]', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface AdminMutedTextProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  as?: 'p' | 'div' | 'span'
}

export function AdminMutedText({
  as: Component = 'p',
  className,
  children,
  ...props
}: AdminMutedTextProps) {
  return (
    <Component className={cn('text-sm text-gray-500', className)} {...props}>
      {children}
    </Component>
  )
}

interface AdminTableMessageRowProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode
  colSpan: number
}

export function AdminTableMessageRow({
  className,
  children,
  colSpan,
  ...props
}: AdminTableMessageRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('py-3 text-sm text-gray-500', className)} {...props}>
        {children}
      </td>
    </tr>
  )
}

interface AdminFilterPillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function AdminFilterPillButton({
  active = false,
  className,
  type = 'button',
  ...props
}: AdminFilterPillButtonProps) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({
        kind: 'filterPill',
        tone: active ? 'accent' : 'neutral',
        className,
      })}
      {...props}
    />
  )
}

interface AdminTabPillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function AdminTabPillButton({
  active = false,
  className,
  type = 'button',
  ...props
}: AdminTabPillButtonProps) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({
        kind: 'tabPill',
        tone: active ? 'accent' : 'neutral',
        className,
      })}
      {...props}
    />
  )
}

export function AdminPanelActionButton({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({ kind: 'panelSecondary', className })}
      {...props}
    />
  )
}

export function AdminPrimaryActionButton({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={getAdminButtonClassName({ kind: 'panelPrimary', className })}
      {...props}
    />
  )
}
