import { test, expect } from "@playwright/test";
import {
  startBackend,
  refreshBackend,
  signUp,
  verifyDashboardReached,
  createBoard,
  sendAndAcceptFriendRequest,
} from "./utils";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});
test.use({
  permissions: ["clipboard-read", "clipboard-write"],
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

    // Verify that the user was redirected to the 404 page
    const errorMessage = page.locator("h1", { hasText: "404 Error" });
    await expect(errorMessage).toHaveCount(1);

    // Return to the welcome page
    const homeButton = page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("/settings route is protected", async ({ page }) => {
    // Go to the settings page without logging in
    await page.goto("http://localhost:5173/Board-Board/dashboard/settings");

    // Verify that the user was redirected to the 404 page
    const errorMessage = page.locator("h1", { hasText: "404 Error" });
    await expect(errorMessage).toHaveCount(1);

    // Return to the welcome page
    const homeButton = page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("/friends route is protected", async ({ page }) => {
    // Go to the friends page without logging in
    await page.goto("http://localhost:5173/Board-Board/dashboard/friends");

    // Verify that the user was redirected to the 404 page
    const errorMessage = page.locator("h1", { hasText: "404 Error" });
    await expect(errorMessage).toHaveCount(1);

    // Return to the welcome page
    const homeButton = page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("/board/<id> route is protected", async ({ page }) => {
    // Go to a board page without logging in
    await page.goto("http://localhost:5173/Board-Board/dashboard/board/<any-id>");

    // Verify that the user was redirected to the 404 page
    const errorMessage = page.locator("h1", { hasText: "404 Error" });
    await expect(errorMessage).toHaveCount(1);

    // Return to the welcome page
    const homeButton = page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("/email route works", async ({ page }) => {
    // Go to a non-existant page
    await page.goto("http://localhost:5173/Board-Board/email");

    // Verify that the user got to the email confirmation page
    const header = page.locator("h1", { hasText: "An Email has been sent to your Inbox" });
    await expect(header).toHaveCount(1);

    // Return to the welcome page
    const homeButton = page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });

  test("404 route works", async ({ page }) => {
    // Go to a non-existant page
    await page.goto("http://localhost:5173/Board-Board/test");

    // Verify that the user was redirected to the 404 page
    const errorMessage = page.locator("h1", { hasText: "404 Error" });
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
    await verifyDashboardReached(page, undefined);
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
    await verifyDashboardReached(page, undefined);
  });

  test("Users can access boards they created", async ({ page }) => {
    const boardName = "New Board";

    // Sign up a new user and verify that the dashboard was reached
    await signUp(page, userEmail, userPassword, userName);

    // Create a new board and verify it appears in the dashboard
    await createBoard(page, boardName);

    // Get the new board's button (the whole row is a button) and open the board
    const boardRowButton = page.locator("td", { hasText: boardName });
    await expect(boardRowButton).toBeVisible();
    await expect(boardRowButton).toHaveCount(1);
    await boardRowButton.click();

    // Wait 1 second to guarantee the board page is loaded
    await page.waitForTimeout(1000);

    // ======= NOTE: THIS NEEDS TO BE UPDATED WHEN BOARDS GET IMPLEMENTED ========
    // Get the contents of the board page and verify them
    const boardHeader = page
      .locator("div", {
        hasText:
          /^ Board [0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      })
      .first();
    await expect(boardHeader).toBeVisible();
    await expect(boardHeader).toHaveCount(1);
  });

  test("Users can access boards that were shared with them", async ({ browser }) => {
    const user1Name = "ABC";
    const user1Email = "a@b.c";
    const user1Password = "testtest";
    const user2Name = "DEF";
    const user2Email = "d@e.f";
    const user2Password = "testtest";
    const boardName = "New Board";

    // Create a unique browser context for each user
    const user1Context = await browser.newContext();
    const user1Page = await user1Context.newPage();
    const user2Context = await browser.newContext();
    const user2Page = await user2Context.newPage();
    // Sign up user1
    await user1Page.goto("http://localhost:5173/Board-Board/");
    await signUp(user1Page, user1Email, user1Password, user1Name);
    // Sign up user2
    await user2Page.goto("http://localhost:5173/Board-Board/");
    await signUp(user2Page, user2Email, user2Password, user2Name);

    // Have users 1 and 2 become friends so they can share boards
    await sendAndAcceptFriendRequest(user1Page, user1Name, user2Page, user2Name);

    // Have user1 create a board
    await createBoard(user1Page, boardName);

    // Open the share modal
    const shareModalButton = user1Page.locator("button", { hasText: "Share" });
    await expect(shareModalButton).toBeVisible();
    await expect(shareModalButton).toHaveCount(1);
    await shareModalButton.click();

    // Verify the share modal modal was opened
    const shareBoardModalHeader = user1Page.locator("h2", { hasText: "Share Board" });
    await expect(shareBoardModalHeader).toBeVisible();
    await expect(shareBoardModalHeader).toHaveCount(1);

    // Verify that user2 appears in the modal
    const friendElement = user1Page.locator("div.friend-div", { hasText: "DEF" });
    await expect(friendElement).toBeVisible();
    await expect(friendElement).toHaveCount(1);

    // Share the board to user2
    const shareButtons = user1Page.locator("button", { hasText: /^Share$/ });
    await expect(shareButtons).toHaveCount(2);
    const shareButton = shareButtons.last();
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Verify the modal lists updated (user2 is shown as receiving the board and not shown as an option to be shared with)
    const unshareButton = user1Page.locator("button", { hasText: /^Unshare$/ });
    await expect(unshareButton).toBeVisible();
    await expect(unshareButton).toHaveCount(1);
    await expect(shareButtons).toHaveCount(1); // user2 can no longer be shared to

    // Refresh user2's dashboard to load in the new board
    await user2Page.reload();

    // Verify user2 can see the board on their dashboard
    const boardRowButton = user2Page.locator("td", { hasText: boardName });
    await expect(boardRowButton).toBeVisible();
    await expect(boardRowButton).toHaveCount(1);
    await boardRowButton.click();

    // Wait 1 second to guarantee the board page is loaded
    await user2Page.waitForTimeout(1000);

    // ======= NOTE: THIS NEEDS TO BE UPDATED WHEN BOARDS GET IMPLEMENTED ========
    // Get the contents of the board page and verify them
    const boardHeader = user2Page
      .locator("div", {
        hasText:
          /^ Board [0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      })
      .first();
    await expect(boardHeader).toBeVisible();
    await expect(boardHeader).toHaveCount(1);
  });

  test("Users are not able to access boards they don't own or weren't shared", async ({
    browser,
  }) => {
    const user1Name = "ABC";
    const user1Email = "a@b.c";
    const user1Password = "testtest";
    const user2Name = "DEF";
    const user2Email = "d@e.f";
    const user2Password = "testtest";
    const boardName = "New Board";

    // Create a unique browser context for each user
    const user1Context = await browser.newContext();
    const user1Page = await user1Context.newPage();
    const user2Context = await browser.newContext();
    const user2Page = await user2Context.newPage();
    // Sign up user1
    await user1Page.goto("http://localhost:5173/Board-Board/");
    await signUp(user1Page, user1Email, user1Password, user1Name);
    // Sign up user2
    await user2Page.goto("http://localhost:5173/Board-Board/");
    await signUp(user2Page, user2Email, user2Password, user2Name);

    // Have user1 create a board
    await createBoard(user1Page, boardName);

    // Get the new board's button (the whole row is a button) and open the board
    const boardRowButton = user1Page.locator("td", { hasText: boardName });
    await expect(boardRowButton).toBeVisible();
    await expect(boardRowButton).toHaveCount(1);
    await boardRowButton.click();

    // Wait 1 second to guarantee the board page is loaded
    await user1Page.waitForTimeout(1000);

    // ======= NOTE: THIS NEEDS TO BE UPDATED WHEN BOARDS GET IMPLEMENTED ========
    // Get the contents of the board page and verify them.
    const boardHeader = user1Page
      .locator("div", {
        hasText:
          /^ Board [0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      })
      .first();
    await expect(boardHeader).toBeVisible();
    await expect(boardHeader).toHaveCount(1);

    // Go to the board's page without it being shared to user2
    const url = user1Page.url();
    await user2Page.goto(url);

    // Verify that user2 was redirected to the 404 page
    const errorMessage = user2Page.locator("h1", { hasText: "404 Error" });
    await expect(errorMessage).toHaveCount(1);

    // Return to the welcome page
    const homeButton = user2Page.locator("button", { hasText: "Back to Home" });
    await expect(homeButton).toHaveCount(1);
    homeButton.click();

    // Verify the contents of the welcome page
    const welcomeNotice = user2Page.locator("h1", { hasText: "Welcome to Board Board!" });
    await expect(welcomeNotice).toHaveCount(1);
  });
});
