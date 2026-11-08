import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  startBackend,
  refreshBackend,
  signUp,
  createBoard,
  sendAndAcceptFriendRequest,
  shareBoardWith,
  openBoard,
  createNote,
  createShape,
  setDrawTool,
  cardBox,
  cardWorldPosition,
  dragCard,
  expectStyle,
  pickFromMenu,
} from "./utils";

// For every test...
// Ensure a fresh database exists
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);

const user1Name = "ABC";
const user1Email = "a@b.c";
const user2Name = "DEF";
const user2Email = "d@e.f";
const userPassword = "testtest";
const boardName = "Shared Board";

// Sign up two friends in their own browser contexts, share a board from user1 to user2,
// and open it for both of them
async function openSharedBoard(browser: Browser): Promise<[Page, Page]> {
  // Create a unique browser context for each user (the friend request flow uses the clipboard)
  const pages: Page[] = [];
  for (const [name, email] of [
    [user1Name, user1Email],
    [user2Name, user2Email],
  ] as const) {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    await page.goto("http://localhost:5173/Board-Board/");
    await signUp(page, email, userPassword, name);
    pages.push(page);
  }
  const [user1Page, user2Page] = pages as [Page, Page];

  // Have the users become friends, then share a board from user1 to user2
  await sendAndAcceptFriendRequest(user1Page, user1Name, user2Page, user2Name);
  await createBoard(user1Page, boardName);
  await shareBoardWith(user1Page, user2Name);

  // Refresh user2's dashboard to load in the shared board, then open the board for both users
  await user2Page.reload();
  await openBoard(user1Page, boardName);
  await openBoard(user2Page, boardName);

  return [user1Page, user2Page];
}

// The first card on a page (each page has its own copy of the same board)
function firstCard(page: Page) {
  return page.locator(".board-card").first();
}

test.describe("Board Collaboration", () => {
  // These tests use two users, so they take longer than the others
  test.slow();

  test("Other users see cards being created, moved, edited and deleted", async ({ browser }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);

    // User1 creates a note, and verify user2 sees it
    const note = await createNote(user1Page);
    const user2Note = firstCard(user2Page);
    await expect(user2Note).toHaveCount(1);

    // User1 drags the note. Verify user2 sees it moving during the drag, and ending up in the same place.
    const start = await cardWorldPosition(note);
    const box = await cardBox(note);
    await user1Page.mouse.move(box.x + 100, box.y + 100);
    await user1Page.mouse.down();
    await user1Page.mouse.move(box.x + 200, box.y + 160, { steps: 10 });
    await expect.poll(async () => (await cardWorldPosition(user2Note)).x).not.toBe(start.x);
    await user1Page.mouse.move(box.x + 300, box.y + 160, { steps: 10 });
    await user1Page.mouse.up();
    const end = await cardWorldPosition(note);
    await expect.poll(() => cardWorldPosition(user2Note)).toEqual(end);

    // User1 types in the note, and verify user2 sees the text while user1 is still editing
    const moved = await cardBox(note);
    await user1Page.mouse.click(moved.x + 60, moved.y + 40);
    await user1Page.keyboard.type("Hello from ABC");
    await expect(user2Note.locator(".note-textarea")).toHaveValue("Hello from ABC");
    await user1Page.keyboard.press("Escape");

    // User1 changes the note's colour, and verify user2 sees it
    await user1Page.mouse.click(moved.x + 60, moved.y + 60, { button: "right" });
    await user1Page.getByRole("menuitem", { name: "Colour", exact: true }).hover();
    await user1Page.getByRole("menuitemcheckbox", { name: "Pink" }).click();
    await expect
      .poll(() =>
        user2Note.locator(".note-card").evaluate((el) => getComputedStyle(el).backgroundColor),
      )
      .toBe("rgb(251, 207, 232)");

    // User1 deletes the note, and verify user2 sees it go
    await user1Page.mouse.click(moved.x + 60, moved.y + 60);
    await user1Page.keyboard.press("Escape");
    await user1Page.keyboard.press("Delete");
    await expect(user2Page.locator(".board-card")).toHaveCount(0);
  });

  test("Other users see shapes being created, moved, changed and deleted", async ({ browser }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);

    // User1 creates a shape, and verify user2 sees it
    const shape = await createShape(user1Page);
    const user2Shape = firstCard(user2Page);
    await expect(user2Shape.locator(".shape-card")).toHaveAttribute("data-shape", "square");

    // User1 drags the shape, and verify user2 sees it end up in the same place
    await dragCard(user1Page, shape, 120, 80);
    const end = await cardWorldPosition(shape);
    await expect.poll(() => cardWorldPosition(user2Shape)).toEqual(end);

    // User1 changes the shape and its colour, and verify user2 sees both
    await pickFromMenu(user1Page, shape, "Shape", "Circle");
    await expect(user2Shape.locator(".shape-card")).toHaveAttribute("data-shape", "circle");
    await pickFromMenu(user1Page, shape, "Colour", "Pink");
    await expectStyle(user2Shape.locator(".shape-card"), "fill", "rgb(251, 207, 232)");

    // User1 deletes the shape, and verify user2 sees it go
    await user1Page.keyboard.press("Delete");
    await expect(user2Page.locator(".board-card")).toHaveCount(0);
  });

  test("Other users see lines as they are drawn, then as cards", async ({ browser }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);
    const ghost = user2Page.locator(".draw-preview-stroke");

    // User1 starts a line and gives up on it, and verify user2 sees it appear, then go
    await setDrawTool(user1Page, true);
    await user1Page.mouse.move(400, 300);
    await user1Page.mouse.down();
    await user1Page.mouse.move(500, 360, { steps: 8 });
    await expect(ghost).toHaveCount(1);
    await user1Page.keyboard.press("Escape");
    await user1Page.mouse.up();
    await expect(ghost).toHaveCount(0);
    await expect(user2Page.locator(".board-card")).toHaveCount(0);

    // User1 draws a line, and verify user2 sees it while it's drawn, then as a card in the same place
    await user1Page.mouse.move(400, 300);
    await user1Page.mouse.down();
    await user1Page.mouse.move(500, 360, { steps: 8 });
    await expect(ghost).toHaveCount(1);
    await user1Page.mouse.move(600, 420, { steps: 8 });
    await user1Page.mouse.up();
    const drawing = user1Page.locator(".board-card").first();
    const user2Drawing = firstCard(user2Page);
    await expect(user2Drawing.locator(".draw-card")).toHaveCount(1);
    await expect(ghost).toHaveCount(0);
    expect(await cardWorldPosition(user2Drawing)).toEqual(await cardWorldPosition(drawing));

    // User1 makes the line thicker, which also grows the card around it.
    // Verify user2 sees the new thickness and the new size and position.
    await setDrawTool(user1Page, false);
    await pickFromMenu(user1Page, drawing, "Thickness", "16");
    await expectStyle(user2Drawing.locator(".draw-card-line"), "strokeWidth", "16px");
    const size = (card: typeof drawing) =>
      card.evaluate((el) => [(el as HTMLElement).style.width, (el as HTMLElement).style.height]);
    await expect.poll(() => size(user2Drawing)).toEqual(await size(drawing));
    await expect
      .poll(() => cardWorldPosition(user2Drawing))
      .toEqual(await cardWorldPosition(drawing));
  });

  test("A note being edited can't be edited or moved by other users", async ({ browser }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);
    const note = await createNote(user1Page);
    const user2Note = firstCard(user2Page);
    await expect(user2Note).toHaveCount(1);

    // User1 starts editing the note
    const box = await cardBox(note);
    await user1Page.mouse.click(box.x + 60, box.y + 40);
    await expect(note).toHaveClass(/board-card-editing/);
    await user1Page.waitForTimeout(500);

    // Verify user2 can't start editing it
    const user2Box = await cardBox(user2Note);
    await user2Page.mouse.click(user2Box.x + 60, user2Box.y + 40);
    await user2Page.waitForTimeout(300);
    await expect(user2Note).not.toHaveClass(/board-card-editing/);

    // Verify user2 can't drag it (on either user's screen)
    const position = await cardWorldPosition(note);
    await dragCard(user2Page, user2Note, 100, 100);
    await user2Page.waitForTimeout(500);
    expect(await cardWorldPosition(user2Note)).toEqual(position);
    expect(await cardWorldPosition(note)).toEqual(position);

    // User1 stops editing. Verify user2 can now drag the note, and user1 sees the move.
    await user1Page.keyboard.press("Escape");
    await user1Page.waitForTimeout(500);
    await dragCard(user2Page, user2Note, -60, 40);
    const moved = await cardWorldPosition(user2Note);
    expect(moved).not.toEqual(position);
    await expect.poll(() => cardWorldPosition(note)).toEqual(moved);
  });

  test("A note's lock is released after 10 seconds without typing", async ({ browser }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);
    const note = await createNote(user1Page);
    const user2Note = firstCard(user2Page);
    await expect(user2Note).toHaveCount(1);

    // User1 edits the note, then stops typing for over 10 seconds (the note stays in edit mode)
    const box = await cardBox(note);
    await user1Page.mouse.click(box.x + 60, box.y + 40);
    await user1Page.keyboard.type("one");
    await user1Page.waitForTimeout(11000);
    await expect(note).toHaveClass(/board-card-editing/);

    // Verify user2 can now move the note
    const position = await cardWorldPosition(user2Note);
    const user2Box = await cardBox(user2Note);
    await user2Page.mouse.move(user2Box.x + 100, user2Box.y + 100);
    await user2Page.mouse.down();
    await user2Page.mouse.move(user2Box.x + 160, user2Box.y + 100, { steps: 8 });
    expect((await cardWorldPosition(user2Note)).x).toBeGreaterThan(position.x);

    // While user2 is holding the note, verify user1's next keystroke is refused and user1 stops editing
    await user1Page.keyboard.type("X");
    await expect(note.locator(".note-textarea")).toHaveValue("one");
    await expect(note).not.toHaveClass(/board-card-editing/);
    await user2Page.mouse.up();
    await user2Page.waitForTimeout(500);

    // Once user2 lets go, verify user1 can edit the note again, and user2 sees the new text
    const moved = await cardBox(note);
    await user1Page.mouse.click(moved.x + 120, moved.y + 40);
    await user1Page.keyboard.press("End");
    await user1Page.keyboard.type(" two");
    await expect(user2Note.locator(".note-textarea")).toHaveValue("one two");
  });

  test("Both users grabbing the same note at once end up agreeing on where it is", async ({
    browser,
  }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);
    const note = await createNote(user1Page);
    const user2Note = firstCard(user2Page);
    await expect(user2Note).toHaveCount(1);
    await user1Page.waitForTimeout(500);

    // Both users press the note at the same moment and drag it opposite ways
    const box1 = await cardBox(note);
    const box2 = await cardBox(user2Note);
    await Promise.all([
      user1Page.mouse.move(box1.x + 100, box1.y + 100),
      user2Page.mouse.move(box2.x + 100, box2.y + 100),
    ]);
    await Promise.all([user1Page.mouse.down(), user2Page.mouse.down()]);
    await Promise.all([
      user1Page.mouse.move(box1.x + 250, box1.y + 100, { steps: 15 }),
      user2Page.mouse.move(box2.x - 50, box2.y + 100, { steps: 15 }),
    ]);
    await Promise.all([user1Page.mouse.up(), user2Page.mouse.up()]);

    // Verify both users end up seeing the note in the same place (the user who lost the grab catches up),
    // and that place was saved
    await expect
      .poll(async () => {
        const [position1, position2] = [
          await cardWorldPosition(note),
          await cardWorldPosition(user2Note),
        ];
        return position1.x === position2.x && position1.y === position2.y;
      })
      .toBe(true);
    const agreed = await cardWorldPosition(note);
    await user1Page.waitForTimeout(1000);
    await user1Page.reload();
    await expect.poll(() => cardWorldPosition(firstCard(user1Page))).toEqual(agreed);
  });

  test("Users who lose their connection catch up when it comes back", async ({ browser }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);
    const note = await createNote(user1Page);
    const user2Note = firstCard(user2Page);
    await expect(user2Note).toHaveCount(1);

    // User2 goes offline while user1 moves the note and creates another
    await user2Page.context().setOffline(true);
    await user2Page.waitForTimeout(500);
    await dragCard(user1Page, note, -80, -80);
    await createNote(user1Page);
    const moved = await cardWorldPosition(note);
    await user1Page.waitForTimeout(1000);

    // User2 comes back online, and verify they catch up on both changes
    await user2Page.context().setOffline(false);
    await expect(user2Page.locator(".board-card")).toHaveCount(2, { timeout: 15000 });
    await expect.poll(() => cardWorldPosition(user2Note), { timeout: 15000 }).toEqual(moved);
  });

  test("Users are sent to the dashboard when the board is unshared or deleted", async ({
    browser,
  }) => {
    const [user1Page, user2Page] = await openSharedBoard(browser);

    // User1 goes back to the dashboard and unshares the board
    await user1Page.locator("a", { hasText: "Dashboard" }).click();
    const shareModalButton = user1Page.locator("button", { hasText: "Share" });
    await expect(shareModalButton).toBeVisible();
    await shareModalButton.click();
    const unshareButton = user1Page.locator("button", { hasText: /^Unshare$/ });
    await expect(unshareButton).toBeVisible();
    await unshareButton.click();

    // Verify user2 was sent to the dashboard, with a message saying why
    await expect(user2Page).toHaveURL(/\/dashboard$/);
    await expect(user2Page.getByText("You no longer have access to this board.")).toBeVisible();

    // User1 shares the board again and both users open it
    await user1Page.keyboard.press("Escape");
    await expect(user1Page.locator("h2", { hasText: "Share Board" })).not.toBeVisible();
    await shareBoardWith(user1Page, user2Name);
    await user2Page.reload();
    await openBoard(user2Page, boardName);

    // User1 deletes the board
    const boardActionsDropdown = user1Page.locator('button[aria-label="Actions dropdown"]');
    await expect(boardActionsDropdown).toBeVisible();
    await boardActionsDropdown.click();
    await user1Page.locator("button", { hasText: "Delete" }).click();
    await expect(user1Page.locator("h2", { hasText: "Delete Board" })).toHaveCount(1);
    const deleteBoardButton = user1Page.locator("button.delete-button", { hasText: "Delete" });
    await expect(deleteBoardButton).toBeVisible();
    await deleteBoardButton.click();

    // Verify user2 was sent to the dashboard, with a message saying why
    await expect(user2Page).toHaveURL(/\/dashboard$/);
    await expect(user2Page.getByText("This board was deleted.")).toBeVisible();
  });
});
