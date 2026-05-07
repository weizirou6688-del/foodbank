import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { validCredentials } from "./support/data/session";
import { jsonResponse, parseRequestJson } from "./support/helpers";

const forgotPasswordMessage =
  "If this email exists, a verification code has been sent.";
const resetSuccessMessage =
  "Password reset successful. You can now sign in with the new password.";
const expiredCodeMessage =
  "Verification code has expired. Please request a new code.";
const validResetCode = "123456";
const expiredResetCode = "000000";
const wrongResetCode = "654321";
const replacementPassword = "NewPass123!";

type ResetPayload = {
  email?: string;
  verification_code?: string;
  new_password?: string;
};

async function startPasswordReset(page: Page) {
  await page.goto("/food-packages");

  const signInDialog = page.getByRole("dialog", { name: "Welcome Back" });
  await expect(signInDialog).toBeVisible();
  await signInDialog.getByRole("button", { name: "Forgot password?" }).click();

  const forgotDialog = page.getByRole("dialog", { name: "Forgot Password" });
  await expect(forgotDialog).toBeVisible();
  await forgotDialog.locator("#forgot-email").fill(validCredentials.email);
  await forgotDialog
    .locator("form")
    .getByRole("button", { name: "Send Verification Code" })
    .click();

  const resetDialog = page.getByRole("dialog", { name: "Reset Password" });
  await expect(resetDialog).toBeVisible();
  await expect(resetDialog.getByText(forgotPasswordMessage)).toBeVisible();
  return resetDialog;
}

async function submitResetForm(
  resetDialog: Locator,
  verificationCode: string,
  newPassword = replacementPassword,
) {
  await resetDialog.locator("#reset-verificationCode").fill(verificationCode);
  await resetDialog.locator("#reset-newPassword").fill(newPassword);
  await resetDialog.locator("#reset-confirm").fill(newPassword);
  await resetDialog
    .locator("form")
    .getByRole("button", { name: "Reset Password" })
    .click();
}

test("password reset shows an error for a bad verification code", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    await route.fulfill(jsonResponse({ message: forgotPasswordMessage }));
  });

  await page.route("**/api/v1/auth/reset-password", async (route) => {
    const payload = parseRequestJson<ResetPayload>(route);

    expect(payload).toMatchObject({
      email: validCredentials.email,
      verification_code: wrongResetCode,
      new_password: replacementPassword,
    });

    await route.fulfill(
      jsonResponse(
        { detail: "Invalid or expired verification code" },
        401,
      ),
    );
  });

  const resetDialog = await startPasswordReset(page);
  await submitResetForm(resetDialog, wrongResetCode);

  await expect(
    resetDialog.getByText("Invalid or expired verification code"),
  ).toBeVisible();
});

test("password reset shows an expired-code message when the code is too old", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    await route.fulfill(jsonResponse({ message: forgotPasswordMessage }));
  });

  await page.route("**/api/v1/auth/reset-password", async (route) => {
    const payload = parseRequestJson<ResetPayload>(route);

    expect(payload).toMatchObject({
      email: validCredentials.email,
      verification_code: expiredResetCode,
      new_password: replacementPassword,
    });

    await route.fulfill(jsonResponse({ detail: expiredCodeMessage }, 401));
  });

  const resetDialog = await startPasswordReset(page);
  await submitResetForm(resetDialog, expiredResetCode);

  await expect(resetDialog.getByText(expiredCodeMessage)).toBeVisible();
});

test("password reset returns the user to sign in after a valid code", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/forgot-password", async (route) => {
    await route.fulfill(jsonResponse({ message: forgotPasswordMessage }));
  });

  await page.route("**/api/v1/auth/reset-password", async (route) => {
    const payload = parseRequestJson<ResetPayload>(route);

    expect(payload).toMatchObject({
      email: validCredentials.email,
      verification_code: validResetCode,
      new_password: replacementPassword,
    });

    await route.fulfill(jsonResponse({ message: resetSuccessMessage }));
  });

  const resetDialog = await startPasswordReset(page);
  await submitResetForm(resetDialog, validResetCode);

  const signInDialog = page.getByRole("dialog", { name: "Welcome Back" });
  await expect(signInDialog).toBeVisible();
  await expect(signInDialog.getByText(resetSuccessMessage)).toBeVisible();
  await expect(signInDialog.locator("#signin-email")).toHaveValue(
    validCredentials.email,
  );
});
