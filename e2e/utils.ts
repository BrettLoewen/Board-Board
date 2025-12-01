import { execSync, spawnSync, spawn } from "child_process";
import detect from "detect-port";
import { Page, expect } from "@playwright/test";

// Ensure the backend is setup before any tests are run
export async function startBackend() {
  await startSupabase();
  reseedDb();
}

// Ensure a fresh database exists for each test
export async function refreshBackend() {
  reseedDb();
}

// Ensure the database exists
async function startSupabase() {
  // Detect if supabase is running or not
  const port = await detect(54321);
  // If supabase is not running, start it
  if (port === 54321) {
    console.warn("Supabase not detected. Starting it now");
    execSync("supabase start");
  }

  // Check if the delete-user edge function is running
  const functionUrl = "http://127.0.0.1:54321/functions/v1/delete-user";
  const reachable = await isFunctionAvailable(functionUrl);

  // If it is not running, serve it
  if (!reachable) {
    console.log("Starting Supabase Edge function: delete-user");
    spawn("supabase", ["functions", "serve", "delete-user"], {
      stdio: "inherit",
      shell: true,
    });
  }

  return;
}

async function isFunctionAvailable(url) {
  try {
    // Try to hit the given url for an edge function.
    // If the fetch doesn't fail, then the function is running.
    await fetch(url, { method: "HEAD" });
    return true;
  } catch {
    // If the fetch fails, then the function is not running.
    return false;
  }
  return false;
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

export async function signUpToFriendsPage(
  page: Page,
  userEmail: string,
  userPassword: string,
  userName: string,
) {
  // Sign up
  await signUp(page, userEmail, userPassword, userName);

  // Open the user dropdown
  const userButton = page.locator("button.navbar-right-button");
  await expect(userButton).toHaveCount(1);
  await userButton.click();

  // Verify the friends button exists and click it
  const friendsButton = page.locator("a", { hasText: "Friends" });
  await expect(friendsButton).toBeVisible();
  await expect(friendsButton).toHaveCount(1);
  await friendsButton.click();

  // Verify that the friends page was reached
  const friendsPageHeader = page.locator("h1", { hasText: "Friends" });
  await expect(friendsPageHeader).toHaveCount(1);
}

export async function sendFriendRequest(
  user1Page: Page,
  user1Name: string,
  user2Page: Page,
  user2Name: string,
) {
  // Verify that both users are actually on the friends page (sanity check)
  const user1FriendsPageHeader = user1Page.locator("h1", { hasText: "Friends" });
  await expect(user1FriendsPageHeader).toHaveCount(1);
  const user2FriendsPageHeader = user2Page.locator("h1", { hasText: "Friends" });
  await expect(user2FriendsPageHeader).toHaveCount(1);

  // Copy user1's friend code
  const copyButton = user1Page.locator("button.clipboard-button");
  await expect(copyButton).toBeVisible();
  await expect(copyButton).toHaveCount(1);
  await copyButton.click();
  const friendCode = await user1Page.evaluate(() => navigator.clipboard.readText());

  // Fill in user1's friend code into user2's friend request field
  const friendRequestInput = user2Page.locator('input[name="friend-request"]');
  await expect(friendRequestInput).toBeVisible();
  await expect(friendRequestInput).toHaveCount(1);
  await friendRequestInput.fill(friendCode);

  // Send a friend request from user2 to user1
  const friendRequestButton = user2Page.locator("button", { hasText: "Send Request" });
  await expect(friendRequestButton).toBeVisible();
  await expect(friendRequestButton).toHaveCount(1);
  await friendRequestButton.click();

  // Verify that user1 recieved a friend request from user2
  const friendRequestText = user1Page.locator("p.content-center", { hasText: user2Name });
  await expect(friendRequestText).toBeVisible();
  await expect(friendRequestText).toHaveCount(1);
  const friendRequestAcceptButton = user1Page.locator("button.friend-request-primary-button", {
    hasText: "Accept",
  });
  await expect(friendRequestAcceptButton).toBeVisible();
  await expect(friendRequestAcceptButton).toHaveCount(1);
  const friendRequestRejectButton = user1Page.locator("button.friend-request-error-button", {
    hasText: "Reject",
  });
  await expect(friendRequestRejectButton).toBeVisible();
  await expect(friendRequestRejectButton).toHaveCount(1);
}
