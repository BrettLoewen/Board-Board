import { test, expect } from "@playwright/test";
import {
  startBackend,
  refreshBackend,
  signUp,
  createBoard,
  sendAndAcceptFriendRequest,
} from "./utils";

// For every test...
// Ensure a fresh database exists
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);
test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test.describe("Board Management", () => {
  const user1Name = "ABC";
  const user1Email = "a@b.c";
  const user1Password = "testtest";
  const user2Name = "DEF";
  const user2Email = "d@e.f";
  const user2Password = "testtest";

  const board1Name = "New Board";
  const board2Name = "Second Board";
  const boardBadName = "Hi";

  test.describe("Single page tests", () => {
    // Ensure each test starts on the app's welcome page
    test.beforeEach(async ({ page }) => {
      await page.goto("http://localhost:5173/Board-Board/");
    });

    test("Users can create Boards", async ({ page }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create a new board and verify it appears in the dashboard
      await createBoard(page, board1Name);
    });

    test("Users can view their Boards", async ({ page }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create a new board and verify it appears in the dashboard
      await createBoard(page, board1Name);

      // Get the new board's button (the whole row is a button) and open the board
      const boardRowButton = page.locator("td", { hasText: board1Name });
      await expect(boardRowButton).toBeVisible();
      await expect(boardRowButton).toHaveCount(1);
      await boardRowButton.click();
      // console.log(await boardRowButton.evaluate((el) => el.outerHTML));

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
      // console.log(await boardHeader.evaluate((el) => el.outerHTML));
      await expect(boardHeader).toBeVisible();
      await expect(boardHeader).toHaveCount(1);
    });

    test("Users can rename their Boards", async ({ page }) => {
      const newBoardName = "Renamed Board";

      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create a new board and verify it appears in the dashboard
      await createBoard(page, board1Name);

      // Open the actions dropdown for the board
      const boardActionsDropdown = page.locator('button[aria-label="Actions dropdown"]');
      await expect(boardActionsDropdown).toBeVisible();
      await expect(boardActionsDropdown).toHaveCount(1);
      await boardActionsDropdown.click();

      // Open the Rename modal for the board
      const renameButton = page.locator("button", { hasText: "Rename" });
      await expect(renameButton).toBeVisible();
      await expect(renameButton).toHaveCount(1);
      await renameButton.click();

      // Verify the Rename modal was opened
      const renameModalHeader = page.locator("h2", { hasText: "Rename Board" });
      await expect(renameModalHeader).toHaveCount(1);

      // Fill in the board's new name
      const boardNameInput = page.locator(`input[placeholder="${board1Name}"]`);
      await boardNameInput.fill(newBoardName);

      // Rename the Board
      const renameBoardButton = page.locator("button", { hasText: "Rename Board" });
      await expect(renameBoardButton).toBeVisible();
      await expect(renameBoardButton).toHaveCount(1);
      await renameBoardButton.click();

      // Verify the modal window was closed
      await expect(renameBoardButton).not.toBeVisible();

      // Verify the board was renamed
      const boardRowButton = page.locator("tr", { hasText: newBoardName });
      await expect(boardRowButton).toBeVisible();
      await expect(boardRowButton).toHaveCount(1);
    });

    test("Users can delete their Boards", async ({ page }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create a new board and verify it appears in the dashboard
      await createBoard(page, board1Name);

      // Open the actions dropdown for the board
      const boardActionsDropdown = page.locator('button[aria-label="Actions dropdown"]');
      await expect(boardActionsDropdown).toBeVisible();
      await expect(boardActionsDropdown).toHaveCount(1);
      await boardActionsDropdown.click();

      // Open the Delete modal for the board
      const deleteButton = page.locator("button", { hasText: "Delete" });
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toHaveCount(1);
      await deleteButton.click();

      // Verify the Delete modal was opened
      const deleteModalHeader = page.locator("h2", { hasText: "Delete Board" });
      await expect(deleteModalHeader).toHaveCount(1);

      // Delete the Board
      const deleteBoardButton = page.locator("button.delete-button", { hasText: "Delete" });
      await expect(deleteBoardButton).toBeVisible();
      await expect(deleteBoardButton).toHaveCount(1);
      await deleteBoardButton.click();

      // Verify the modal window was closed
      await expect(deleteBoardButton).not.toBeVisible();

      // Verify the board was deleted
      const boardRowButton = page.locator("tr", { hasText: board1Name });
      await expect(boardRowButton).not.toBeVisible();
      await expect(boardRowButton).not.toHaveCount(1);
      const noDataText = page.locator("td", { hasText: "No data" });
      await expect(noDataText).toBeVisible();
      await expect(noDataText).toHaveCount(1);
    });

    test("User can filter their Boards", async ({ page }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create some boards
      await createBoard(page, board1Name);
      await createBoard(page, board2Name);

      // Filter for the first board
      const filterInput = page.locator('input[placeholder="Filter..."]');
      await filterInput.fill(board1Name);

      // Verify first board is still visible
      const board1RowButton = page.locator("tr", { hasText: board1Name });
      await expect(board1RowButton).toBeVisible();
      await expect(board1RowButton).toHaveCount(1);

      // Verify second board is NOT visible
      const board2RowButton = page.locator("tr", { hasText: board2Name });
      await expect(board2RowButton).not.toBeVisible();
      await expect(board2RowButton).toHaveCount(0);
    });

    test("User can sort their Boards", async ({ page }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create some boards
      await createBoard(page, board1Name);
      await createBoard(page, board2Name);

      // Verify the starting order of the boards
      const board1RowButton = page.locator("tr").nth(2);
      await expect(board1RowButton).toContainText(board1Name);
      await expect(board1RowButton).toBeVisible();
      await expect(board1RowButton).toHaveCount(1);
      const board2RowButton = page.locator("tr").nth(3);
      await expect(board2RowButton).toContainText(board2Name);
      await expect(board2RowButton).toBeVisible();
      await expect(board2RowButton).toHaveCount(1);

      // Sort the boards by Name
      const nameColumnButton = page.locator("button", { hasText: "Name" });
      await expect(nameColumnButton).toBeVisible();
      await expect(nameColumnButton).toHaveCount(1);
      await nameColumnButton.click();

      // Verify that the boards are sorted in descending order by Name
      const sortedBoard1RowButton = page.locator("tr").nth(3);
      await expect(sortedBoard1RowButton).toContainText(board1Name);
      await expect(sortedBoard1RowButton).toBeVisible();
      await expect(sortedBoard1RowButton).toHaveCount(1);
      const sortedBoard2RowButton = page.locator("tr").nth(2);
      await expect(sortedBoard2RowButton).toContainText(board2Name);
      await expect(sortedBoard2RowButton).toBeVisible();
      await expect(sortedBoard2RowButton).toHaveCount(1);
    });

    test("Creating Boards with names less than 3 characters fails", async ({ page }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Open the Create Board modal
      const newBoardButton = page.locator("button", { hasText: "New Board" });
      await expect(newBoardButton).toBeVisible();
      await expect(newBoardButton).toHaveCount(1);
      await newBoardButton.click();

      // Verify the Create Board modal was opened
      const createBoardModalHeader = page.locator("h2", { hasText: "Create a New Board" });
      await expect(createBoardModalHeader).toHaveCount(1);

      // Fill in the board's name (with a name that is too short)
      const boardNameInput = page.locator('input[placeholder="Board name"]');
      await boardNameInput.fill(boardBadName);

      // Try to create the Board
      const createBoardButton = page.locator("button", { hasText: "Create Board" });
      await expect(createBoardButton).toBeVisible();
      await expect(createBoardButton).toHaveCount(1);
      await createBoardButton.click();

      // Verify the error message appeared
      const boardErrorMessage = page.locator("div.text-error", {
        hasText: "Board name is too short!",
      });
      await expect(boardErrorMessage).toBeVisible();
      await expect(boardErrorMessage).toHaveCount(1);
    });

    test("Exiting the Board creation modal after typing a name clears the input field", async ({
      page,
    }) => {
      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Open the Create Board modal
      const newBoardButton = page.locator("button", { hasText: "New Board" });
      await expect(newBoardButton).toBeVisible();
      await expect(newBoardButton).toHaveCount(1);
      await newBoardButton.click();

      // Verify the Create Board modal was opened
      const createBoardModalHeader = page.locator("h2", { hasText: "Create a New Board" });
      await expect(createBoardModalHeader).toBeVisible();
      await expect(createBoardModalHeader).toHaveCount(1);

      // Fill in the board name field
      const boardNameInput = page.locator('input[placeholder="Board name"]');
      await boardNameInput.fill(boardBadName);
      await expect(boardNameInput).toHaveValue(boardBadName);

      // Close the modal without creating the board
      const closeButton = page.locator("button.create-board-modal-close-button");
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveCount(1);
      await closeButton.click();

      // Reopen the modal
      await newBoardButton.click();

      // Verify the modal was opened
      const createBoardModalHeader2 = page.locator("h2", { hasText: "Create a New Board" });
      await expect(createBoardModalHeader2).toBeVisible();
      await expect(createBoardModalHeader2).toHaveCount(1);

      // Verify the input field started empty (the field was cleared when the modal was closed)
      const boardNameInput2 = page.locator('input[placeholder="Board name"]');
      await expect(boardNameInput2).toHaveValue("");
    });

    test("Renaming Boards with names less than 3 characters fails", async ({ page }) => {
      const newBoardName = "Hi";

      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create a new board and verify it appears in the dashboard
      await createBoard(page, board1Name);

      // Open the actions dropdown for the board
      const boardActionsDropdown = page.locator('button[aria-label="Actions dropdown"]');
      await expect(boardActionsDropdown).toBeVisible();
      await expect(boardActionsDropdown).toHaveCount(1);
      await boardActionsDropdown.click();

      // Open the rename modal for the board
      const renameButton = page.locator("button", { hasText: "Rename" });
      await expect(renameButton).toBeVisible();
      await expect(renameButton).toHaveCount(1);
      await renameButton.click();

      // Verify the rename modal was opened
      const renameModalHeader = page.locator("h2", { hasText: "Rename Board" });
      await expect(renameModalHeader).toHaveCount(1);

      // Fill in the board's new name
      const boardNameInput = page.locator(`input[placeholder="${board1Name}"]`);
      await boardNameInput.fill(newBoardName);

      // Attempt to rename the board
      const renameBoardButton = page.locator("button", { hasText: "Rename Board" });
      await expect(renameBoardButton).toBeVisible();
      await expect(renameBoardButton).toHaveCount(1);
      await renameBoardButton.click();

      // Verify the error message appeared
      const boardErrorMessage = page.locator("div.text-error", {
        hasText: "Board name is too short!",
      });
      await expect(boardErrorMessage).toBeVisible();
      await expect(boardErrorMessage).toHaveCount(1);
    });

    test("Exiting the Board rename modal after typing a name clears the input field", async ({
      page,
    }) => {
      const newBoardName = "Renamed";

      // Sign up a new user and verify that the dashboard was reached
      await signUp(page, user1Email, user1Password, user1Name);

      // Create a new board and verify it appears in the dashboard
      await createBoard(page, board1Name);

      // Open the actions dropdown for the board
      const boardActionsDropdown = page.locator('button[aria-label="Actions dropdown"]');
      await expect(boardActionsDropdown).toBeVisible();
      await expect(boardActionsDropdown).toHaveCount(1);
      await boardActionsDropdown.click();

      // Open the rename modal for the board
      const renameButton = page.locator("button", { hasText: "Rename" });
      await expect(renameButton).toBeVisible();
      await expect(renameButton).toHaveCount(1);
      await renameButton.click();

      // Verify the rename modal was opened
      const renameModalHeader = page.locator("h2", { hasText: "Rename Board" });
      await expect(renameModalHeader).toHaveCount(1);

      // Fill in the board's new name
      const boardNameInput = page.locator(`input[placeholder="${board1Name}"]`);
      await boardNameInput.fill(newBoardName);

      // Close the modal without creating the board
      const closeButton = page.locator("button.create-board-modal-close-button");
      await expect(closeButton).toBeVisible();
      await expect(closeButton).toHaveCount(1);
      await closeButton.click();

      // Reopen the modal
      await boardActionsDropdown.click();
      await renameButton.click();

      // Verify the modal was opened
      const renameModalHeader2 = page.locator("h2", { hasText: "Rename Board" });
      await expect(renameModalHeader2).toHaveCount(1);

      // Verify the input field started empty (the field was cleared when the modal was closed)
      const boardNameInput2 = page.locator(`input[placeholder="${board1Name}"]`);
      await expect(boardNameInput2).toHaveValue("");
    });
  });

  test.describe("Multi-page tests", () => {
    test("User can share their Boards to their friends", async ({ browser }) => {
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
      await createBoard(user1Page, board1Name);

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
      const boardRowButton = user2Page.locator("td", { hasText: board1Name });
      await expect(boardRowButton).toBeVisible();
      await expect(boardRowButton).toHaveCount(1);
    });

    test("User can view Boards that were shared to them", async ({ browser }) => {
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
      await createBoard(user1Page, board1Name);

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
      const boardRowButton = user2Page.locator("td", { hasText: board1Name });
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

    test("User can unshare their Boards that they shared to their friends", async ({ browser }) => {
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
      await createBoard(user1Page, board1Name);

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
      const boardRowButton = user2Page.locator("td", { hasText: board1Name });
      await expect(boardRowButton).toBeVisible();
      await expect(boardRowButton).toHaveCount(1);

      // Unshare the board
      await unshareButton.click();
      await expect(shareButtons).toHaveCount(2); // user2 can be shared to again

      // Refresh user2's dashboard to load in the updated board list
      await user2Page.reload();

      // Verify user2 can NOT see the board on their dashboard anymore
      await expect(boardRowButton).not.toBeVisible();
      await expect(boardRowButton).toHaveCount(0);
    });

    test("User can leave Boards that were shared to them by their friends", async ({ browser }) => {
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
      await createBoard(user1Page, board1Name);

      // Open the share modal
      const shareModalButton = user1Page.locator("button", { hasText: "Share" });
      await expect(shareModalButton).toBeVisible();
      await expect(shareModalButton).toHaveCount(1);
      await shareModalButton.click();

      // Verify the share board modal was opened
      const shareBoardModalHeader = user1Page.locator("h2", { hasText: "Share Board" });
      await expect(shareBoardModalHeader).toBeVisible();
      await expect(shareBoardModalHeader).toHaveCount(1);

      // Verify that the friend of user2 appears in the modal
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

      // Close the share modal
      const closeModalButton = user1Page.getByRole("button", { name: "Close" });
      await expect(closeModalButton).toBeVisible();
      await expect(closeModalButton).toHaveCount(1);
      await closeModalButton.click();

      // Refresh user2's dashboard to load in the new board
      await user2Page.reload();

      // Verify user2 can see the board on their dashboard
      const boardRowButton = user2Page.locator("td", { hasText: board1Name });
      await expect(boardRowButton).toBeVisible();
      await expect(boardRowButton).toHaveCount(1);

      // Open the leave board modal for the shared board
      const leaveButton = user2Page.locator("button", { hasText: "Leave Board" });
      await expect(leaveButton).toBeVisible();
      await expect(leaveButton).toHaveCount(1);
      await leaveButton.click();

      // Verify the leave board modal was opened
      const leaveBoardModalHeader = user2Page.locator("h2", { hasText: "Leave Board" });
      await expect(leaveBoardModalHeader).toBeVisible();
      await expect(leaveBoardModalHeader).toHaveCount(1);
      await expect(leaveButton).toHaveCount(2);

      // Leave the board (stop receiving the board-share)
      await leaveButton.nth(1).click();

      // Verify user2 can NOT see the board on their dashboard anymore
      await expect(boardRowButton).not.toBeVisible();
      await expect(boardRowButton).toHaveCount(0);

      // Reopen the share modal
      await expect(shareModalButton).toBeVisible();
      await expect(shareModalButton).toHaveCount(1);
      await shareModalButton.click();

      // Verify the share board modal was opened
      await expect(shareBoardModalHeader).toBeVisible();
      await expect(shareBoardModalHeader).toHaveCount(1);

      // Verify that user2 appears in the modal in the 'available to share' list instead of the 'shared' list
      await expect(friendElement).toBeVisible();
      await expect(friendElement).toHaveCount(1);
      await expect(shareButtons).toHaveCount(2);
      await expect(shareButton).toBeVisible();
    });

    test("Trying to share a Board without friends shows a warning message", async ({ browser }) => {
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
      await createBoard(user1Page, board1Name);

      // Open the share modal
      const shareModalButton = user1Page.locator("button", { hasText: "Share" });
      await expect(shareModalButton).toBeVisible();
      await expect(shareModalButton).toHaveCount(1);
      await shareModalButton.click();

      // Verify the Share Board modal was opened
      const shareBoardModalHeader = user1Page.locator("h2", { hasText: "Share Board" });
      await expect(shareBoardModalHeader).toBeVisible();
      await expect(shareBoardModalHeader).toHaveCount(1);

      // Verify the error message appeared
      const shareErrorMessage = user1Page.locator("p.text-error", {
        hasText: "Without friends, you cannot share Boards to anyone.",
      });
      await expect(shareErrorMessage).toBeVisible();
      await expect(shareErrorMessage).toHaveCount(1);
    });

    test("User can rename their Boards after sharing with their friends", async ({ browser }) => {
      const newBoardName = "Renamed Board";

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
      await createBoard(user1Page, board1Name);

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

      // Close the share modal
      const closeModalButton = user1Page.getByRole("button", { name: "Close" });
      await expect(closeModalButton).toBeVisible();
      await expect(closeModalButton).toHaveCount(1);
      await closeModalButton.click();

      // Refresh user2's dashboard to load in the new board
      await user2Page.reload();

      // Verify user2 can see the board on their dashboard
      const user2BoardRowButton = user2Page.locator("td", { hasText: board1Name });
      await expect(user2BoardRowButton).toBeVisible();
      await expect(user2BoardRowButton).toHaveCount(1);

      // Open the actions dropdown for the board
      const boardActionsDropdown = user1Page.locator('button[aria-label="Actions dropdown"]');
      await expect(boardActionsDropdown).toBeVisible();
      await expect(boardActionsDropdown).toHaveCount(1);
      await boardActionsDropdown.click();

      // Open the Rename modal for the board
      const renameButton = user1Page.locator("button", { hasText: "Rename" });
      await expect(renameButton).toBeVisible();
      await expect(renameButton).toHaveCount(1);
      await renameButton.click();

      // Verify the Rename modal was opened
      const renameModalHeader = user1Page.locator("h2", { hasText: "Rename Board" });
      await expect(renameModalHeader).toHaveCount(1);

      // Fill in the board's new name
      const boardNameInput = user1Page.locator(`input[placeholder="${board1Name}"]`);
      await boardNameInput.fill(newBoardName);

      // Rename the Board
      const renameBoardButton = user1Page.locator("button", { hasText: "Rename Board" });
      await expect(renameBoardButton).toBeVisible();
      await expect(renameBoardButton).toHaveCount(1);
      await renameBoardButton.click();

      // Verify the modal window was closed
      await expect(renameBoardButton).not.toBeVisible();

      // Verify the board was renamed
      const user1BoardRowButton = user1Page.locator("tr", { hasText: newBoardName });
      await expect(user1BoardRowButton).toBeVisible();
      await expect(user1BoardRowButton).toHaveCount(1);

      // Verify that user2 also sees the new name
      await user2Page.reload();
      const renamedUser2BoardRowButton = user2Page.locator("td", { hasText: newBoardName });
      await expect(renamedUser2BoardRowButton).toBeVisible();
      await expect(renamedUser2BoardRowButton).toHaveCount(1);
    });

    test("User can delete their Boards after sharing with their friends", async ({ browser }) => {
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
      await createBoard(user1Page, board1Name);

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

      // Close the share modal
      const closeModalButton = user1Page.getByRole("button", { name: "Close" });
      await expect(closeModalButton).toBeVisible();
      await expect(closeModalButton).toHaveCount(1);
      await closeModalButton.click();

      // Refresh user2's dashboard to load in the new board
      await user2Page.reload();

      // Verify user2 can see the board on their dashboard
      const user2BoardRowButton = user2Page.locator("td", { hasText: board1Name });
      await expect(user2BoardRowButton).toBeVisible();
      await expect(user2BoardRowButton).toHaveCount(1);

      // Open the actions dropdown for the board
      const boardActionsDropdown = user1Page.locator('button[aria-label="Actions dropdown"]');
      await expect(boardActionsDropdown).toBeVisible();
      await expect(boardActionsDropdown).toHaveCount(1);
      await boardActionsDropdown.click();

      // Open the Delete modal for the board
      const deleteButton = user1Page.locator("button", { hasText: "Delete" });
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toHaveCount(1);
      await deleteButton.click();

      // Verify the Delete modal was opened
      const deleteModalHeader = user1Page.locator("h2", { hasText: "Delete Board" });
      await expect(deleteModalHeader).toHaveCount(1);

      // Delete the Board
      const deleteBoardButton = user1Page.locator("button.delete-button", { hasText: "Delete" });
      await expect(deleteBoardButton).toBeVisible();
      await expect(deleteBoardButton).toHaveCount(1);
      await deleteBoardButton.click();

      // Verify the modal window was closed
      await expect(deleteBoardButton).not.toBeVisible();

      // Verify the board was deleted
      const user1BoardRowButton = user1Page.locator("tr", { hasText: board1Name });
      await expect(user1BoardRowButton).not.toBeVisible();
      await expect(user1BoardRowButton).not.toHaveCount(1);
      const user1NoDataText = user1Page.locator("td", { hasText: "No data" });
      await expect(user1NoDataText).toBeVisible();
      await expect(user1NoDataText).toHaveCount(1);

      // Verify that user2 also no longer sees the board
      await user2Page.reload();
      await expect(user2BoardRowButton).not.toBeVisible();
      await expect(user2BoardRowButton).not.toHaveCount(1);
      const user2NoDataText = user2Page.locator("td", { hasText: "No data" });
      await expect(user2NoDataText).toBeVisible();
      await expect(user2NoDataText).toHaveCount(1);
    });
  });
});
