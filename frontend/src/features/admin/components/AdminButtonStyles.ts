import { cn } from '@/shared/lib/cn'

type AdminButtonKind =
  | 'inline'
  | 'modalPrimary'
  | 'modalSecondary'
  | 'panelSecondary'
  | 'panelPrimary'
  | 'filterPill'
  | 'tabPill'
type AdminButtonTone = 'accent' | 'danger' | 'neutral'

interface AdminButtonClassNameOptions {
  kind: AdminButtonKind
  tone?: AdminButtonTone
  className?: string
}

export function getAdminButtonClassName({
  kind,
  tone = 'neutral',
  className,
}: AdminButtonClassNameOptions) {
  if (kind === 'inline') {
    return cn(
      'px-3 py-1.5 border-[1.5px] rounded-full text-xs font-medium bg-transparent disabled:opacity-60',
      tone === 'danger'
        ? 'border-[#E63946] text-[#E63946] hover:bg-[#E63946]/5'
        : 'border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50',
      className,
    )
  }

  if (kind === 'modalSecondary') {
    return cn(
      'px-4 py-2 rounded-full border border-[#E8E8E8] text-sm text-[#1A1A1A] disabled:opacity-60',
      className,
    )
  }

  if (kind === 'panelSecondary') {
    return cn(
      'px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50 disabled:opacity-60',
      className,
    )
  }

  if (kind === 'panelPrimary') {
    return cn(
      'inline-flex items-center justify-center gap-2 rounded-full bg-[#F7DC6F] border-[1.5px] border-[#F7DC6F] text-[#1A1A1A] hover:bg-[#F0C419] transition-colors disabled:opacity-60',
      className,
    )
  }

  if (kind === 'filterPill') {
    return cn(
      'px-5 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-colors disabled:opacity-60',
      tone === 'accent'
        ? 'bg-[#F7DC6F] border-[#F7DC6F] text-[#1A1A1A] hover:bg-[#F0C419]'
        : 'bg-transparent border-[#E8E8E8] text-[#1A1A1A] hover:bg-gray-50',
      className,
    )
  }

  if (kind === 'tabPill') {
    return cn(
      'px-5 py-2 rounded-full font-semibold flex items-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60',
      tone === 'accent'
        ? 'bg-[#F7DC6F] text-[#1A1A1A]'
        : 'text-gray-500 hover:bg-gray-100',
      className,
    )
  }

  return cn(
    'px-5 py-2 rounded-full border text-sm font-semibold disabled:opacity-60',
    tone === 'danger'
      ? 'border-[#E63946] bg-[#E63946] text-white'
      : 'border-[#F7DC6F] bg-[#F7DC6F] text-[#1A1A1A]',
    className,
  )
}
