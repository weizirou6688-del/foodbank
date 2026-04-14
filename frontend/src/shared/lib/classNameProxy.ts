export function createClassNameProxy(prefix: string) {
  return new Proxy({} as Record<string, string>, {
    get: (_target, key) => `${prefix}-${String(key)}`,
  })
}
