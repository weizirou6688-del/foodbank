import type { Page } from "@playwright/test";
import { DEFAULT_WEEK_START, FIXED_NOW_ISO } from "./data/common";
import type {
  InventoryItemRecord,
  PackageDetailRecord,
  PackageSummaryRecord,
} from "./data/catalog";
import {
  type ExternalFoodBankEntry,
  type FoodBankDirectoryEntry,
  geocodeResult,
  listExternalFoodBankFeed,
  listFoodBankDirectory,
} from "./data/network";
import {
  clonePublicImpactMetrics,
  type MockPublicImpactMetric,
} from "./data/publicImpact";
import {
  PUBLIC_ACCESS_TOKEN,
  publicUser,
  validCredentials,
} from "./data/session";
import {
  getAuthorizationToken,
  jsonResponse,
  parseLoginCredentials,
  parseRequestJson,
} from "./helpers";

type RequestPayload = Record<string, unknown>;

type ApplicationListItem = {
  id: string;
  user_id: string;
  food_bank_id: number;
  redemption_code: string;
  status: "pending" | "collected" | "expired";
  week_start: string;
  total_quantity: number;
  created_at: string;
  updated_at: string;
  redeemed_at?: string | null;
  deleted_at?: string | null;
};

type PublicDirectoryOptions = {
  foodBanks?: FoodBankDirectoryEntry[];
  geocode?: { lat: number; lng: number; source: string };
  externalFeed?: ExternalFoodBankEntry[];
};

export type AppMockState = {
  applications: RequestPayload[];
  cashDonations: RequestPayload[];
  goodsDonations: RequestPayload[];
  logins: Array<{ email: string; password: string }>;
};

type ApplicationMockCatalogue = {
  foodBankId: number;
  packages: PackageDetailRecord[];
  inventoryItems: InventoryItemRecord[];
};

type ApplicationMocksOptions = {
  catalogues: ApplicationMockCatalogue[];
};

type CashDonationMocksOptions = PublicDirectoryOptions;

type GoodsDonationMocksOptions = PublicDirectoryOptions;

type PublicImpactMocksOptions = {
  impactMetrics?: MockPublicImpactMetric[];
};

const cloneFoodBanks = (foodBanks: FoodBankDirectoryEntry[]) =>
  foodBanks.map((foodBank) => ({ ...foodBank }));

const cloneExternalFeed = (externalFeed: ExternalFoodBankEntry[]) =>
  externalFeed.map((entry) => ({
    ...entry,
    needs: [...entry.needs],
  }));

const clonePackageDetail = (
  packageDetail: PackageDetailRecord,
): PackageDetailRecord => ({
  ...packageDetail,
  package_items: packageDetail.package_items.map((item) => ({ ...item })),
});

const cloneInventoryItem = (
  inventoryItem: InventoryItemRecord,
): InventoryItemRecord => ({ ...inventoryItem });

const cloneApplication = (
  application: ApplicationListItem,
): ApplicationListItem => ({ ...application });

const buildFoodBankResponse = (foodBanks: FoodBankDirectoryEntry[]) => ({
  items: cloneFoodBanks(foodBanks),
  total: foodBanks.length,
  page: 1,
  size: foodBanks.length,
  pages: 1,
});

const buildInventoryResponse = (inventoryItems: InventoryItemRecord[]) => ({
  items: inventoryItems.map(cloneInventoryItem),
  total: inventoryItems.length,
  page: 1,
  size: inventoryItems.length || 1,
  pages: inventoryItems.length > 0 ? 1 : 0,
});

const buildApplicationResponse = (items: ApplicationListItem[]) => ({
  items: items.map(cloneApplication),
  total: items.length,
  page: 1,
  size: items.length || 1,
  pages: items.length > 0 ? 1 : 0,
});

const buildPackageSummary = (
  packageDetail: PackageDetailRecord,
): PackageSummaryRecord => {
  return {
    id: packageDetail.id,
    name: packageDetail.name,
    category: packageDetail.category,
    description: packageDetail.description,
    stock: packageDetail.stock,
    threshold: packageDetail.threshold,
    applied_count: packageDetail.applied_count,
    image_url: packageDetail.image_url,
    food_bank_id: packageDetail.food_bank_id,
    is_active: packageDetail.is_active,
    created_at: packageDetail.created_at,
  };
};

const findCatalogue = (
  catalogues: ApplicationMockCatalogue[],
  foodBankId: number,
) => catalogues.find((catalogue) => catalogue.foodBankId === foodBankId);

const findPackageDetail = (
  catalogues: ApplicationMockCatalogue[],
  packageId: number,
) => {
  for (const catalogue of catalogues) {
    const packageDetail = catalogue.packages.find(
      (entry) => entry.id === packageId,
    );
    if (packageDetail) {
      return clonePackageDetail(packageDetail);
    }
  }

  return undefined;
};

function buildCreatedApplication(
  payload: RequestPayload,
  count: number,
): ApplicationListItem {
  const itemSelections = Array.isArray(payload.items)
    ? (payload.items as Array<Record<string, unknown>>)
    : [];

  return {
    id: `app-${count}`,
    user_id: publicUser.id,
    food_bank_id: Number(payload.food_bank_id ?? 0),
    redemption_code: `FB-${1000 + count}`,
    status: "pending",
    week_start: String(payload.week_start ?? DEFAULT_WEEK_START),
    total_quantity: itemSelections.reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0,
    ),
    created_at: FIXED_NOW_ISO,
    updated_at: FIXED_NOW_ISO,
    redeemed_at: null,
    deleted_at: null,
  };
}

function buildCashDonationResponse(payload: RequestPayload, count: number) {
  const isMonthly = payload.donation_frequency === "monthly";

  return {
    id: `cash-${count}`,
    donor_name: payload.donor_name ?? null,
    donor_type: payload.donor_type ?? "individual",
    donor_email: payload.donor_email,
    food_bank_id: payload.food_bank_id ?? null,
    amount_pence: payload.amount_pence,
    donation_frequency: payload.donation_frequency ?? "one_time",
    payment_reference: `PAY-${1000 + count}`,
    subscription_reference: isMonthly ? `SUB-${1000 + count}` : null,
    card_last4: payload.card_last4 ?? null,
    next_charge_date: isMonthly ? "2026-05-16" : null,
    status: "completed",
    created_at: FIXED_NOW_ISO,
  };
}

function buildGoodsDonationResponse(
  payload: RequestPayload,
  count: number,
  foodBanks: FoodBankDirectoryEntry[],
) {
  const foodBankId = Number(payload.food_bank_id ?? 0);
  const selectedFoodBank = foodBanks.find((entry) => entry.id === foodBankId);
  const items = Array.isArray(payload.items)
    ? (payload.items as Array<Record<string, unknown>>)
    : [];

  return {
    id: `goods-${count}`,
    donor_user_id: null,
    food_bank_id: payload.food_bank_id ?? null,
    food_bank_name: payload.food_bank_name ?? selectedFoodBank?.name ?? null,
    food_bank_address:
      payload.food_bank_address ?? selectedFoodBank?.address ?? null,
    donor_name: payload.donor_name,
    donor_type: payload.donor_type ?? "individual",
    donor_email: payload.donor_email,
    donor_phone: payload.donor_phone,
    postcode: payload.postcode ?? null,
    pickup_date: payload.pickup_date ?? null,
    item_condition: payload.item_condition ?? null,
    estimated_quantity: payload.estimated_quantity ?? null,
    notes: payload.notes ?? null,
    status: "pending",
    created_at: FIXED_NOW_ISO,
    items: items.map((item, index) => ({
      id: index + 1,
      donation_id: `goods-${count}`,
      item_name: item.item_name,
      quantity: item.quantity,
      expiry_date: item.expiry_date ?? null,
    })),
  };
}

export function createPublicSiteMockState(): AppMockState {
  return {
    applications: [],
    cashDonations: [],
    goodsDonations: [],
    logins: [],
  };
}

export async function installPublicImpactMocks(
  page: Page,
  options: PublicImpactMocksOptions = {},
): Promise<void> {
  const impactMetrics = clonePublicImpactMetrics(options.impactMetrics);

  await page.route(/\/api\/v1\/stats\/public-impact(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill(jsonResponse({ impactMetrics }));
  });
}

export async function installFoodBankSearchMocks(
  page: Page,
  options: PublicDirectoryOptions = {},
): Promise<void> {
  const foodBanks = cloneFoodBanks(options.foodBanks ?? listFoodBankDirectory());
  const externalFeed = cloneExternalFeed(
    options.externalFeed ?? listExternalFoodBankFeed(),
  );
  const geocode = options.geocode ?? geocodeResult;

  await page.route(/\/api\/v1\/food-banks\/geocode(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill(jsonResponse(geocode));
  });

  await page.route(
    /\/api\/v1\/food-banks\/external-feed(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      await route.fulfill(jsonResponse(externalFeed));
    },
  );

  await page.route(/\/api\/v1\/food-banks(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill(jsonResponse(buildFoodBankResponse(foodBanks)));
  });
}

export async function installApplicationMocks(
  page: Page,
  appMocks: AppMockState,
  options: ApplicationMocksOptions,
): Promise<void> {
  let userApplications: ApplicationListItem[] = [];

  await page.route(/\/api\/v1\/auth\/login$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const { email, password } = parseLoginCredentials(route);
    appMocks.logins.push({ email, password });

    if (email === validCredentials.email && password === validCredentials.password) {
      await route.fulfill(
        jsonResponse({
          access_token: PUBLIC_ACCESS_TOKEN,
          user: publicUser,
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

    if (getAuthorizationToken(route) !== PUBLIC_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(jsonResponse(publicUser));
  });

  await page.route(
    /\/api\/v1\/food-banks\/\d+\/packages(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      const url = new URL(route.request().url());
      const match = url.pathname.match(/^\/api\/v1\/food-banks\/(\d+)\/packages$/);
      const foodBankId = Number(match?.[1] ?? 0);
      const catalogue = findCatalogue(options.catalogues, foodBankId);
      const packageSummaries = (catalogue?.packages ?? []).map(buildPackageSummary);
      await route.fulfill(jsonResponse(packageSummaries));
    },
  );

  await page.route(
    /\/api\/v1\/food-banks\/\d+\/inventory-items(?:\?.*)?$/,
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }

      const url = new URL(route.request().url());
      const match = url.pathname.match(
        /^\/api\/v1\/food-banks\/(\d+)\/inventory-items$/,
      );
      const foodBankId = Number(match?.[1] ?? 0);
      const inventoryItems =
        findCatalogue(options.catalogues, foodBankId)?.inventoryItems ?? [];
      await route.fulfill(jsonResponse(buildInventoryResponse(inventoryItems)));
    },
  );

  await page.route(/\/api\/v1\/packages\/\d+(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const match = url.pathname.match(/^\/api\/v1\/packages\/(\d+)$/);
    const packageId = Number(match?.[1] ?? 0);
    const packageDetail = findPackageDetail(options.catalogues, packageId);

    if (!packageDetail) {
      await route.fulfill(jsonResponse({ detail: "Package not found" }, 404));
      return;
    }

    await route.fulfill(jsonResponse(packageDetail));
  });

  await page.route(/\/api\/v1\/applications\/my$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== PUBLIC_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    await route.fulfill(jsonResponse(buildApplicationResponse(userApplications)));
  });

  await page.route(/\/api\/v1\/applications$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    if (getAuthorizationToken(route) !== PUBLIC_ACCESS_TOKEN) {
      await route.fulfill(jsonResponse({ detail: "Unauthorized" }, 401));
      return;
    }

    const payload = parseRequestJson<RequestPayload>(route);
    appMocks.applications.push(payload);
    const createdApplication = buildCreatedApplication(
      payload,
      appMocks.applications.length,
    );
    userApplications = [...userApplications, createdApplication];
    await route.fulfill(jsonResponse(createdApplication, 201));
  });
}

export async function installCashDonationMocks(
  page: Page,
  appMocks: AppMockState,
  options: CashDonationMocksOptions = {},
): Promise<void> {
  const foodBanks = cloneFoodBanks(options.foodBanks ?? listFoodBankDirectory());

  await page.route(/\/api\/v1\/food-banks(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill(jsonResponse(buildFoodBankResponse(foodBanks)));
  });

  await page.route(/\/api\/v1\/donations\/cash$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const payload = parseRequestJson<RequestPayload>(route);
    appMocks.cashDonations.push(payload);
    await route.fulfill(
      jsonResponse(
        buildCashDonationResponse(payload, appMocks.cashDonations.length),
        201,
      ),
    );
  });
}

export async function installGoodsDonationMocks(
  page: Page,
  appMocks: AppMockState,
  options: GoodsDonationMocksOptions = {},
): Promise<void> {
  const foodBanks = cloneFoodBanks(options.foodBanks ?? listFoodBankDirectory());

  await installFoodBankSearchMocks(page, {
    foodBanks,
    geocode: options.geocode,
    externalFeed: options.externalFeed,
  });

  await page.route(/\/api\/v1\/donations\/goods$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const payload = parseRequestJson<RequestPayload>(route);
    appMocks.goodsDonations.push(payload);
    await route.fulfill(
      jsonResponse(
        buildGoodsDonationResponse(
          payload,
          appMocks.goodsDonations.length,
          foodBanks,
        ),
        201,
      ),
    );
  });
}
