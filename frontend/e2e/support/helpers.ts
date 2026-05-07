import { expect, type Page, type Route } from "@playwright/test";

export type LoginCredentials = {
  email: string;
  password: string;
};

export const jsonResponse = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

export const parseRequestJson = <T>(route: Route): T => {
  try {
    return route.request().postDataJSON() as T;
  } catch {
    return {} as T;
  }
};

export const getAuthorizationToken = (route: Route) => {
  const header = route.request().headers().authorization ?? "";
  return header.replace(/^Bearer\s+/i, "").trim();
};

export const parseLoginCredentials = (route: Route): LoginCredentials => {
  const payload = parseRequestJson<{ email?: string; password?: string }>(route);
  return {
    email: String(payload.email ?? ""),
    password: String(payload.password ?? ""),
  };
};

export async function searchForFoodBanks(
  page: Page,
  postcode = "SW1A 1AA",
  options: {
    placeholder?: string;
    submitLabel?: string | RegExp;
    resultCount?: number;
    resultText?: string | RegExp | null;
  } = {},
): Promise<void> {
  await page
    .getByPlaceholder(options.placeholder ?? "e.g., SW1A 1AA")
    .fill(postcode);
  await page
    .getByRole("button", { name: options.submitLabel ?? "Find Food Banks" })
    .click();

  const expectedResultText =
    options.resultText ??
    (
      typeof options.resultCount === "number"
        ? `Found ${options.resultCount} result(s) near ${postcode}.`
        : null
    );

  if (expectedResultText !== null) {
    await expect(
      page.getByText(expectedResultText),
    ).toBeVisible();
  }
}

export async function signInThroughModal(
  page: Page,
  credentials: LoginCredentials,
  options: {
    dialogName?: string;
    path?: string;
    submitLabel?: string;
  } = {},
): Promise<void> {
  if (options.path) {
    await page.goto(options.path);
  }

  const dialog = page.getByRole("dialog", {
    name: options.dialogName ?? "Welcome Back",
  });
  await expect(dialog).toBeVisible();
  await dialog.locator("#signin-email").fill(credentials.email);
  await dialog.locator("#signin-password").fill(credentials.password);
  await dialog
    .locator("form")
    .getByRole("button", { name: options.submitLabel ?? "Sign In" })
    .click();
}

export async function waitForStoredAccessToken(
  page: Page,
  expectedToken: string,
  storageKey = "fba-auth-storage",
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          return "";
        }
        try {
          return JSON.parse(raw).state?.accessToken ?? "";
        } catch {
          return "";
        }
      }, storageKey),
    )
    .toBe(expectedToken);
}
