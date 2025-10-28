import { test, expect } from "@playwright/test";
import { login, setupE2eTest, signUp } from "./utils";

test("Welcome page loads", async ({ page }) => {
  // Verify the contents of the welcome page
  const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
  await expect(welcomeNotice).toHaveCount(1);
  const loginButton = page.locator("button", { hasText: "Login" });
  await expect(loginButton).toHaveCount(1);
  const signUpButton = page.locator("button", { hasText: "Sign up" });
  await expect(signUpButton).toHaveCount(1);
});

test("/dashboard route is protected", async ({ page }) => {});

test("404 route works", async ({ page }) => {});

test.describe("User Auth", () => {
  const userName = "Testy";
  const userEmail = "test@test.com";
  const userPassword = "testtest";

  test.beforeEach(setupE2eTest);
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:5173");
  });

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

  test("Can switch between login and sign up forms", async ({ page }) => {});

  test.describe("Sign up validation", () => {
    test("Usernames shorter than 3 characters aren't allowed", async ({ page }) => {});

    test("Usernames that are empty aren't allowed", async ({ page }) => {});

    test("Passwords shorter than 6 characters aren't allowed", async ({ page }) => {});

    test("Usernames already in use aren't allowed", async ({ page }) => {});

    test("Emails already in use aren't allowed", async ({ page }) => {});
  });
});
