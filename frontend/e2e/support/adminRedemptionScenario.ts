import type { Page } from "@playwright/test";
import type {
  InventoryItemRecord,
  PackageDetailRecord,
} from "./data/catalog";
import {
  ADMIN_ACCESS_TOKEN,
  localAdminCredentials,
  localAdminUser,
} from "./data/session";
import {
  getAuthorizationToken,
  jsonResponse,
  parseLoginCredentials,
} from "./helpers";
import type { AppMockState } from "./publicSiteScenario";

export type AdminApplicationRecord = {
  id: string;
  user_id: string;
  food_bank_id: number;
  redemption_code: string;
  status: "pending" | "collected" | "expired";
  week_start: string;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  redeemed_at: string | null;
  deleted_at: string | null;
  items: Array<{
    id: number;
    package_id: number | null;
    inventory_item_id: number | null;
    name: string;
    quantity: number;
  }>;
  package_name: string;
  is_voided: boolean;
  voided_at: string | null;
};

type AdminInventoryLotRecord = {
  id: number;
  inventory_item_id: number;
  item_name: string;
  quantity: number;
  received_date: string;
  expiry_date: string;
  batch_reference: string;
  status: "active";
};

type AdminWorkspaceScenarioOptions = {
  inventoryItems: InventoryItemRecord[];
  packages: PackageDetailRecord[];
  applicationRecords: AdminApplicationRecord[];
};

type AdminCodeLookupScenarioOptions = AdminWorkspaceScenarioOptions;

type AdminCodeRedemptionScenarioOptions = AdminWorkspaceScenarioOptions & {
  verifiedCode: string;
  redeemedRecord: AdminApplicationRecord;
};

const cloneInventoryItem = (
  inventoryItem: InventoryItemRecord,
): InventoryItemRecord => ({ ...inventoryItem });

const clonePackageDetail = (
  packageDetail: PackageDetailRecord,
): PackageDetailRecord => ({
  ...packageDetail,
  package_items: packageDetail.package_items.map((item) => ({ ...item })),
});

const cloneApplicationRecord = (
  record: AdminApplicationRecord,
): AdminApplicationRecord => ({
  ...record,
  items: record.items.map((item) => ({ ...item })),
});

function buildInventoryLots(
  inventoryItems: InventoryItemRecord[],
): AdminInventoryLotRecord[] {
  return inventoryItems.map((item, index) => ({
    id: index + 1,
    inventory_item_id: item.id,
    item_name: item.name,
    quantity: item.stock,
    received_date: "2026-04-10",
    expiry_date: "2026-12-31",
    batch_reference: `LOT-${index + 1}`,
    status: "active" as const,
  }));
}

async function installAdminSessionRouteMocks(
  page: Page,
  appMocks: AppMockState,
): Promise<void> {
  await page.route(/\/api\/v1\/auth\/login$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const { email, password } = parseLoginCredentials(route);
    appMocks.logins.push({ email, password });

    if (
      email === localAdminCredentials.email &&
      password === localAdminCredentials.password
    ) {
      await route.fulfill(
        jsonResponse({
          access_token: ADMIN_ACCESS_TOKEN,
          user: localAdminUser,
        }),
      );
      return;
    }

    await route.fulfill(jsonResponse({ detail: "Invalid credentials" }, 401));
  });

  await page.route(/\/api\/v1\/auth\/me$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(jsonResponse(localAdminUser));
  });
}

async function installAdminWorkspaceLoadMocks(
  page: Page,
  options: AdminWorkspaceScenarioOptions,
): Promise<{
  getApplicationRecords: () => AdminApplicationRecord[];
  setApplicationRecords: (records: AdminApplicationRecord[]) => void;
}> {
  let applicationRecords = options.applicationRecords.map(cloneApplicationRecord);
  const inventoryItems = options.inventoryItems.map(cloneInventoryItem);
  const packages = options.packages.map(clonePackageDetail);
  const inventoryLots = buildInventoryLots(inventoryItems).map((lot) => ({
    ...lot,
  }));

  await page.route(/\/api\/v1\/inventory(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(
      jsonResponse({
        items: inventoryItems.map(cloneInventoryItem),
        total: inventoryItems.length,
        page: 1,
        size: inventoryItems.length,
        pages: 1,
      }),
    );
  });

  await page.route(/\/api\/v1\/inventory\/lots(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(jsonResponse(inventoryLots.map((lot) => ({ ...lot }))));
  });

  await page.route(/\/api\/v1\/donations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(jsonResponse([]));
  });

  await page.route(/\/api\/v1\/packages(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    const url = new URL(route.request().url());
    const foodBankId = Number(url.searchParams.get("food_bank_id") ?? "0");
    const rows =
      foodBankId === localAdminUser.food_bank_id
        ? packages.map(clonePackageDetail)
        : [];
    await route.fulfill(jsonResponse(rows));
  });

  await page.route(
    /\/api\/v1\/applications\/admin\/records(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
        await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
        return;
      }

      await route.fulfill(
        jsonResponse({
          items: applicationRecords.map(cloneApplicationRecord),
          total: applicationRecords.length,
          page: 1,
          size: applicationRecords.length,
          pages: 1,
        }),
      );
    },
  );

  return {
    getApplicationRecords: () => applicationRecords.map(cloneApplicationRecord),
    setApplicationRecords: (records) => {
      applicationRecords = records.map(cloneApplicationRecord);
    },
  };
}

export async function installAdminCodeLookupScenario(
  page: Page,
  appMocks: AppMockState,
  options: AdminCodeLookupScenarioOptions,
): Promise<void> {
  await installAdminSessionRouteMocks(page, appMocks);
  await installAdminWorkspaceLoadMocks(page, options);

  await page.route(
    /\/api\/v1\/applications\/admin\/by-code\/.+$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
        await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
        return;
      }

      await route.fulfill(
        jsonResponse({ detail: "Redemption code not found." }, 404),
      );
    },
  );
}

export async function installAdminCodeRedemptionScenario(
  page: Page,
  appMocks: AppMockState,
  options: AdminCodeRedemptionScenarioOptions,
): Promise<void> {
  await installAdminSessionRouteMocks(page, appMocks);
  const workspaceMocks = await installAdminWorkspaceLoadMocks(page, options);

  await page.route(
    /\/api\/v1\/applications\/admin\/by-code\/.+$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
        await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
        return;
      }

      const url = new URL(route.request().url());
      const match = url.pathname.match(
        /^\/api\/v1\/applications\/admin\/by-code\/(.+)$/,
      );
      const requestedCode = decodeURIComponent(match?.[1] ?? "");

      if (requestedCode.toUpperCase() !== options.verifiedCode.toUpperCase()) {
        await route.fulfill(
          jsonResponse({ detail: "Redemption code not found." }, 404),
        );
        return;
      }

      const record = workspaceMocks
        .getApplicationRecords()
        .find(
          (entry) =>
            entry.redemption_code.toUpperCase() === requestedCode.toUpperCase(),
        );

      if (!record) {
        await route.fulfill(
          jsonResponse({ detail: "Redemption code not found." }, 404),
        );
        return;
      }

      await route.fulfill(jsonResponse(record));
    },
  );

  await page.route(
    /\/api\/v1\/applications\/admin\/[^/]+\/redeem$/,
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      if (getAuthorizationToken(route) !== ADMIN_ACCESS_TOKEN) {
        await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
        return;
      }

      workspaceMocks.setApplicationRecords([options.redeemedRecord]);
      await route.fulfill(jsonResponse(cloneApplicationRecord(options.redeemedRecord)));
    },
  );
}
