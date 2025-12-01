import { test, expect } from "@playwright/test";
import { startBackend, refreshBackend, signUpToFriendsPage, sendFriendRequest } from "./utils";

// For every test...
// Ensure a fresh database exists
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);
test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test.describe("Friends Page", () => {
  const user1Name = "ABC";
  const user1Email = "a@b.c";
  const user1Password = "testtest";
  const user2Name = "DEF";
  const user2Email = "d@e.f";
  const user2Password = "testtest";

  test.describe("Single page tests", () => {
    // Ensure each test starts on the app's welcome page
    test.beforeEach(async ({ page }) => {
      await page.goto("http://localhost:5173/Board-Board/");
    });

    test("Signed up user can access the Friends page", async ({ page }) => {
      // Sign up a new user and verify that the friends page is reachable
      await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

      // Verify the user starts with no friend requests and no friends
      const friendRequestsList = page.locator("p", { hasText: "No Pending Friend Requests" });
      await expect(friendRequestsList).toBeVisible();
      await expect(friendRequestsList).toHaveCount(1);
      const friendsList = page.locator("p", { hasText: "No Friends" });
      await expect(friendsList).toBeVisible();
      await expect(friendsList).toHaveCount(1);
    });

    test("User can copy their friend code", async ({ page }) => {
      // Sign up a new user and verify that the friends page is reachable
      await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

      // Check that the user's friend code is visible, and store it
      const friendCodeInput = page.locator('input[name="friend-code"]');
      await expect(friendCodeInput).toBeVisible();
      await expect(friendCodeInput).toHaveCount(1);
      const friendCode = await friendCodeInput.inputValue();

      // Copy the user's friend code
      const copyButton = page.locator("button.clipboard-button");
      await expect(copyButton).toBeVisible();
      await expect(copyButton).toHaveCount(1);
      await copyButton.click();

      // Verify that the text saved to the clipboard matches the user's friend code
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(friendCode);
    });

    test("User can get a new friend code", async ({ page }) => {
      // Sign up a new user and verify that the friends page is reachable
      await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

      // Store the user's initial friend code
      const friendCodeInput = page.locator('input[name="friend-code"]');
      await expect(friendCodeInput).toBeVisible();
      await expect(friendCodeInput).toHaveCount(1);
      const friendCode = await friendCodeInput.inputValue();

      // Get a new friend code
      const newCodeButton = page.locator("button", { hasText: "Get New Code" });
      await expect(newCodeButton).toBeVisible();
      await expect(newCodeButton).toHaveCount(1);
      await newCodeButton.click();

      // Store the new friend code
      const newFriendCode = await friendCodeInput.inputValue();

      // Verify the 2 friend codes are different (verify a new code was actually obtained)
      expect(newFriendCode !== friendCode);
    });

    test("User gets an error message if they enter an invalid friend code", async ({ page }) => {
      // Sign up a new user and verify that the friends page is reachable
      await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

      // Fill in an invalid friend code
      const friendRequestInput = page.locator('input[name="friend-request"]');
      await expect(friendRequestInput).toBeVisible();
      await expect(friendRequestInput).toHaveCount(1);
      await friendRequestInput.fill("invalid");

      // Attempt to send a friend request to the invalid code
      const friendRequestButton = page.locator("button", { hasText: "Send Request" });
      await expect(friendRequestButton).toBeVisible();
      await expect(friendRequestButton).toHaveCount(1);
      await friendRequestButton.click();

      // Verify that the correct error message was displayed
      const friendRequestErrorText = page.locator("div.text-error", {
        hasText: "Invalid Friend Code!",
      });
      await expect(friendRequestErrorText).toBeVisible();
      await expect(friendRequestErrorText).toHaveCount(1);
    });

    test("User gets an error message if they enter their own friend code", async ({ page }) => {
      // Sign up a new user and verify that the friends page is reachable
      await signUpToFriendsPage(page, user1Email, user1Password, user1Name);

      // Copy the user's friend code
      const copyButton = page.locator("button.clipboard-button");
      await expect(copyButton).toBeVisible();
      await expect(copyButton).toHaveCount(1);
      await copyButton.click();
      const friendCode = await page.evaluate(() => navigator.clipboard.readText());

      // Fill in an invalid friend code
      const friendRequestInput = page.locator('input[name="friend-request"]');
      await expect(friendRequestInput).toBeVisible();
      await expect(friendRequestInput).toHaveCount(1);
      await friendRequestInput.fill(friendCode);

      // Attempt to send a friend request to the invalid code
      const friendRequestButton = page.locator("button", { hasText: "Send Request" });
      await expect(friendRequestButton).toBeVisible();
      await expect(friendRequestButton).toHaveCount(1);
      await friendRequestButton.click();

      // Verify that the correct error message was displayed
      const friendRequestErrorText = page.locator("div.text-error", {
        hasText: "You cannot send a friend request to yourself!",
      });
      await expect(friendRequestErrorText).toBeVisible();
      await expect(friendRequestErrorText).toHaveCount(1);
    });
  });

  test.describe("Multi-page tests", () => {
    test("User can send a friend request to another user", async ({ browser }) => {
      // Create a unique browser context for each user
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();

      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();

      // Sign up user1
      await user1Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user1Page, user1Email, user1Password, user1Name);

      // Sign up user2
      await user2Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user2Page, user2Email, user2Password, user2Name);

      // Send a friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);
    });

    test("User can reject a recieved friend request", async ({ browser }) => {
      // Create a unique browser context for each user
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();

      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();

      // Sign up user1
      await user1Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user1Page, user1Email, user1Password, user1Name);

      // Sign up user2
      await user2Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user2Page, user2Email, user2Password, user2Name);

      // Send a friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);

      // Reject the friend request
      const friendRequestRejectButton = user1Page.locator("button.friend-request-error-button", {
        hasText: "Reject",
      });
      await expect(friendRequestRejectButton).toBeVisible();
      await expect(friendRequestRejectButton).toHaveCount(1);
      await friendRequestRejectButton.click();

      // Verify the request was removed
      const friendRequestsList = user1Page.locator("p", { hasText: "No Pending Friend Requests" });
      await expect(friendRequestsList).toBeVisible();
      await expect(friendRequestsList).toHaveCount(1);
    });

    test("User can accept a recieved friend request", async ({ browser }) => {
      // Create a unique browser context for each user
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();

      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();

      // Sign up user1
      await user1Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user1Page, user1Email, user1Password, user1Name);

      // Sign up user2
      await user2Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user2Page, user2Email, user2Password, user2Name);

      // Send a friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);

      // Accept the friend request
      const friendRequestAcceptButton = user1Page.locator("button.friend-request-primary-button", {
        hasText: "Accept",
      });
      await expect(friendRequestAcceptButton).toBeVisible();
      await expect(friendRequestAcceptButton).toHaveCount(1);
      await friendRequestAcceptButton.click();

      // Verify the request was removed
      const friendRequestsList = user1Page.locator("p", { hasText: "No Pending Friend Requests" });
      await expect(friendRequestsList).toBeVisible();
      await expect(friendRequestsList).toHaveCount(1);

      // Verify that user2 is displayed in user1's friends list
      const user1FriendText = user1Page.locator("p.content-center", { hasText: user2Name });
      await expect(user1FriendText).toBeVisible();
      await expect(user1FriendText).toHaveCount(1);
      const user1FriendRemoveButton = user1Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user1FriendRemoveButton).toBeVisible();
      await expect(user1FriendRemoveButton).toHaveCount(1);

      // Verify that user1 is displayed in user2's friends list
      const user2FriendText = user2Page.locator("p.content-center", { hasText: user1Name });
      await expect(user2FriendText).toBeVisible();
      await expect(user2FriendText).toHaveCount(1);
      const user2FriendRemoveButton = user2Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user2FriendRemoveButton).toBeVisible();
      await expect(user2FriendRemoveButton).toHaveCount(1);
    });

    test("User can remove a friend", async ({ browser }) => {
      // Create a unique browser context for each user
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();

      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();

      // Sign up user1
      await user1Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user1Page, user1Email, user1Password, user1Name);

      // Sign up user2
      await user2Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user2Page, user2Email, user2Password, user2Name);

      // Send a friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);

      // Accept the friend request
      const friendRequestAcceptButton = user1Page.locator("button.friend-request-primary-button", {
        hasText: "Accept",
      });
      await expect(friendRequestAcceptButton).toBeVisible();
      await expect(friendRequestAcceptButton).toHaveCount(1);
      await friendRequestAcceptButton.click();

      // Verify the request was removed
      const friendRequestsList = user1Page.locator("p", { hasText: "No Pending Friend Requests" });
      await expect(friendRequestsList).toBeVisible();
      await expect(friendRequestsList).toHaveCount(1);

      // Verify that user2 is displayed in user1's friends list
      const user1FriendText = user1Page.locator("p.content-center", { hasText: user2Name });
      await expect(user1FriendText).toBeVisible();
      await expect(user1FriendText).toHaveCount(1);
      const user1FriendRemoveButton = user1Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user1FriendRemoveButton).toBeVisible();
      await expect(user1FriendRemoveButton).toHaveCount(1);

      // Verify that user1 is displayed in user2's friends list
      const user2FriendText = user2Page.locator("p.content-center", { hasText: user1Name });
      await expect(user2FriendText).toBeVisible();
      await expect(user2FriendText).toHaveCount(1);
      const user2FriendRemoveButton = user2Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user2FriendRemoveButton).toBeVisible();
      await expect(user2FriendRemoveButton).toHaveCount(1);

      // Remove user2 from user1's friends
      await user1FriendRemoveButton.click();

      // Verify that user2 no longer appears in user1's friend list
      const user1FriendsList = user1Page.locator("p", { hasText: "No Friends" });
      await expect(user1FriendsList).toBeVisible();
      await expect(user1FriendsList).toHaveCount(1);

      // Verify that user1 no longer appears in user2's friend list.
      // Requires a page refresh because there is no broadcast event that triggers a live update for friend removals.
      await user2Page.reload();
      const user2FriendsList = user2Page.locator("p", { hasText: "No Friends" });
      await expect(user2FriendsList).toBeVisible();
      await expect(user2FriendsList).toHaveCount(1);
    });

    test("User can send a friend request to a user that they were friends with before but are not friends with currently", async ({
      browser,
    }) => {
      // Create a unique browser context for each user
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();

      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();

      // Sign up user1
      await user1Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user1Page, user1Email, user1Password, user1Name);

      // Sign up user2
      await user2Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user2Page, user2Email, user2Password, user2Name);

      // Send a friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);

      // Accept the friend request
      const friendRequestAcceptButton = user1Page.locator("button.friend-request-primary-button", {
        hasText: "Accept",
      });
      await expect(friendRequestAcceptButton).toBeVisible();
      await expect(friendRequestAcceptButton).toHaveCount(1);
      await friendRequestAcceptButton.click();

      // Verify the request was removed
      const friendRequestsList = user1Page.locator("p", { hasText: "No Pending Friend Requests" });
      await expect(friendRequestsList).toBeVisible();
      await expect(friendRequestsList).toHaveCount(1);

      // Verify that user2 is displayed in user1's friends list
      const user1FriendText = user1Page.locator("p.content-center", { hasText: user2Name });
      await expect(user1FriendText).toBeVisible();
      await expect(user1FriendText).toHaveCount(1);
      const user1FriendRemoveButton = user1Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user1FriendRemoveButton).toBeVisible();
      await expect(user1FriendRemoveButton).toHaveCount(1);

      // Verify that user1 is displayed in user2's friends list
      const user2FriendText = user2Page.locator("p.content-center", { hasText: user1Name });
      await expect(user2FriendText).toBeVisible();
      await expect(user2FriendText).toHaveCount(1);
      const user2FriendRemoveButton = user2Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user2FriendRemoveButton).toBeVisible();
      await expect(user2FriendRemoveButton).toHaveCount(1);

      // Remove user2 from user1's friends
      await user1FriendRemoveButton.click();

      // Verify that user2 no longer appears in user1's friend list
      const user1FriendsList = user1Page.locator("p", { hasText: "No Friends" });
      await expect(user1FriendsList).toBeVisible();
      await expect(user1FriendsList).toHaveCount(1);

      // Verify that user1 no longer appears in user2's friend list.
      // Requires a page refresh because there is no broadcast event that triggers a live update for friend removals.
      await user2Page.reload();
      const user2FriendsList = user2Page.locator("p", { hasText: "No Friends" });
      await expect(user2FriendsList).toBeVisible();
      await expect(user2FriendsList).toHaveCount(1);

      // Send a second friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);
    });

    test("User gets an error message if they enter a friends friend code", async ({ browser }) => {
      // Create a unique browser context for each user
      const user1Context = await browser.newContext();
      const user1Page = await user1Context.newPage();

      const user2Context = await browser.newContext();
      const user2Page = await user2Context.newPage();

      // Sign up user1
      await user1Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user1Page, user1Email, user1Password, user1Name);

      // Sign up user2
      await user2Page.goto("http://localhost:5173/Board-Board/");
      await signUpToFriendsPage(user2Page, user2Email, user2Password, user2Name);

      // Send a friend request from user2 to user1 and verify that user1 received it
      await sendFriendRequest(user1Page, user1Name, user2Page, user2Name);

      // Accept the friend request
      const friendRequestAcceptButton = user1Page.locator("button.friend-request-primary-button", {
        hasText: "Accept",
      });
      await expect(friendRequestAcceptButton).toBeVisible();
      await expect(friendRequestAcceptButton).toHaveCount(1);
      await friendRequestAcceptButton.click();

      // Verify the request was removed
      const friendRequestsList = user1Page.locator("p", { hasText: "No Pending Friend Requests" });
      await expect(friendRequestsList).toBeVisible();
      await expect(friendRequestsList).toHaveCount(1);

      // Verify that user2 is displayed in user1's friends list
      const user1FriendText = user1Page.locator("p.content-center", { hasText: user2Name });
      await expect(user1FriendText).toBeVisible();
      await expect(user1FriendText).toHaveCount(1);
      const user1FriendRemoveButton = user1Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user1FriendRemoveButton).toBeVisible();
      await expect(user1FriendRemoveButton).toHaveCount(1);

      // Verify that user1 is displayed in user2's friends list
      const user2FriendText = user2Page.locator("p.content-center", { hasText: user1Name });
      await expect(user2FriendText).toBeVisible();
      await expect(user2FriendText).toHaveCount(1);
      const user2FriendRemoveButton = user2Page.locator("button.friend-request-error-button", {
        hasText: "Remove",
      });
      await expect(user2FriendRemoveButton).toBeVisible();
      await expect(user2FriendRemoveButton).toHaveCount(1);

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

      // Attempt to send a second friend request from user2 to user1
      const friendRequestButton = user2Page.locator("button", { hasText: "Send Request" });
      await expect(friendRequestButton).toBeVisible();
      await expect(friendRequestButton).toHaveCount(1);
      await friendRequestButton.click();

      // Verify that the correct error message was displayed
      const friendRequestErrorText = user2Page.locator("div.text-error", {
        hasText: "You are already friends with that user!",
      });
      await expect(friendRequestErrorText).toBeVisible();
      await expect(friendRequestErrorText).toHaveCount(1);
    });
  });
});
