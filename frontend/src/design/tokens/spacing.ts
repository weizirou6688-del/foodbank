export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
  '4xl': '4rem',
  '5xl': '6rem',
  // 新增精细间距
  '1xl': '1.25rem',
  '6xl': '8rem',
} as const

export const radius = {
  none: '0',
  sm: '0.5rem',
  md: '0.875rem',
  lg: '1.25rem',
  xl: '1.75rem',
  '2xl': '2rem',
  '3xl': '2.5rem',
  pill: '999px',
  // 新增圆角层次
  card: '1.25rem',
  button: '0.875rem',
  badge: '999px',
} as const

export const shadow = {
  // 基础阴影
  sm: '0 8px 24px rgba(68, 49, 16, 0.08)',
  md: '0 16px 40px rgba(68, 49, 16, 0.12)',
  lg: '0 28px 70px rgba(68, 49, 16, 0.16)',
  // 新增层次化阴影
  xs: '0 4px 12px rgba(68, 49, 16, 0.05)',
  xl: '0 40px 100px rgba(68, 49, 16, 0.2)',
  // 功能阴影
  card: '0 2px 8px rgba(68, 49, 16, 0.06)',
  cardHover: '0 12px 32px rgba(68, 49, 16, 0.12)',
  cardActive: '0 4px 16px rgba(244, 197, 66, 0.2)',
  button: '0 2px 4px rgba(0, 0, 0, 0.08)',
  buttonHover: '0 4px 12px rgba(244, 197, 66, 0.24)',
  // 状态阴影
  success: '0 4px 16px rgba(22, 101, 52, 0.16)',
  warning: '0 4px 16px rgba(217, 146, 26, 0.16)',
  danger: '0 4px 16px rgba(180, 35, 24, 0.16)',
  info: '0 4px 16px rgba(29, 78, 216, 0.16)',
  // 光晕效果
  glow: {
    yellow: '0 0 40px rgba(244, 197, 66, 0.3)',
    soft: '0 0 60px rgba(244, 197, 66, 0.15)',
  },
} as const
