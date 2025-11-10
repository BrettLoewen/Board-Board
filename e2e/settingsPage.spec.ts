import { test, expect } from "@playwright/test";
import { setupE2eTest, signUpToSettingsPage, navigateToSettingsPageFromDashboard } from "./utils";

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
    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);
  });

  test("User can update and save their username", async ({ page }) => {
    const newUsername = "Tester";

    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Enter the new username
    let usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
    await usernameInput.fill(newUsername);

    // Save the new username
    const saveButton = page.locator("button", { hasText: "Save Changes" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toHaveCount(1);
    await saveButton.click();

    // Return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Return to the settings page
    await navigateToSettingsPageFromDashboard(page);

    // Verify that the new username is being used as the placeholder (verify that the new username was saved)
    usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", newUsername);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
  });

  test("User can update their username without saving and undo the change", async ({ page }) => {
    const newUsername = "Tester";

    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Enter the new username
    const usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
    await usernameInput.fill(newUsername);

    // Exit out of the input field.
    // This will validate the new username and enable the undo button.
    // The code overrides the default behaviour to submit on Enter, so this is fine.
    await page.keyboard.press("Enter");

    // Undo the change
    const undoButton = page.locator("button", { hasText: "Undo Changes" });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toHaveCount(1);
    await undoButton.click();

    // Verify that the active placeholder is still the old name (the new username was not saved).
    // Verify that the undo button reset the field back to the starting state (empty).
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toHaveValue("");
  });

  test("User can update and save their color mode", async ({ page }) => {
    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Store the current color mode of the app.
    // The tests are configured to always start in light mode.
    const html = page.locator("html");
    const initialMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );

    // Open the color mode dropdown.
    // Also verify it started in System mode.
    const colorModeDropdown = page.getByRole("combobox", { name: "Change Theme" });
    await expect(colorModeDropdown).toHaveText("System");
    await expect(colorModeDropdown).toHaveCount(1);
    await colorModeDropdown.click();

    // Select the Dark mode option to switch to Dark mode
    const darkModeOption = page.getByRole("option", { name: "Dark" });
    await expect(darkModeOption).toHaveCount(1);
    await darkModeOption.click();

    // Verify that the app is now using Dark mode
    const newMode = await html.evaluate((el) => (el.classList.contains("dark") ? "dark" : "light"));
    await expect(newMode).not.toBe(initialMode);

    // Save the new color mode
    const saveButton = page.locator("button", { hasText: "Save Changes" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toHaveCount(1);
    await saveButton.click();

    // Return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Verify that the app is still using Dark mode
    const dashboardMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );
    await expect(dashboardMode).not.toBe(initialMode);

    // Return to the settings page
    await navigateToSettingsPageFromDashboard(page);

    // Verify that the dropdown's new initial value is for Dark mode.
    await expect(colorModeDropdown).toHaveText("Dark");
  });

  test("User can update their color mode without saving and undo the change", async ({ page }) => {
    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Store the current color mode of the app.
    // The tests are configured to always start in light mode.
    const html = page.locator("html");
    const initialMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );

    // Open the color mode dropdown.
    // Also verify it started in System mode.
    const colorModeDropdown = page.getByRole("combobox", { name: "Change Theme" });
    await expect(colorModeDropdown).toHaveText("System");
    await expect(colorModeDropdown).toHaveCount(1);
    await colorModeDropdown.click();

    // Select the Dark mode option to switch to Dark mode
    const darkModeOption = page.getByRole("option", { name: "Dark" });
    await expect(darkModeOption).toHaveCount(1);
    await darkModeOption.click();

    // Verify that the app is now using Dark mode
    const newMode = await html.evaluate((el) => (el.classList.contains("dark") ? "dark" : "light"));
    await expect(newMode).not.toBe(initialMode);

    // Undo the change
    const undoButton = page.locator("button", { hasText: "Undo Changes" });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toHaveCount(1);
    await undoButton.click();

    // Verify that the dropdown has reverted back to its original setting (System mode)
    await expect(colorModeDropdown).toHaveText("System");

    // Verify that the app is back to using Light mode (visually Light mode, but actually System mode)
    const undoneMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );
    await expect(undoneMode).toBe(initialMode);
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
