import { execSync } from "child_process";
import detect from "detect-port";
import { Page, expect } from "@playwright/test";

export async function setupE2eTest() {
  await startSupabase();
  reseedDb();
}

async function startSupabase() {
  const port = await detect(54321);
  if (port !== 54321) {
    return;
  }
  console.warn("Supabase not detected - Starting it now");
  execSync("supabase start");
}

function reseedDb() {
  execSync(
    "SET PGPASSWORD=postgres&&psql -U postgres -h 127.0.0.1 -p 54322 -f supabase/clear_db_data.sql",
    { stdio: "ignore" },
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

  // Verify the dashboard page was reached.
  // Will need to be changed later after dashboard is updated.
  const welcomeNotice = page.locator("p", { hasText: `Welcome, ${userName}!` });
  await expect(welcomeNotice).toHaveCount(1);
  const logoutButton = page.locator("button", { hasText: "Sign out" });
  await expect(logoutButton).toHaveCount(1);
}

export async function login(page: Page, userEmail: string, userPassword: string, userName: string) {
  // Open the login form
  const loginButton = page.locator("button", { hasText: "Login" }).first();
  await loginButton.click();

  // Enter the test user's info
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill(userEmail);
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(userPassword);

  // Submit the sign up form
  await page.keyboard.press("Enter");

  // Verify the dashboard page was reached.
  // Will need to be changed later after dashboard is updated.
  const welcomeNotice = page.locator("p", { hasText: `Welcome, ${userName}!` });
  await expect(welcomeNotice).toHaveCount(1);
  const logoutButton = page.locator("button", { hasText: "Sign out" });
  await expect(logoutButton).toHaveCount(1);
}
