import { test, expect } from "@playwright/test";
import { startBackend, refreshBackend, signUpToFriendsPage } from "./utils";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});

test.describe("Friends Page", () => {
  const user1Name = "ABC";
  const user1Email = "a@b.c";
  const user1Password = "testtest";
  // const user2Name = "DEF";
  // const user2Email = "d@e.f";
  // const user2Password = "testtest";

  test("Signed up user can access the Friends page", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    // Verify the user starts with no friend requests and no friends
    expect(true).toBe(false);
  });

  test("User can copy their friend code", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User can get a new friend code", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User can send a friend request to another user", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User can reject a recieved friend request", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User can accept a recieved friend request", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User can remove a friend", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User gets an error message if they enter an invalid friend code", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User gets an error message if they enter their own friend code", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User gets an error message if they enter a friends friend code", async ({ page }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });

  test("User can send a friend request to a user that they were friends with before but are not friends with currently", async ({
    page,
  }) => {
    // Sign up a new user and verify that the friends page is reachable
    await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

    expect(true).toBe(false);
  });
});
