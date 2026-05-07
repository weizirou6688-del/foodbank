import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import {
  makePackageDetail,
} from "./support/data/catalog";
import { validCredentials } from "./support/data/session";
import { searchForFoodBanks, signInThroughModal } from "./support/helpers";
import {
  installApplicationMocks,
  installCashDonationMocks,
  installFoodBankSearchMocks,
  installGoodsDonationMocks,
} from "./support/publicSiteScenario";

const jubileePostcode = "SW1A 1AA";
const familyEssentialsBoxName = "Family Essentials Box";

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

async function fillCashDonationForm(page: Page) {
  await expect(page.locator("#foodBank")).toBeVisible();
  await page.locator("#foodBank").selectOption("1");
  await page.locator("#donorName").fill("Jamie Donor");
  await page.locator("#email").fill("jamie@example.com");
  await page.locator("#customAmount").fill("25");
  await page.locator("#cardNumber").fill("4242424242424242");
  await page.locator("#expiryDate").fill("12/99");
  await page.locator("#securityCode").fill("123");
}

async function fillGoodsDonationForm(page: Page) {
  const bankCard = page
    .getByRole("button")
    .filter({ has: page.getByText("Jubilee Storehouse") })
    .first();

  await bankCard.click();
  await expect(page.getByText("Donating to:")).toBeVisible();
  await page.locator("#donor-name").fill("Casey Donor");
  await page.locator("#donor-email").fill("casey@example.com");
  await page.locator("#donor-phone").fill("07123 456789");
  await page.locator("#pickup-date").fill("31/12/2026");
  await page
    .locator("#donation-items")
    .fill("Canned beans and pasta for a family pantry donation.");
  await page.locator("#item-condition").selectOption("New or unopened");
  await page.locator("#estimated-quantity").fill("2 bags");
  await page
    .locator("#special-notes")
    .fill("Please ring the bell when you arrive.");
}

test("find food bank to food package application flow @smoke", async ({
  appMocks,
  page,
}) => {
  await installFoodBankSearchMocks(page, {
    foodBanks: [jubileeBank],
    externalFeed: [],
  });
  await installApplicationMocks(page, appMocks, {
    catalogues: [
      {
        foodBankId: 1,
        packages: [
          makePackageDetail({
            id: 101,
            name: familyEssentialsBoxName,
            category: "Weekly Support",
            description: "Seven days of pantry basics for a small household.",
            stock: 6,
            threshold: 2,
            applied_count: 12,
            food_bank_id: 1,
            package_items: [
              {
                id: 1,
                inventory_item_id: 1001,
                quantity: 2,
                inventory_item_name: "Rice",
                inventory_item_unit: "bags",
              },
            ],
          }),
        ],
        inventoryItems: [],
      },
    ],
  });

  await page.goto("/find-foodbank");
  await searchForFoodBanks(page, jubileePostcode, {
    resultCount: 1,
  });
  await page.getByRole("button", { name: /View packages/i }).click();
  await signInThroughModal(page, validCredentials);

  await expect(page).toHaveURL(/\/food-packages$/);
  await expect(
    page.getByRole("heading", { name: familyEssentialsBoxName }),
  ).toBeVisible();

  const packageCard = page
    .locator('div[class*="packageCard"]')
    .filter({
      has: page.getByRole("heading", { name: familyEssentialsBoxName }),
    });
  await packageCard.locator("button").last().click();
  await page.getByRole("button", { name: "Submit Application" }).click();

  await expect(
    page.getByRole("heading", { name: "Application Successful" }),
  ).toBeVisible();
  await expect(page.getByText("Pending collection")).toBeVisible();
  // The redemption code is surfaced in both the success state and the inline
  // history panel, so this smoke check intentionally guards both render paths.
  await expect(page.getByText("FB-1001")).toHaveCount(2);
  await expect(appMocks.logins).toHaveLength(1);
  await expect(appMocks.applications).toHaveLength(1);
  await expect(appMocks.applications[0]).toMatchObject({
    food_bank_id: 1,
    items: [{ package_id: 101, quantity: 1 }],
  });
});

test("cash donation submission flow @smoke", async ({ appMocks, page }) => {
  await installCashDonationMocks(page, appMocks, {
    foodBanks: [jubileeBank],
  });
  await page.goto("/donate/cash?type=monthly#donate-form");

  await fillCashDonationForm(page);
  await page.getByRole("button", { name: "Set Up Monthly Donation" }).click();

  await expect(
    page.getByRole("status"),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("SUB-1001");
  await expect(appMocks.cashDonations).toHaveLength(1);
  await expect(appMocks.cashDonations[0]).toMatchObject({
    donor_name: "Jamie Donor",
    donor_email: "jamie@example.com",
    food_bank_id: 1,
    amount_pence: 2500,
    donation_frequency: "monthly",
    card_last4: "4242",
  });
});

test("goods donation submission flow @smoke", async ({ appMocks, page }) => {
  await installGoodsDonationMocks(page, appMocks, {
    foodBanks: [jubileeBank],
    externalFeed: [],
  });
  await page.goto("/donate/goods");

  await searchForFoodBanks(page, jubileePostcode, {
    placeholder: "Enter Postcode",
    submitLabel: "Search",
  });
  await expect(
    page.getByRole("heading", { name: /Select a Food Bank/i }),
  ).toBeVisible();

  await fillGoodsDonationForm(page);
  await page.getByRole("button", { name: "Send Donation Request" }).click();

  await expect(
    page.getByText(
      /Thanks, Casey Donor\. Your donation request has been sent to Jubilee Storehouse\./,
    ),
  ).toBeVisible();
  await expect(appMocks.goodsDonations).toHaveLength(1);
  await expect(appMocks.goodsDonations[0]).toMatchObject({
    donor_name: "Casey Donor",
    donor_email: "casey@example.com",
    donor_phone: "07123 456789",
    food_bank_id: 1,
    food_bank_name: "Jubilee Storehouse",
    pickup_date: "2026-12-31",
    item_condition: "New or unopened",
    estimated_quantity: "2 bags",
    notes: "Please ring the bell when you arrive.",
    items: [
      {
        item_name: "Canned beans and pasta for a family pantry donation.",
        quantity: 2,
      },
    ],
  });
});
