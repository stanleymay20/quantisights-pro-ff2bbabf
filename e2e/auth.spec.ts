import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("landing page loads and shows login CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Quantivis/i);
    // Should have a way to navigate to login
    const loginLink = page.getByRole("link", { name: /log\s*in|sign\s*in|get started/i }).first();
    await expect(loginLink).toBeVisible();
  });

  test("login page renders form fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i }).first()).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).first().fill("invalid@test.com");
    await page.getByLabel(/password/i).first().fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();
    // Should show an error message
    await expect(
      page.getByText(/invalid|error|incorrect|failed/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("register page renders form fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("forgot password page exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test("unauthenticated user is redirected from protected routes", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to login or show login page
    await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
  });

  test("Google OAuth button is present on login", async ({ page }) => {
    await page.goto("/login");
    const googleBtn = page.getByRole("button", { name: /google/i }).first();
    await expect(googleBtn).toBeVisible();
  });
});
