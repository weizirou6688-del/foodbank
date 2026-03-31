export const colors = {
  surface: {
    // 基础表面色
    canvas: '#FFFBEF',
    base: '#FFFDF8',
    raised: '#FFFFFF',
    muted: '#FFF4CC',
    elevated: '#FFFAE6',
    inverse: '#1E1E1E',
    // 卡片表面色
    card: '#FFFFFF',
    cardHover: '#FFFEF5',
    interactive: '#FFFFFF',
    interactiveHover: '#FFF9E0',
    // 新增区域表面色
    hero: '#FFF9E0',
    heroAlt: '#FFE89A',
    section: '#FFFFFF',
    sectionAlt: '#F8F4E6',
    sidebar: '#FFFEF9',
    footer: '#F5F2E6',
    // 功能区域色
    header: '#FFFFFF',
    content: '#FFFDF8',
    panel: '#FFFFFF',
    overlay: 'rgba(30, 30, 30, 0.5)',
  },
  text: {
    // 基础文本色
    primary: '#1E1E1E',
    secondary: '#505050',
    muted: '#757575',
    inverse: '#FFFDF8',
    danger: '#B42318',
    success: '#166534',
    info: '#1D4ED8',
    // 新增文本色层次
    tertiary: '#8B8B8B',
    link: '#1D4ED8',
    onYellow: '#3D3420',
    onBrand: '#1E1E1E',
    onAccent: '#FFFFFF',
    // 功能文本色
    heading: '#1E1E1E',
    body: '#505050',
    caption: '#757575',
    disabled: '#A3A3A3',
    // 状态文本色
    successText: '#166534',
    warningText: '#8B6D00',
    errorText: '#B42318',
    infoText: '#1D4ED8',
  },
  brand: {
    // 主品牌色
    primary: '#F4C542',
    primaryHover: '#E8B92D',
    primaryLight: '#FDEEAB',
    primaryLighter: '#FEF7D4',
    primaryDark: '#D4A91E',
    accent: '#1E1E1E',
    accentSoft: '#FFF1BF',
    highlight: '#FFE082',
    // 品牌渐变色
    gradient: {
      start: '#F4C542',
      end: '#E8B92D',
    },
    // 品牌扩展色
    palette: {
      50: '#FFFDE8',
      100: '#FEF7D4',
      200: '#FDEEAB',
      300: '#FCE082',
      400: '#FAD259',
      500: '#F4C542',
      600: '#E8B92D',
      700: '#D4A91E',
      800: '#B89116',
      900: '#9A7812',
    },
  },
  border: {
    // 基础边框色
    subtle: '#F1E3A8',
    default: '#E6D27A',
    strong: '#CAA11E',
    inverse: '#2A2A2A',
    // 新增边框色层次
    focus: '#F4C542',
    card: '#E8E0B0',
    cardHover: '#D4C5A0',
    // 功能边框色
    divider: '#E8E0B0',
    separator: '#F1E3A8',
    outline: '#F4C542',
    // 状态边框色
    success: '#14B87A',
    warning: '#F59E0B',
    danger: '#DC2626',
    info: '#3B82F6',
  },
  state: {
    // 基础状态色
    successBg: '#EAF7EE',
    warningBg: '#FFF7D6',
    dangerBg: '#FDECEC',
    infoBg: '#EEF4FF',
    // 新增状态色层次
    successHover: '#D4EDD4',
    warningHover: '#FFF0B8',
    dangerHover: '#FDD8D8',
    infoHover: '#DDE7FF',
    selected: '#FFF4CC',
    selectedBorder: '#F4C542',
    // 交互状态
    hover: '#FFF9E0',
    active: '#FFE89A',
    focus: '#FEF7D4',
    disabled: '#F5F5F5',
    // 选择状态
    checked: '#F4C542',
    checkedBg: '#FFF4CC',
    indeterminate: '#E8B92D',
  },
  // 功能色
  functional: {
    // 连接状态
    connected: '#1F8F68',
    connectedBg: '#E8F5EF',
    connectedBorder: '#14B87A',
    connectedHover: '#187353',
    // 发现状态
    discovery: '#D9921A',
    discoveryBg: '#FEF3C7',
    discoveryBorder: '#F59E0B',
    discoveryHover: '#CC7D18',
    // 选择状态
    selected: '#CC5A1E',
    selectedBg: '#FDECE8',
    selectedBorder: '#EA580C',
    // 用户位置
    userLocation: '#2563EB',
    userLocationBg: '#DBEAFE',
    userLocationBorder: '#3B82F6',
    // 新增功能色
    pending: '#9CA3AF',
    pendingBg: '#F3F4F6',
    pendingBorder: '#D1D5DB',
    processing: '#3B82F6',
    processingBg: '#DBEAFE',
    processingBorder: '#2563EB',
    completed: '#10B981',
    completedBg: '#D1FAE5',
    completedBorder: '#059669',
  },
  // 渐变色
  gradient: {
    // 基础渐变
    warm: {
      from: '#FFFFFF',
      to: '#FFF8DD',
    },
    cool: {
      from: '#FFFFFF',
      to: '#F0F7F4',
    },
    card: {
      from: '#FFFFFF',
      to: '#FFFEF9',
    },
    // 新增渐变
    hero: {
      from: '#FFF9E0',
      to: '#FFE89A',
    },
    sunset: {
      from: '#F4C542',
      via: '#E8B92D',
      to: '#D4A91E',
    },
    ocean: {
      from: '#E0F2FE',
      via: '#BAE6FD',
      to: '#7DD3FC',
    },
    forest: {
      from: '#D1FAE5',
      via: '#A7F3D0',
      to: '#6EE7B7',
    },
    // 背景渐变
    background: {
      light: 'linear-gradient(180deg, #FFFBEF 0%, #FFF8DD 100%)',
      dark: 'linear-gradient(180deg, #1E1E1E 0%, #2A2A2A 100%)',
      warm: 'linear-gradient(135deg, #FFF9E0 0%, #FFE89A 100%)',
      cool: 'linear-gradient(135deg, #F0F7F4 0%, #D4EDD4 100%)',
    },
  },
  // 新增阴影色
  shadow: {
    // 基础阴影
    sm: 'rgba(68, 49, 16, 0.08)',
    md: 'rgba(68, 49, 16, 0.12)',
    lg: 'rgba(68, 49, 16, 0.16)',
    xl: 'rgba(68, 49, 16, 0.2)',
    // 彩色阴影
    yellow: 'rgba(244, 197, 66, 0.24)',
    green: 'rgba(22, 101, 52, 0.24)',
    blue: 'rgba(29, 78, 216, 0.24)',
    red: 'rgba(180, 35, 24, 0.24)',
    orange: 'rgba(217, 146, 26, 0.24)',
  },
  // 页面区域色
  page: {
    // 首页
    home: {
      hero: '#FFF9E0',
      feature: '#FFFFFF',
      cta: '#FFE89A',
    },
    // 查找页面
    find: {
      search: '#FFFFFF',
      result: '#FFFEF9',
      map: '#F0F7F4',
    },
    // 捐赠页面
    donate: {
      cash: '#E8F5EF',
      goods: '#FFF7D6',
      impact: '#EEF4FF',
    },
    // 管理页面
    admin: {
      dashboard: '#F8F4E6',
      stats: '#FFFFFF',
      table: '#FFFEF9',
    },
  },
} as const

export type ColorToken = typeof colors
