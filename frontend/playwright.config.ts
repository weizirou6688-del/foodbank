import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const DEV_SERVER_PORT = 4173;
const BASE_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`;
const PROJECT_ROOT = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    colorScheme: "light",
    locale: "en-GB",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${DEV_SERVER_PORT} --strictPort`,
    cwd: PROJECT_ROOT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
