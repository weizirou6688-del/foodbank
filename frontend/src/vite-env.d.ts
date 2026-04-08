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

// Allow importing plain CSS files in TypeScript modules.
declare module '*.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

declare module 'virtual:food-management-template' {
  const html: string
  export default html
}
