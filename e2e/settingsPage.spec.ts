import { test, expect } from "@playwright/test";
import {
  setupE2eTest,
  login,
  signUpToSettingsPage,
  navigateToSettingsPageFromDashboard,
} from "./utils";
import { AUTH } from "../src/constants.ts";

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

    // Try to return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Verify that the unsaved changes popup modal opened
    const unsavedChangesModalHeader = page.getByRole("heading", { name: "Undo your changes?" });
    await expect(unsavedChangesModalHeader).toBeVisible();
    await expect(unsavedChangesModalHeader).toHaveCount(1);
    const unsavedChangesModalQuit = page.getByRole("button", { name: "Quit without saving" });
    await expect(unsavedChangesModalQuit).toBeVisible();
    await expect(unsavedChangesModalQuit).toHaveCount(1);
    const unsavedChangesModalCancel = page.getByRole("button", { name: "Cancel" });
    await expect(unsavedChangesModalCancel).toBeVisible();
    await expect(unsavedChangesModalCancel).toHaveCount(1);
  });

  test("Changes are undone if user returns to the dashboard without saving the changes", async ({
    page,
  }) => {
    const newUsername = "Tester";

    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Enter the new username
    let usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
    await usernameInput.fill(newUsername);

    // Exit out of the input field.
    // This will validate the new username and enable the undo button.
    // The code overrides the default behaviour to submit on Enter, so this is fine.
    await page.keyboard.press("Enter");

    // Try to return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Verify that the unsaved changes popup modal opened
    const unsavedChangesModalHeader = page.getByRole("heading", { name: "Undo your changes?" });
    await expect(unsavedChangesModalHeader).toBeVisible();
    await expect(unsavedChangesModalHeader).toHaveCount(1);
    const unsavedChangesModalQuit = page.getByRole("button", { name: "Quit without saving" });
    await expect(unsavedChangesModalQuit).toBeVisible();
    await expect(unsavedChangesModalQuit).toHaveCount(1);
    const unsavedChangesModalCancel = page.getByRole("button", { name: "Cancel" });
    await expect(unsavedChangesModalCancel).toBeVisible();
    await expect(unsavedChangesModalCancel).toHaveCount(1);

    // Return to the dashboard without saving the username change
    await unsavedChangesModalQuit.click();

    // Return to the settings page
    await navigateToSettingsPageFromDashboard(page);

    // Verify that the new username is being used as the placeholder (verify that the new username was saved)
    usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
  });

  test("Ability to undo changes disappears if username changes are manually undone", async ({
    page,
  }) => {
    const newUsername = "Tester";

    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Expect the undo button to start disabled because no changes have been made
    const undoButton = page.locator("button", { hasText: "Undo Changes" });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toHaveCount(1);
    await expect(undoButton).toBeDisabled();

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

    // Verify the undo button is enabled now that a change has been made
    await expect(undoButton).not.toBeDisabled();

    // Manually undo the change
    await usernameInput.fill("");
    await page.keyboard.press("Enter");

    // Verify the undo button is disabled again
    await expect(undoButton).toBeDisabled();
  });

  test("Ability to undo changes disappears if color mode changes are manually undone", async ({
    page,
  }) => {
    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Expect the undo button to start disabled because no changes have been made
    const undoButton = page.locator("button", { hasText: "Undo Changes" });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toHaveCount(1);
    await expect(undoButton).toBeDisabled();

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

    // Verify the undo button is enabled now that a change has been made
    await expect(undoButton).not.toBeDisabled();

    // Manually undo the change
    await colorModeDropdown.click();
    const systemModeOption = page.getByRole("option", { name: "System" });
    await expect(systemModeOption).toHaveCount(1);
    await systemModeOption.click();

    // Verify that the app is now using System (Light) mode
    const undoneMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );
    await expect(undoneMode).toBe(initialMode);

    // Verify the undo button is disabled again
    await expect(undoButton).toBeDisabled();
  });

  test("Username changes are saved between sessions", async ({ page }) => {
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

    // Log out
    // Open the user dropdown
    const userButton = page.locator("button.navbar-right-button");
    await expect(userButton).toHaveCount(1);
    userButton.click();
    // Verify the logout button exists
    const logoutButton = page.locator("button", { hasText: "Logout" });
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toHaveCount(1);
    // Actually log out
    await logoutButton.click();

    // Log back in
    await login(page, userEmail, userPassword);

    // Return to the settings page
    await navigateToSettingsPageFromDashboard(page);

    // Verify that the new username is being used as the placeholder (verify that the new username was saved)
    usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", newUsername);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
  });

  test("Color mode changes are saved between sessions", async ({ page }) => {
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

    // Log out
    // Open the user dropdown
    const userButton = page.locator("button.navbar-right-button");
    await expect(userButton).toHaveCount(1);
    userButton.click();
    // Verify the logout button exists
    const logoutButton = page.locator("button", { hasText: "Logout" });
    await expect(logoutButton).toBeVisible();
    await expect(logoutButton).toHaveCount(1);
    // Actually log out
    await logoutButton.click();

    // Verify the contents of the welcome page (verify the user was logged out)
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
    const loginButton = page.locator("button", { hasText: "Login" });
    await expect(loginButton).toHaveCount(1);
    const signUpButton = page.locator("button", { hasText: "Sign up" });
    await expect(signUpButton).toHaveCount(1);

    // Verify that the app has returned to using System mode (since the user is logged out)
    const loggedOutMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );
    await expect(loggedOutMode).toBe(initialMode);

    // Log back in
    await login(page, userEmail, userPassword);

    // Verify that the app has returned to using Dark mode (since the user is logged in now)
    const loggedInMode = await html.evaluate((el) =>
      el.classList.contains("dark") ? "dark" : "light",
    );
    await expect(loggedInMode).not.toBe(initialMode);

    // Return to the settings page
    await navigateToSettingsPageFromDashboard(page);

    // Verify that the dropdown's new initial value is for Dark mode.
    await expect(colorModeDropdown).toHaveText("Dark");
  });

  test("Short usernames show error text", async ({ page }) => {
    const newUsername = "Te";

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

    // Verify that an error appeared telling the user that the entered username is too short
    const usernameError = page.getByText("Username too short!");
    await expect(usernameError).toBeVisible();
    await expect(usernameError).toHaveCount(1);
  });

  test("Short usernames cannot be saved", async ({ page }) => {
    const newUsername = "Te";

    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Enter the new username
    let usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
    await usernameInput.fill(newUsername);

    // Exit out of the input field.
    // This will validate the new username and enable the undo button.
    // The code overrides the default behaviour to submit on Enter, so this is fine.
    await page.keyboard.press("Enter");

    // Verify that an error appeared telling the user that the entered username is too short
    const usernameError = page.getByText("Username too short!");
    await expect(usernameError).toBeVisible();
    await expect(usernameError).toHaveCount(1);

    // Attempt to save the new username
    const saveButton = page.locator("button", { hasText: "Save Changes" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toHaveCount(1);
    await saveButton.click();

    // Expect the undo button to be enabled because the change wasn't saved (so it wasn't cleared)
    const undoButton = page.locator("button", { hasText: "Undo Changes" });
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toHaveCount(1);
    await expect(undoButton).not.toBeDisabled();
    await undoButton.click();

    // Return to the dashboard
    const backButton = page.locator("button.back-button");
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveCount(1);
    await backButton.click();

    // Return to the settings page
    await navigateToSettingsPageFromDashboard(page);

    // Verify that the old username is being used as the placeholder (verify that the new username was not saved)
    usernameInput = page.locator('input[name="username"]');
    await expect(usernameInput).toHaveAttribute("placeholder", userName);
    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveCount(1);
  });

  test("Account can be deleted", async ({ page }) => {
    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Click the delete account button
    const deleteButton = page.locator("button", { hasText: "Delete Account" });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toHaveCount(1);
    await deleteButton.click();

    // Verify that the unsaved changes popup modal opened
    const deleteAccountModalHeader = page.getByRole("heading", { name: "Delete your Account" });
    await expect(deleteAccountModalHeader).toBeVisible();
    await expect(deleteAccountModalHeader).toHaveCount(1);
    const deleteAccountModalConfirm = page.getByRole("button", { name: "Delete" });
    await expect(deleteAccountModalConfirm).toBeVisible();
    await expect(deleteAccountModalConfirm).toHaveCount(1);
    const deleteAccountModalCancel = page.getByRole("button", { name: "Cancel" });
    await expect(deleteAccountModalCancel).toBeVisible();
    await expect(deleteAccountModalCancel).toHaveCount(1);

    // Delete the account
    await deleteAccountModalConfirm.click();

    // Verify the contents of the welcome page (verify the user was logged out after deleting their account)
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
    const loginButton = page.locator("button", { hasText: "Login" });
    await expect(loginButton).toHaveCount(1);
    const signUpButton = page.locator("button", { hasText: "Sign up" });
    await expect(signUpButton).toHaveCount(1);

    // Open the login form
    await loginButton.click();

    // Enter the test user's info
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill(userEmail);
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill(userPassword);

    // Submit the login form
    await page.keyboard.press("Enter");

    // Verfiy the correct error message was displayed
    const errorMessage = page.locator(
      "div.relative.overflow-hidden.w-full.rounded-lg.p-4.flex.gap-2\\.5.items-start.bg-error\\/10.text-error.ring.ring-inset.ring-error\\/25.alert",
      {
        hasText: AUTH.MESSAGES.INVALID,
      },
    );
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveCount(1);
  });

  test("Account deletion modal can be closed without deleting the account", async ({ page }) => {
    // Sign up a new user and verify that the settings page is reachable
    await signUpToSettingsPage(page, userEmail, userPassword, userName);

    // Click the delete account button
    const deleteButton = page.locator("button", { hasText: "Delete Account" });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toHaveCount(1);
    await deleteButton.click();

    // Verify that the unsaved changes popup modal opened
    const deleteAccountModalHeader = page.getByRole("heading", { name: "Delete your Account" });
    await expect(deleteAccountModalHeader).toBeVisible();
    await expect(deleteAccountModalHeader).toHaveCount(1);
    const deleteAccountModalConfirm = page.getByRole("button", { name: "Delete" });
    await expect(deleteAccountModalConfirm).toBeVisible();
    await expect(deleteAccountModalConfirm).toHaveCount(1);
    const deleteAccountModalCancel = page.getByRole("button", { name: "Cancel" });
    await expect(deleteAccountModalCancel).toBeVisible();
    await expect(deleteAccountModalCancel).toHaveCount(1);

    // Cancel the delete action
    await deleteAccountModalCancel.click();

    // Verify that the settings page is still open (verify the user was not logged out due to a deleted account)
    const settingsPageHeader = page.locator("h1", { hasText: "Settings" });
    await expect(settingsPageHeader).toHaveCount(1);
  });
});
