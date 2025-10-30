import { test, expect } from "@playwright/test";
import { login, setupE2eTest, signUp } from "./utils";
import { AUTH } from "../src/constants.ts";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeEach(setupE2eTest);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});

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

test.describe("User Auth", () => {
  const userName = "Testy";
  const userEmail = "test@test.com";
  const userPassword = "testtest";

  test("New user can signup", async ({ page }) => {
    await signUp(page, userEmail, userPassword, userName);
  });

  test("Signed up user can log in", async ({ page }) => {
    // Sign up
    await signUp(page, userEmail, userPassword, userName);

    // Log out
    const logoutButton = page.locator("button", { hasText: "Sign out" });
    await expect(logoutButton).toHaveCount(1);
    logoutButton.click();

    // Log back in
    await login(page, userEmail, userPassword, userName);
  });

  test("Logged in user sees dashboard button on welcome page", async ({ page }) => {
    // Sign up
    await signUp(page, userEmail, userPassword, userName);

    // Return to the welcome page
    await page.goto("http://localhost:5173/Board-Board/");

    // Return to the dashboard
    const dashboardButton = page.locator("button", { hasText: "Go to Dashboard" });
    await expect(dashboardButton).toHaveCount(1);
    dashboardButton.click();

    // Verify that the user returned to the dashboard
    const welcomeNotice = page.locator("p", { hasText: `Welcome, ${userName}!` });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("Can switch between login and sign up forms", async ({ page }) => {
    // Open the login form
    const loginFormButton = page.locator("button", { hasText: "Login" }).first();
    await loginFormButton.click();

    // Verify the login version of the auth form opened.
    // The title is buried in the nuxt ui AuthForm component, so this css is a workaround to find only that div.
    const loginTitle = page.locator("div.text-xl.text-pretty.font-semibold.text-highlighted", {
      hasText: "Login",
    });
    await expect(loginTitle).toHaveCount(1);

    // Switch to the sign up form.
    const signUpSwitchButton = page.locator("a", { hasText: "Sign Up" }).first();
    await signUpSwitchButton.click();

    // Verify the sign up version of the auth form opened.
    const signUpTitle = page.locator("div.text-xl.text-pretty.font-semibold.text-highlighted", {
      hasText: "Sign up",
    });
    await expect(signUpTitle).toHaveCount(1);

    // Switch back to the login version of the form.
    const loginSwitchButton = page.locator("a", { hasText: "Login" }).first();
    await loginSwitchButton.click();

    // Verify the login version of the auth form opened again.
    const loginTitle2 = page.locator("div.text-xl.text-pretty.font-semibold.text-highlighted", {
      hasText: "Login",
    });
    await expect(loginTitle2).toHaveCount(1);
  });

  test.describe("Sign up validation", () => {
    test("Usernames shorter than 3 characters aren't allowed", async ({ page }) => {
      // Open the sign up form
      const signUpButton = page.locator("button", { hasText: "Sign Up" }).first();
      await signUpButton.click();

      // Enter the new user's info
      const usernameInput = page.locator('input[name="username"]');
      await usernameInput.fill("A");
      const emailInput = page.locator('input[name="email"]');
      await emailInput.fill(userEmail);
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill(userPassword);

      // Submit the sign up form
      await page.keyboard.press("Enter");

      // Verfiy the correct error message was displayed
      const errorMessage = page.locator(
        "div.relative.overflow-hidden.w-full.rounded-lg.p-4.flex.gap-2\\.5.items-start.bg-error\\/10.text-error.ring.ring-inset.ring-error\\/25.alert",
        {
          hasText: AUTH.MESSAGES.INVALID_USERNAME,
        },
      );
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveCount(1);
    });

    test("Usernames that are empty aren't allowed", async ({ page }) => {
      // Open the sign up form
      const signUpButton = page.locator("button", { hasText: "Sign Up" }).first();
      await signUpButton.click();

      // Enter the new user's info
      const usernameInput = page.locator('input[name="username"]');
      await usernameInput.fill("");
      const emailInput = page.locator('input[name="email"]');
      await emailInput.fill(userEmail);
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill(userPassword);

      // Submit the sign up form
      await page.keyboard.press("Enter");

      // Verfiy the correct error message was displayed
      const errorMessage = page.locator(
        "div.relative.overflow-hidden.w-full.rounded-lg.p-4.flex.gap-2\\.5.items-start.bg-error\\/10.text-error.ring.ring-inset.ring-error\\/25.alert",
        {
          hasText: AUTH.MESSAGES.MISSING_FIELD,
        },
      );
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveCount(1);
    });

    test("Passwords shorter than 6 characters aren't allowed", async ({ page }) => {
      // Open the sign up form
      const signUpButton = page.locator("button", { hasText: "Sign Up" }).first();
      await signUpButton.click();

      // Enter the new user's info
      const usernameInput = page.locator('input[name="username"]');
      await usernameInput.fill(userName);
      const emailInput = page.locator('input[name="email"]');
      await emailInput.fill(userEmail);
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill("test");

      // Submit the sign up form
      await page.keyboard.press("Enter");

      // Verfiy the correct error message was displayed
      const errorMessage = page.locator(
        "div.relative.overflow-hidden.w-full.rounded-lg.p-4.flex.gap-2\\.5.items-start.bg-error\\/10.text-error.ring.ring-inset.ring-error\\/25.alert",
        {
          hasText: AUTH.MESSAGES.WEAK_PASSWORD,
        },
      );
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toHaveCount(1);
    });

    test("Emails already in use aren't allowed", async ({ page }) => {
      // Sign up the first user
      await signUp(page, userEmail, userPassword, userName);

      // Log out that user
      const logoutButton = page.locator("button", { hasText: "Sign out" });
      await expect(logoutButton).toHaveCount(1);
      logoutButton.click();

      // Open the sign up form again
      const signUpButton = page.locator("button", { hasText: "Sign Up" }).first();
      await signUpButton.click();

      // Enter the new user's info
      const usernameInput = page.locator('input[name="username"]');
      await usernameInput.fill("NewUser");
      const emailInput = page.locator('input[name="email"]');
      await emailInput.fill(userEmail);
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill(userPassword);

      // Submit the sign up form
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
  });
});
