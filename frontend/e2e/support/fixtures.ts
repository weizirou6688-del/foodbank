import { expect, test as base } from "@playwright/test";
import { installPublicSiteAssetMocks } from "./publicSiteAssets";
import {
  type AppMockState,
  createPublicSiteMockState,
} from "./publicSiteScenario";

export const test = base.extend<{ appMocks: AppMockState }>({
  appMocks: [
    async ({ page }, use) => {
      await installPublicSiteAssetMocks(page);
      const appMocks = createPublicSiteMockState();
      await use(appMocks);
    },
    { auto: true },
  ],
});

export { expect };
