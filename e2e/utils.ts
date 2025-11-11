import { execSync, spawnSync } from "child_process";
import detect from "detect-port";
import { Page, expect } from "@playwright/test";

// Ensure a fresh database exists
export async function setupE2eTest() {
  await startSupabase();
  reseedDb();
}

// Ensure the database exists
async function startSupabase() {
  const port = await detect(54321);
  if (port !== 54321) {
    return;
  }
  console.warn("Supabase not detected - Starting it now");
  execSync("supabase start");
}

// Clear all the data so all tests are running in a known environment
function reseedDb() {
  spawnSync(
    "psql",
    ["-U", "postgres", "-h", "127.0.0.1", "-p", "54322", "-f", "supabase/clear_db_data.sql"],
    {
      stdio: "ignore",
      env: { ...process.env, PGPASSWORD: "postgres" },
    },
  );
}

export async function signUp(
  page: Page,
  userEmail: string,
  userPassword: string,
  userName: string,
) {
  // Open the sign up form
  const signUpButton = page.locator("button", { hasText: "Sign Up" }).first();
  await signUpButton.click();

  // Enter the test user's info
  const usernameInput = page.locator('input[name="username"]');
  await usernameInput.fill(userName);
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill(userEmail);
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(userPassword);

  // Submit the sign up form
  await page.keyboard.press("Enter");

  // Verify the dashboard page was reached and the user is logged in.
  await verifyDashboardReached(page, userName);
}

export async function login(page: Page, userEmail: string, userPassword: string) {
  // Open the login form
  const loginButton = page.locator("button", { hasText: "Login" }).first();
  await loginButton.click();

  // Enter the test user's info
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill(userEmail);
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(userPassword);

  // Submit the login form
  await page.keyboard.press("Enter");

  // Verify the dashboard page was reached and the user is logged in.
  await verifyDashboardReached(page);
}

export async function verifyDashboardReached(page: Page, username: string | undefined) {
  // Verify the dashboard page was reached.
  const welcomePageLink = page.locator("a", { hasText: "Board Board" });
  await expect(welcomePageLink).toHaveCount(1);

  // Open the user dropdown
  const userButton = page.locator("button.navbar-right-button");
  await expect(userButton).toHaveCount(1);
  await userButton.click();

  // If a username was passed, check to see that is displayed in the user dropdown
  if (username) {
    const usernameDisplay = page.getByText(username);
    await expect(usernameDisplay).toBeVisible();
    await expect(usernameDisplay).toHaveCount(1);
  }

  // Verify the logout button exists
  const logoutButton = page.locator("button", { hasText: "Logout" });
  await expect(logoutButton).toBeVisible();
  await expect(logoutButton).toHaveCount(1);

  // Close the user dropdown so further testing doesn't break
  await page.keyboard.press("Escape");
}

export async function signUpToSettingsPage(
  page: Page,
  userEmail: string,
  userPassword: string,
  userName: string,
) {
  // Sign up
  await signUp(page, userEmail, userPassword, userName);

  // Open the user dropdown, click the settings button, and verify the settings page was reached
  await navigateToSettingsPageFromDashboard(page);
}

export async function navigateToSettingsPageFromDashboard(page: Page) {
  // Open the user dropdown
  const userButton = page.locator("button.navbar-right-button");
  await expect(userButton).toHaveCount(1);
  await userButton.click();

  // Verify the settings button exists and click it
  const settingsButton = page.locator("a", { hasText: "Settings" });
  await expect(settingsButton).toBeVisible();
  await expect(settingsButton).toHaveCount(1);
  await settingsButton.click();

  // Verify that the settings page was reached
  const settingsPageHeader = page.locator("h1", { hasText: "Settings" });
  await expect(settingsPageHeader).toHaveCount(1);
}
