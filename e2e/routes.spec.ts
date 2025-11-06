import { test, expect } from "@playwright/test";
import { setupE2eTest, signUp, verifyDashboardReached } from "./utils";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeEach(setupE2eTest);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});

test.describe("Unauthenticated Routes", () => {
  test("Welcome page loads", async ({ page }) => {
    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
    const loginButton = page.locator("button", { hasText: "Login" });
    await expect(loginButton).toHaveCount(1);
    const signUpButton = page.locator("button", { hasText: "Sign up" });
    await expect(signUpButton).toHaveCount(1);
  });

  test("/dashboard route is protected", async ({ page }) => {
    // Go to the dashboard without logging in
    await page.goto("http://localhost:5173/Board-Board/dashboard");

    // Verify that the user was returned to the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("404 route works", async ({ page }) => {
    // Go to a non-existant page
    await page.goto("http://localhost:5173/Board-Board/test");

    // Verify that the user was returned to the welcome page
    const errorMessage = page.locator("h1", { hasText: "404" });
    await expect(errorMessage).toHaveCount(1);

    // Return to the welcome page
    const homeButton = page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });
});

test.describe("Authenticated Routes", () => {
  const userName = "Testy";
  const userEmail = "test@test.com";
  const userPassword = "testtest";

  test("Signed up user can access the Dashboard page", async ({ page }) => {
    // Sign up
    await signUp(page, userEmail, userPassword, userName);
  });

  test("Signed up user can access the Settings page", async ({ page }) => {
    // Sign up
    await signUp(page, userEmail, userPassword, userName);

    // Open the user dropdown
    const userButton = page.locator("button.navbar-right-button");
    await expect(userButton).toHaveCount(1);
    userButton.click();

    // Verify the settings button exists and click it
    const settingsButton = page.locator("a", { hasText: "Settings" });
    await expect(settingsButton).toBeVisible();
    await expect(settingsButton).toHaveCount(1);
    await settingsButton.click();

    // Verify that the settings page was reached
    const settingsPageHeader = page.locator("h1", { hasText: "Settings" });
    await expect(settingsPageHeader).toHaveCount(1);

    // Return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Verify that the dashboard was returned to
    await verifyDashboardReached(page);
  });

  test("Signed up user can access the Friends page", async ({ page }) => {
    // Sign up
    await signUp(page, userEmail, userPassword, userName);

    // Open the user dropdown
    const userButton = page.locator("button.navbar-right-button");
    await expect(userButton).toHaveCount(1);
    userButton.click();

    // Verify the friends button exists and click it
    const settingsButton = page.locator("a", { hasText: "Friends" });
    await expect(settingsButton).toBeVisible();
    await expect(settingsButton).toHaveCount(1);
    await settingsButton.click();

    // Verify that the friends page was reached
    const friendsPageHeader = page.locator("h1", { hasText: "Friends" });
    await expect(friendsPageHeader).toHaveCount(1);

    // Return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Verify that the dashboard was returned to
    await verifyDashboardReached(page);
  });
});
