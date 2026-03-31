/// <reference types="vite/client" />

// CSS Modules type declarations
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string }
  export default classes
}

// 为所有 CSS 模块添加宽松的类型声明
declare module '*.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
