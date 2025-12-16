import { test, expect } from "@playwright/test";
import { startBackend, refreshBackend, signUp, createBoard } from "./utils";

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

      await expect(true).toBe(false);
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

      await expect(true).toBe(false);
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

      await expect(true).toBe(false);
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

      await expect(true).toBe(false);
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

      await expect(true).toBe(false);
    });

    test("User can rename their Boards after sharing with their friends", async ({ browser }) => {
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

      await expect(true).toBe(false);
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

      await expect(true).toBe(false);
    });
  });
});
