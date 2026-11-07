import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  startBackend,
  refreshBackend,
  signUp,
  createBoard,
  openBoard,
  createNote,
  cardBox,
  cardWorldPosition,
  dragCard,
  expectStyle,
  openSubmenu,
  pickFromMenu,
} from "./utils";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});

// The note colours used by these tests, as the browser reports them (light mode, see the card palette in main.css)
const GREEN = "rgb(187, 247, 208)"; // The default note colour
const BLUE = "rgb(191, 219, 254)";
const PINK_TEXT = "rgb(190, 24, 93)";

// Click a note (a quick click, which starts editing its text)
async function clickNote(page: Page, note: Locator, offsetX = 60, offsetY = 40) {
  const box = await cardBox(note);
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
}

test.describe("Note Cards", () => {
  const userName = "ABC";
  const userEmail = "a@b.c";
  const userPassword = "testtest";
  const boardName = "New Board";

  // Ensure each test starts on a new, empty board
  test.beforeEach(async ({ page }) => {
    await signUp(page, userEmail, userPassword, userName);
    await createBoard(page, boardName);
    await openBoard(page, boardName);
  });

  test("Users can create notes, which start green and selected", async ({ page }) => {
    // Verify the Note button shows the colour new notes will have
    const noteButton = page.locator("button.toolbar-note-button");
    await expectStyle(noteButton, "backgroundColor", GREEN);

    // Create a note and verify it is green, selected and empty
    const note = await createNote(page);
    await expectStyle(note.locator(".note-card"), "backgroundColor", GREEN);
    await expect(note).toHaveClass(/board-card-selected/);
    await expect(note.locator(".note-textarea")).toHaveValue("");
  });

  test("Users can move and resize notes, and the changes are saved", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardBox(note);

    // Drag the note and verify it moved with the pointer
    await dragCard(page, note, 150, 100);
    const moved = await cardBox(note);
    expect(moved.x - before.x).toBeCloseTo(150, 0);
    expect(moved.y - before.y).toBeCloseTo(100, 0);

    // Resize the note from its bottom-right corner and verify it grew with the pointer
    await page.mouse.move(moved.x + moved.width - 2, moved.y + moved.height - 2);
    await page.mouse.down();
    await page.mouse.move(moved.x + moved.width + 78, moved.y + moved.height + 58, { steps: 10 });
    await page.mouse.up();
    const resized = await cardBox(note);
    expect(resized.width - moved.width).toBeCloseTo(80, 0);
    expect(resized.height - moved.height).toBeCloseTo(60, 0);

    // Resize the note from its left edge past its right edge, and verify it stops at its minimum width (80)
    await page.mouse.move(resized.x + 2, resized.y + resized.height / 2);
    await page.mouse.down();
    await page.mouse.move(resized.x + 600, resized.y + resized.height / 2, { steps: 15 });
    await page.mouse.up();
    const minimum = await cardBox(note);
    expect(minimum.width).toBeCloseTo(80, 0);

    // Reload the board and verify the note kept its position and size
    const world = await cardWorldPosition(note);
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(note).toHaveCount(1);
    expect(await cardWorldPosition(note)).toEqual(world);
    const reloadedWidth = await note.evaluate((el) => (el as HTMLElement).style.width);
    expect(parseFloat(reloadedWidth)).toBeCloseTo(80, 0);
  });

  test("Clicking a note edits its text, which is saved", async ({ page }) => {
    const note = await createNote(page);
    const textarea = note.locator(".note-textarea");

    // Click the note and verify its text is being edited
    await clickNote(page, note);
    await expect(note).toHaveClass(/board-card-editing/);
    await expect(textarea).toBeFocused();

    // Type into the note
    await page.keyboard.type("Hello world");
    await expect(textarea).toHaveValue("Hello world");

    // Press Escape and verify editing stopped (the note stays selected)
    await page.keyboard.press("Escape");
    await expect(note).not.toHaveClass(/board-card-editing/);
    await expect(textarea).not.toBeFocused();
    await expect(note).toHaveClass(/board-card-selected/);

    // Reload the board and verify the text was saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(note.locator(".note-textarea")).toHaveValue("Hello world");
  });

  test("Holding or dragging a note doesn't edit it", async ({ page }) => {
    const note = await createNote(page);
    const box = await cardBox(note);

    // Press and hold the note without moving, and verify it is picked up (lifted) instead of edited
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await expect(note).toHaveClass(/board-card-lifted/);
    await page.mouse.up();
    await expect(note).not.toHaveClass(/board-card-editing/);
    await expect(note).not.toHaveClass(/board-card-lifted/);

    // Drag the note straight away and verify it moved without being edited
    await dragCard(page, note, 100, 0);
    const moved = await cardBox(note);
    expect(moved.x - box.x).toBeCloseTo(100, 0);
    await expect(note).not.toHaveClass(/board-card-editing/);
  });

  test("While editing, dragging the text selects it and dragging the frame moves the note", async ({
    page,
  }) => {
    const note = await createNote(page);
    const textarea = note.locator(".note-textarea");
    await clickNote(page, note);
    await page.keyboard.type("Hello world");
    const box = await cardBox(note);

    // Drag across the text and verify it was selected without moving the note
    await page.mouse.move(box.x + 20, box.y + 26);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 26, { steps: 6 });
    await page.mouse.up();
    const selectedText = await textarea.evaluate((el) => {
      const element = el as HTMLTextAreaElement;
      return element.value.slice(element.selectionStart, element.selectionEnd);
    });
    expect(selectedText.length).toBeGreaterThan(0);
    expect((await cardBox(note)).x).toBeCloseTo(box.x, 0);

    // Drag the frame around the text and verify the note moved and is still being edited
    await page.mouse.move(box.x + 10, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 140, { steps: 8 });
    await page.mouse.up();
    const moved = await cardBox(note);
    expect(moved.x - box.x).toBeCloseTo(80, 0);
    expect(moved.y - box.y).toBeCloseTo(40, 0);
    await expect(note).toHaveClass(/board-card-editing/);
    await expect(textarea).toBeFocused();
  });

  test("Notes grow taller when their text no longer fits", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardBox(note);

    // Type more lines than the note can show
    await clickNote(page, note);
    await page.keyboard.type("First line");
    for (let i = 0; i < 10; i++) await page.keyboard.press("Enter");
    await page.keyboard.type("Last line");

    // Verify the note grew taller (and not wider)
    const after = await cardBox(note);
    expect(after.height).toBeGreaterThan(before.height);
    expect(after.width).toBeCloseTo(before.width, 0);
  });

  test("Users can change a note's colour, which new notes then use", async ({ page }) => {
    const note = await createNote(page);

    // Pick Blue from the note's Colour menu and verify the note turned blue
    await pickFromMenu(page, note, "Colour", "Blue");
    await expectStyle(note.locator(".note-card"), "backgroundColor", BLUE);

    // Verify the Note button and the next note use the colour that was picked last
    const noteButton = page.locator("button.toolbar-note-button");
    await expectStyle(noteButton, "backgroundColor", BLUE);
    const secondNote = await createNote(page);
    await expectStyle(secondNote.locator(".note-card"), "backgroundColor", BLUE);

    // Pick a text colour for the second note (it is in front, covering the first note's middle)
    // and verify its text uses it
    await pickFromMenu(page, secondNote, "Text colour", "Pink");
    await expectStyle(secondNote.locator(".note-card"), "color", PINK_TEXT);

    // Reload the board and verify the colours and the Note button's colour were saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expectStyle(note.locator(".note-card"), "backgroundColor", BLUE);
    await expectStyle(secondNote.locator(".note-card"), "color", PINK_TEXT);
    await expectStyle(noteButton, "backgroundColor", BLUE);
  });

  test("Users can pick a custom note colour by hex code", async ({ page }) => {
    const note = await createNote(page);

    // Open the custom colour picker from the note's Colour menu
    await openSubmenu(page, note, "Colour");
    await page.getByRole("menuitemcheckbox", { name: "Custom…" }).click();
    const hexInput = page.locator(".custom-color-hex-input input");
    await expect(hexInput).toBeVisible();

    // Type a hex code and apply it
    await hexInput.fill("#ff8800");
    await page.locator("button.custom-color-apply-button").click();
    await expect(hexInput).not.toBeVisible();

    // Verify the note uses the custom colour, with readable (black) auto text on it
    await expectStyle(note.locator(".note-card"), "backgroundColor", "rgb(255, 136, 0)");
    await expectStyle(note.locator(".note-card"), "color", "rgb(0, 0, 0)");
  });

  test("Users can change a note's text size, by preset or by typing it", async ({ page }) => {
    const note = await createNote(page);
    const textarea = note.locator(".note-textarea");
    await expectStyle(textarea, "fontSize", "16px");

    // Verify a bigger text size doesn't grow an empty note (its placeholder text doesn't count)
    const empty = await cardBox(note);
    await pickFromMenu(page, note, "Text size", "64");
    await expectStyle(textarea, "fontSize", "64px");
    expect((await cardBox(note)).height).toBeCloseTo(empty.height, 0);

    // Pick a preset size from the Text size menu
    await pickFromMenu(page, note, "Text size", "32");
    await expectStyle(textarea, "fontSize", "32px");

    // Type a size into the Text size menu's field
    await openSubmenu(page, note, "Text size");
    const sizeInput = page.locator("input.font-size-input");
    await expect(sizeInput).toBeVisible();
    await sizeInput.fill("20");
    await sizeInput.press("Enter");
    await expectStyle(textarea, "fontSize", "20px");

    // Verify letters typed into the field stay there (the menu doesn't take them to jump between items)
    await sizeInput.fill("");
    await sizeInput.press("a");
    await expect(sizeInput).toHaveValue("a");
    await expect(sizeInput).toBeFocused();

    // Verify a typed size above the maximum is clamped to 200
    await sizeInput.fill("999");
    await sizeInput.press("Enter");
    await expectStyle(textarea, "fontSize", "200px");
    await page.keyboard.press("Escape");
  });

  test("A bigger text size grows a note to fit its text", async ({ page }) => {
    const note = await createNote(page);

    // Write a few lines in the note
    const box = await cardBox(note);
    await page.mouse.click(box.x + 60, box.y + 40);
    await page.keyboard.type("One");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Two");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Three");
    await page.keyboard.press("Escape");
    const before = await cardBox(note);

    // Pick a much bigger text size and verify the note grew taller to fit the text
    await pickFromMenu(page, note, "Text size", "48");
    await expect.poll(async () => (await cardBox(note)).height).toBeGreaterThan(before.height);
  });

  test("Users can set the next note's colour and text size from the Note button", async ({
    page,
  }) => {
    const noteButton = page.locator("button.toolbar-note-button");

    // Pick the next note's colour and text size by right-clicking the Note button
    await pickFromMenu(page, noteButton, "Next note colour", "Blue");
    await pickFromMenu(page, noteButton, "Next note text size", "24");

    // Verify the button shows the colour, but its own text size didn't change
    await expectStyle(noteButton, "backgroundColor", BLUE);
    await expectStyle(noteButton, "fontSize", "14px");

    // Create a note and verify it uses both
    const note = await createNote(page);
    await expectStyle(note.locator(".note-card"), "backgroundColor", BLUE);
    await expectStyle(note.locator(".note-textarea"), "fontSize", "24px");
  });

  test("Touched notes come to the front, and notes can be moved between layers", async ({
    page,
  }) => {
    const first = await createNote(page);
    const second = await createNote(page);
    const zIndex = (note: Locator) =>
      note.evaluate((el) => Number((el as HTMLElement).style.zIndex));

    // Verify the newer note is in front
    expect(await zIndex(second)).toBeGreaterThan(await zIndex(first));

    // Touch the first note (where it isn't covered by the second) and verify it came to the front
    const box = await cardBox(first);
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    expect(await zIndex(first)).toBeGreaterThan(await zIndex(second));

    // Send the first note to the back layer and verify it went behind the second
    await pickFromMenu(page, first, "Layer", "Back");
    expect(await zIndex(first)).toBeLessThan(await zIndex(second));

    // Touch the first note again and verify it stays behind (it is only in front within its own layer)
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    expect(await zIndex(first)).toBeLessThan(await zIndex(second));
  });

  test("Users can delete notes with the Delete key or the menu", async ({ page }) => {
    const first = await createNote(page);
    await createNote(page);
    const cards = page.locator(".board-card");

    // Press Delete with the newest note selected and verify it was deleted
    await page.keyboard.press("Delete");
    await expect(cards).toHaveCount(1);

    // Delete the other note from its menu
    const box = await cardBox(first);
    await page.mouse.click(box.x + 60, box.y + 60, { button: "right" });
    const deleteItem = page.getByRole("menuitem", { name: "Delete" });
    await expect(deleteItem).toBeVisible();
    await deleteItem.click();
    await expect(cards).toHaveCount(0);

    // Reload the board and verify the deletes were saved
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);
    await expect(cards).toHaveCount(0);
  });
});
