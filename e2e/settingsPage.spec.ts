import { test, expect } from "@playwright/test";
import { setupE2eTest, signUp } from "./utils";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeEach(setupE2eTest);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});

test.describe("Settings Page", () => {
  const userName = "Testy";
  const userEmail = "test@test.com";
  const userPassword = "testtest";

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
  });

  test("User can update and save their username", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("User can update their username without saving and undo the change", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("User can update and save their color mode", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("User can update their color mode without saving and undo the change", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("User sees unsaved changes modal when clicking back button with unsaved changes", async ({
    page,
  }) => {
    expect(page).toBe(false);
  });

  test("Changes are undone if user returns to the dashboard without saving the changes", async ({
    page,
  }) => {
    expect(page).toBe(false);
  });

  test("Ability to undo changes disappears if username changes are manually undone", async ({
    page,
  }) => {
    expect(page).toBe(false);
  });

  test("Ability to undo changes disappears if color mode changes are manually undone", async ({
    page,
  }) => {
    expect(page).toBe(false);
  });

  test("Username changes are saved between sessions", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("Color mode changes are saved between sessions", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("Short usernames show error text", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("Short usernames cannot be saved", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("Account can be deleted", async ({ page }) => {
    expect(page).toBe(false);
  });

  test("Account deletion modal can be closed without deleting the account", async ({ page }) => {
    expect(page).toBe(false);
  });
});
