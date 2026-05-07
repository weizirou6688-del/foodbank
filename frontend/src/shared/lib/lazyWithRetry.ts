type ModuleImporter<T> = () => Promise<T>;
const RETRY_PREFIX = "lazy-import-retry:";
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");
const shouldReloadAfterImportFailure = (error: unknown) => {
  const message = getErrorMessage(error);
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
};
export function lazyWithRetry<T>(
  key: string,
  importer: ModuleImporter<T>,
): ModuleImporter<T> {
  return async () => {
    const retryKey = `${RETRY_PREFIX}${key}`;
    try {
      const module = await importer();
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(retryKey);
      }
      return module;
    } catch (error) {
      if (
        // Vite 在本地开发时偶尔会留下过期 chunk URL,每个路由键最多重载一次以避免死循环
        import.meta.env.DEV &&
        typeof window !== "undefined" &&
        shouldReloadAfterImportFailure(error) &&
        window.sessionStorage.getItem(retryKey) !== "1"
      ) {
        window.sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        return new Promise<T>(() => {});
      }
      throw error;
    }
  };
}
