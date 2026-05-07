import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

const PHOTO_PLACEHOLDER = readFileSync(
  new URL("../assets/photo-placeholder.svg", import.meta.url),
  "utf8",
);

const MAP_TILE_PLACEHOLDER = readFileSync(
  new URL("../assets/map-tile-placeholder.svg", import.meta.url),
  "utf8",
);

const imageResponse = (body: string) => ({
  status: 200,
  contentType: "image/svg+xml",
  body,
});

export async function installPublicSiteAssetMocks(page: Page): Promise<void> {
  await page.route("https://images.unsplash.com/**", async (route) => {
    await route.fulfill(imageResponse(PHOTO_PLACEHOLDER));
  });

  await page.route(/https:\/\/[a-z]\.tile\.openstreetmap\.org\/.*/, async (route) => {
    await route.fulfill(imageResponse(MAP_TILE_PLACEHOLDER));
  });
}
