import { expect, test } from "./support/fixtures";
import { searchForFoodBanks } from "./support/helpers";
import {
  installFoodBankSearchMocks,
  installPublicImpactMocks,
} from "./support/publicSiteScenario";

const jubileePostcode = "SW1A 1AA";

const jubileeBank = {
  id: 1,
  name: "Jubilee Storehouse",
  address: "12 Bridge Street, London SW1A 1AA",
  notification_email: "jubilee-notify@foodbank.test",
  has_local_admin_account: true,
  lat: 51.5009,
  lng: -0.1412,
  phone: "020 7946 0011",
  email: "hello@jubilee.foodbank.test",
  url: "https://jubilee.foodbank.test",
  systemMatched: true,
};

const snapshotOptions = {
  animations: "disabled" as const,
  fullPage: true,
};

test("home page @visual", async ({ page }) => {
  await installPublicImpactMocks(page, {
    impactMetrics: [
      {
        key: "units",
        change: "+1.0%",
        value: "120",
        label: "Food Units Distributed",
        note: "This Month",
        positive: true,
      },
    ],
  });

  await page.goto("/home");

  await expect(
    page.getByRole("button", { name: "Find a Food Bank" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("home-page.png", snapshotOptions);
});

test("find food bank results @visual", async ({ page }) => {
  await installFoodBankSearchMocks(page, {
    foodBanks: [jubileeBank],
    externalFeed: [],
  });

  await page.goto("/find-foodbank");
  await searchForFoodBanks(page, jubileePostcode, {
    resultCount: 1,
  });

  await expect(
    page.getByRole("heading", { name: "Nearby food banks" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot(
    "find-foodbank-results.png",
    snapshotOptions,
  );
});

test("food packages gate state @visual", async ({ page }) => {
  await page.goto("/food-packages");

  await expect(page.getByRole("dialog", { name: "Welcome Back" })).toBeVisible();
  await expect(page).toHaveScreenshot("food-packages-gate.png", snapshotOptions);
});
