import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  startBackend,
  refreshBackend,
  signUp,
  createBoard,
  openBoard,
  createNote,
  setDrawTool,
  drawLine,
  cardBox,
  cardWorldPosition,
  dragCard,
  expectStyle,
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

// The line colours used by these tests, as the browser reports them (light mode). Lines use the palette's
// stronger text shades (see the card palette in main.css).
const GREEN_LINE = "rgb(21, 128, 61)"; // The default line colour
const RED_LINE = "rgb(185, 28, 28)";
const BLUE_LINE = "rgb(29, 78, 216)";

// A drawing's visible line
function line(card: Locator): Locator {
  return card.locator(".draw-card-line");
}

// Where a drawing's line is on the screen (its centre), to check the line stays put when its card changes
async function lineCentre(card: Locator) {
  const box = await cardBox(line(card));
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Click a point on the page with the Select tool
async function clickAt(page: Page, x: number, y: number) {
  await setDrawTool(page, false);
  await page.mouse.click(x, y);
}

test.describe("Draw Cards", () => {
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

  test("Users can draw lines, which become green draw cards", async ({ page }) => {
    // Draw a line and verify it became a card with the default line colour and thickness
    const drawing = await drawLine(page, [
      [400, 300],
      [500, 380],
      [600, 320],
    ]);
    await expectStyle(line(drawing), "stroke", GREEN_LINE);
    await expectStyle(line(drawing), "strokeWidth", "4px");

    // Verify the line being drawn is gone, the new card isn't selected, and the Draw tool is still on
    await expect(page.locator(".draw-preview-stroke")).toHaveCount(0);
    await expect(drawing).not.toHaveClass(/board-card-selected/);
    await expect(page.locator("button.toolbar-draw-button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Verify the card is the line's size plus its padding (half the thickness and 8 on each side, at 100% zoom)
    const box = await cardBox(drawing);
    expect(box.width).toBeCloseTo(200 + 2 * 10, 0);
    expect(box.height).toBeCloseTo(80 + 2 * 10, 0);

    // Reload the board and verify the drawing was saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(drawing).toHaveCount(1);
    await expectStyle(line(drawing), "stroke", GREEN_LINE);
    // (The board fits its zoom to the cards when it opens, so compare sizes in world units)
    const worldSize = await drawing.evaluate((el) => ({
      width: parseFloat((el as HTMLElement).style.width),
      height: parseFloat((el as HTMLElement).style.height),
    }));
    expect(worldSize.width).toBeCloseTo(200 + 2 * 10, 0);
    expect(worldSize.height).toBeCloseTo(80 + 2 * 10, 0);
  });

  test("Clicking with the Draw tool draws a dot", async ({ page }) => {
    const dot = await drawLine(page, [[450, 350]]);
    const box = await cardBox(dot);
    expect(box.width).toBeCloseTo(2 * 10, 0);
    expect(box.height).toBeCloseTo(2 * 10, 0);

    // A dot is a line from a point to itself with round ends, which the browser draws as a circle.
    // (It has no length, so Playwright doesn't count it as visible.)
    await expect(line(dot)).toHaveAttribute("points", "10,10 10,10");
    expect(await line(dot).evaluate((el) => getComputedStyle(el).strokeLinecap)).toBe("round");
  });

  test("Lines can be drawn over cards without moving them", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardWorldPosition(note);
    const box = await cardBox(note);

    // Draw across the note, and verify the note didn't move and the line is in front of it
    const drawing = await drawLine(page, [
      [box.x - 40, box.y + 50],
      [box.x + box.width + 40, box.y + 150],
    ]);
    expect(await cardWorldPosition(note)).toEqual(before);
    const zIndex = (card: Locator) => card.evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(await zIndex(drawing)).toBeGreaterThan(await zIndex(note));
  });

  test("Escape drops a line being drawn, then turns off the Draw tool", async ({ page }) => {
    await setDrawTool(page, true);

    // Start a line, press Escape, then let go, and verify no card was made
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(500, 380, { steps: 8 });
    await expect(page.locator(".draw-preview-stroke")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".draw-preview-stroke")).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(page.locator(".board-card")).toHaveCount(0);

    // Press Escape again and verify the Draw tool turned off
    await page.keyboard.press("Escape");
    await expect(page.locator("button.toolbar-draw-button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("Adding a note or shape turns off the Draw tool", async ({ page }) => {
    await setDrawTool(page, true);
    await createNote(page);
    await expect(page.locator("button.toolbar-draw-button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("Users can move, resize and delete drawings", async ({ page }) => {
    const drawing = await drawLine(page, [
      [400, 300],
      [600, 420],
    ]);

    // Click the line with the Select tool and verify the drawing is selected
    await clickAt(page, 500, 360);
    await expect(drawing).toHaveClass(/board-card-selected/);

    // Drag the drawing and verify it moved with the pointer
    const before = await cardBox(drawing);
    await dragCard(page, drawing, 150, 80);
    const moved = await cardBox(drawing);
    expect(moved.x - before.x).toBeCloseTo(150, 0);
    expect(moved.y - before.y).toBeCloseTo(80, 0);

    // Resize the drawing from its bottom-right corner, and verify the line stretched but kept its thickness
    await page.mouse.move(moved.x + moved.width - 2, moved.y + moved.height - 2);
    await page.mouse.down();
    await page.mouse.move(moved.x + moved.width + 98, moved.y + moved.height + 58, { steps: 10 });
    await page.mouse.up();
    // (A line's box on the screen includes its thickness, 4)
    const lineBox = await cardBox(line(drawing));
    expect(lineBox.width).toBeCloseTo(300 + 4, 0);
    expect(lineBox.height).toBeCloseTo(180 + 4, 0);
    await expectStyle(line(drawing), "strokeWidth", "4px");

    // Reload the board and verify the drawing kept its position and size
    const world = await cardWorldPosition(drawing);
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(drawing).toHaveCount(1);
    expect(await cardWorldPosition(drawing)).toEqual(world);

    // Select the drawing and delete it with the Delete key
    const centre = await lineCentre(drawing);
    await page.mouse.click(centre.x, centre.y);
    await expect(drawing).toHaveClass(/board-card-selected/);
    await page.keyboard.press("Delete");
    await expect(page.locator(".board-card")).toHaveCount(0);
  });

  test("Only a drawing's line can be clicked until the drawing is selected", async ({ page }) => {
    const note = await createNote(page);
    const box = await cardBox(note);

    // Draw a line around three sides of the note, so the drawing's card covers the note
    const drawing = await drawLine(page, [
      [box.x + box.width + 30, box.y - 30],
      [box.x - 30, box.y - 30],
      [box.x - 30, box.y + box.height + 30],
      [box.x + box.width + 30, box.y + box.height + 30],
    ]);

    // Click the middle of the note (inside the drawing's card, but not on its line) and verify the note is selected
    await clickAt(page, box.x + box.width / 2, box.y + box.height / 2);
    await expect(note).toHaveClass(/board-card-selected/);

    // Click the line and verify the drawing is selected
    await page.mouse.click(box.x - 30, box.y + box.height / 2);
    await expect(drawing).toHaveClass(/board-card-selected/);
  });

  test("Users can change a line's colour and thickness, and new lines use them", async ({
    page,
  }) => {
    const drawing = await drawLine(page, [
      [400, 300],
      [600, 420],
    ]);
    await setDrawTool(page, false);
    const before = await lineCentre(drawing);

    // Pick a colour and a thickness from the drawing's menu, and verify the line changed but didn't move
    await pickFromMenu(page, drawing, "Colour", "Red");
    await expectStyle(line(drawing), "stroke", RED_LINE);
    await pickFromMenu(page, drawing, "Thickness", "12");
    await expectStyle(line(drawing), "strokeWidth", "12px");
    const after = await lineCentre(drawing);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
    // (A line's box on the screen includes its thickness, now 12, so the line itself is still 200 wide)
    const lineBox = await cardBox(line(drawing));
    expect(lineBox.width).toBeCloseTo(200 + 12, 0);

    // Verify the next line uses the picks
    const second = await drawLine(page, [
      [400, 500],
      [600, 560],
    ]);
    await expectStyle(line(second), "stroke", RED_LINE);
    await expectStyle(line(second), "strokeWidth", "12px");

    // Reload the board and verify the changes were saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expectStyle(line(drawing), "stroke", RED_LINE);
    await expectStyle(line(drawing), "strokeWidth", "12px");
  });

  test("Users can set the next line's colour and thickness from the Draw button", async ({
    page,
  }) => {
    const drawButton = page.locator("button.toolbar-draw-button");

    // Pick the next line's colour from the Draw button's menu, and type its thickness
    await pickFromMenu(page, drawButton, "Next line colour", "Blue");
    const box = await cardBox(drawButton);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    await page.getByRole("menuitem", { name: "Next line thickness", exact: true }).hover();
    const thicknessInput = page.getByRole("textbox", { name: "Line thickness" });
    await thicknessInput.fill("20");
    await thicknessInput.press("Enter");
    // Close the menu, and wait for it to finish closing (the page ignores the mouse until it has)
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    // Verify the right-click didn't turn on the Draw tool, then draw a line and verify it uses the picks
    await expect(drawButton).toHaveAttribute("aria-pressed", "false");
    const drawing = await drawLine(page, [
      [400, 300],
      [600, 420],
    ]);
    await expectStyle(line(drawing), "stroke", BLUE_LINE);
    await expectStyle(line(drawing), "strokeWidth", "20px");
  });
});
