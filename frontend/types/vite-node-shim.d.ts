declare module 'fs' {
  interface FileSystemModule {
    existsSync(path: string): boolean
    readFileSync(path: string, encoding: string): string
  }

  const fs: FileSystemModule
  export default fs
}

declare module 'path' {
  interface PathModule {
    resolve(...paths: string[]): string
  }

  const path: PathModule
  export default path
}

declare const __dirname: string

declare const process: {
  env: Record<string, string | undefined>
}