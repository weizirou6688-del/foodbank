import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import {
  type AdminApplicationRecord,
  installAdminCodeLookupScenario,
  installAdminCodeRedemptionScenario,
} from "./support/adminRedemptionScenario";
import {
  makeInventoryItem,
  makePackageDetail,
} from "./support/data/catalog";
import {
  signInThroughModal,
  waitForStoredAccessToken,
} from "./support/helpers";
import {
  ADMIN_ACCESS_TOKEN,
  localAdminCredentials,
} from "./support/data/session";

const applicationId = "admin-app-1";
const publicUserId = "user-public-1";
const familyEssentialsBoxName = "Family Essentials Box";
const redemptionCode = "ABCD-1234";

function makeWorkspacePackage() {
  return makePackageDetail({
    id: 101,
    name: familyEssentialsBoxName,
    category: "Weekly Support",
    description: "Seven days of pantry basics for a small household.",
    stock: 6,
    threshold: 2,
    applied_count: 12,
    food_bank_id: 1,
    created_at: "2026-01-15T10:00:00.000Z",
    package_items: [
      {
        id: 1,
        inventory_item_id: 1001,
        quantity: 2,
        inventory_item_name: "Rice",
        inventory_item_unit: "bags",
      },
    ],
  });
}

function makeWorkspaceInventory() {
  return [
    makeInventoryItem({
      id: 1001,
      name: "Rice",
      category: "Pantry",
      stock: 24,
      total_stock: 24,
      unit: "bags",
      threshold: 6,
      food_bank_id: 1,
    }),
  ];
}

async function signInToFoodManagement(page: Page) {
  await signInThroughModal(page, localAdminCredentials, { path: "/admin" });
  await waitForStoredAccessToken(page, ADMIN_ACCESS_TOKEN);
  await page.goto("/workspace?section=food");
  await expect(
    page.getByRole("button", { name: "Verify Redemption Code" }),
  ).toBeVisible();
}

async function openRedemptionVerifier(page: Page) {
  await page.getByRole("button", { name: "Verify Redemption Code" }).click();
  const modal = page.locator("#verify-code-editor");
  await expect(modal).toBeVisible();
  return modal;
}

async function lookUpRedemptionCode(modal: Locator, code: string) {
  await modal.getByPlaceholder("Enter redemption code").fill(code);
  await modal.getByRole("button", { name: "Check Code" }).click();
}

async function redeemVerifiedCode(modal: Locator) {
  await modal.getByRole("button", { name: "Redeem Code" }).click();
}

async function expectRedemptionListStatus(
  page: Page,
  applicationId: string,
  statusLabel: string,
) {
  await expect(
    page.locator(`#code-table-body tr[data-id='${applicationId}']`),
  ).toContainText(statusLabel);
}

test("admin can check and redeem a valid code", async ({ appMocks, page }) => {
  const pendingRecord: AdminApplicationRecord = {
    id: applicationId,
    user_id: publicUserId,
    food_bank_id: 1,
    redemption_code: redemptionCode,
    status: "pending",
    week_start: "2026-04-13",
    total_quantity: 1,
    created_at: "2026-04-16T10:00:00.000Z",
    updated_at: "2026-04-16T10:00:00.000Z",
    redeemed_at: null,
    deleted_at: null,
    items: [
      {
        id: 1,
        package_id: 101,
        inventory_item_id: null,
        name: familyEssentialsBoxName,
        quantity: 1,
      },
    ],
    package_name: familyEssentialsBoxName,
    is_voided: false,
    voided_at: null,
  };
  const redeemedRecord: AdminApplicationRecord = {
    ...pendingRecord,
    status: "collected",
    updated_at: "2026-04-23T11:30:00.000Z",
    redeemed_at: "2026-04-23T11:30:00.000Z",
  };

  await installAdminCodeRedemptionScenario(page, appMocks, {
    inventoryItems: makeWorkspaceInventory(),
    packages: [makeWorkspacePackage()],
    applicationRecords: [pendingRecord],
    verifiedCode: pendingRecord.redemption_code,
    redeemedRecord,
  });

  await signInToFoodManagement(page);
  const modal = await openRedemptionVerifier(page);
  await lookUpRedemptionCode(modal, "abcd1234");

  await expect(modal.getByText("Code Valid")).toBeVisible();
  await expect(modal.getByText(familyEssentialsBoxName)).toBeVisible();

  await redeemVerifiedCode(modal);

  await expect(page.getByText("Redemption completed.")).toBeVisible();
  await expectRedemptionListStatus(page, applicationId, "Redeemed");
  await expect(appMocks.logins).toEqual([localAdminCredentials]);
});

test("admin sees a clear error for an unknown code", async ({
  appMocks,
  page,
}) => {
  const pendingRecord: AdminApplicationRecord = {
    id: applicationId,
    user_id: publicUserId,
    food_bank_id: 1,
    redemption_code: redemptionCode,
    status: "pending",
    week_start: "2026-04-13",
    total_quantity: 1,
    created_at: "2026-04-16T10:00:00.000Z",
    updated_at: "2026-04-16T10:00:00.000Z",
    redeemed_at: null,
    deleted_at: null,
    items: [
      {
        id: 1,
        package_id: 101,
        inventory_item_id: null,
        name: familyEssentialsBoxName,
        quantity: 1,
      },
    ],
    package_name: familyEssentialsBoxName,
    is_voided: false,
    voided_at: null,
  };

  await installAdminCodeLookupScenario(page, appMocks, {
    inventoryItems: makeWorkspaceInventory(),
    packages: [makeWorkspacePackage()],
    applicationRecords: [pendingRecord],
  });

  await signInToFoodManagement(page);
  const modal = await openRedemptionVerifier(page);
  await lookUpRedemptionCode(modal, "zzzz9999");

  await expect(modal.getByText(/^Code Not Found$/)).toBeVisible();
  await expect(modal.getByText("Redemption code not found.")).toBeVisible();
  await expect(appMocks.logins).toEqual([localAdminCredentials]);
});
