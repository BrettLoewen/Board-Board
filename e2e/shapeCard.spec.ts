import { test, expect, type Locator } from "@playwright/test";
import {
  startBackend,
  refreshBackend,
  signUp,
  createBoard,
  openBoard,
  createNote,
  createShape,
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

// The shape colours used by these tests, as the browser reports them (light mode, see the card palette in main.css)
const GREEN = "rgb(187, 247, 208)"; // The default colour of notes and shapes
const RED = "rgb(254, 202, 202)";

// Verify which shape a card is drawing, and that it is drawing it with the right SVG element
async function expectShape(card: Locator, shape: string, element: string) {
  const svg = card.locator(".shape-card");
  await expect(svg).toHaveAttribute("data-shape", shape);
  await expect(svg.locator(element)).toHaveCount(1);
}

test.describe("Shape Cards", () => {
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

  test("Users can create shapes, which start as green squares", async ({ page }) => {
    // Verify the Shape button shows the colour new shapes will have
    const shapeButton = page.locator("button.toolbar-shape-button");
    await expectStyle(shapeButton, "backgroundColor", GREEN);

    // Create a shape and verify it is a green square
    const shape = await createShape(page);
    await expectShape(shape, "square", "rect");
    await expectStyle(shape.locator(".shape-card"), "fill", GREEN);

    // Verify the card doesn't draw a rectangular shadow, which would show around circles and triangles
    await expectStyle(shape, "boxShadow", "none");

    // Verify the props meant for other card bodies didn't end up on the SVG
    await expect(shape.locator(".shape-card")).not.toHaveAttribute("editable");

    // Reload the board and verify the shape was saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expectShape(shape, "square", "rect");
  });

  test("Users can move and resize shapes, and the changes are saved", async ({ page }) => {
    const shape = await createShape(page);
    const before = await cardBox(shape);

    // Drag the shape and verify it moved with the pointer
    await dragCard(page, shape, 150, 100);
    const moved = await cardBox(shape);
    expect(moved.x - before.x).toBeCloseTo(150, 0);
    expect(moved.y - before.y).toBeCloseTo(100, 0);

    // Resize the shape from its bottom-right corner and verify it grew with the pointer
    await page.mouse.move(moved.x + moved.width - 2, moved.y + moved.height - 2);
    await page.mouse.down();
    await page.mouse.move(moved.x + moved.width + 78, moved.y + moved.height + 58, { steps: 10 });
    await page.mouse.up();
    const resized = await cardBox(shape);
    expect(resized.width - moved.width).toBeCloseTo(80, 0);
    expect(resized.height - moved.height).toBeCloseTo(60, 0);

    // Verify the drawing stretched to fill the resized card
    const drawn = await cardBox(shape.locator("rect"));
    expect(drawn.width).toBeCloseTo(resized.width, 0);
    expect(drawn.height).toBeCloseTo(resized.height, 0);

    // Resize the shape from its left edge past its right edge, and verify it stops at its minimum width (40)
    await page.mouse.move(resized.x + 2, resized.y + resized.height / 2);
    await page.mouse.down();
    await page.mouse.move(resized.x + 600, resized.y + resized.height / 2, { steps: 15 });
    await page.mouse.up();
    const minimum = await cardBox(shape);
    expect(minimum.width).toBeCloseTo(40, 0);

    // Reload the board and verify the shape kept its position and size
    const world = await cardWorldPosition(shape);
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(shape).toHaveCount(1);
    expect(await cardWorldPosition(shape)).toEqual(world);
    const reloadedWidth = await shape.evaluate((el) => (el as HTMLElement).style.width);
    expect(parseFloat(reloadedWidth)).toBeCloseTo(40, 0);
  });

  test("Clicking a shape selects it without starting to edit it", async ({ page }) => {
    const shape = await createShape(page);

    // Deselect the shape, then click it and verify it is selected but not being edited
    await page.keyboard.press("Escape");
    await expect(shape).not.toHaveClass(/board-card-selected/);
    const box = await cardBox(shape);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(shape).toHaveClass(/board-card-selected/);
    await expect(shape).not.toHaveClass(/board-card-editing/);
  });

  test("Users can delete shapes with the Delete key or the menu", async ({ page }) => {
    // Delete a shape with the Delete key
    await createShape(page);
    await page.keyboard.press("Delete");
    await expect(page.locator(".board-card")).toHaveCount(0);

    // Delete a shape from its right-click menu
    const shape = await createShape(page);
    const box = await cardBox(shape);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.locator(".board-card")).toHaveCount(0);

    // Reload the board and verify the shapes are still gone
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator(".board-viewport")).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(page.locator(".board-card")).toHaveCount(0);
  });

  test("Users can switch a shape between a square, triangle and circle", async ({ page }) => {
    const shape = await createShape(page);

    await pickFromMenu(page, shape, "Shape", "Triangle");
    await expectShape(shape, "triangle", "polygon");

    await pickFromMenu(page, shape, "Shape", "Circle");
    await expectShape(shape, "circle", "ellipse");

    // Reload the board and verify the shape was saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expectShape(shape, "circle", "ellipse");

    await pickFromMenu(page, shape, "Shape", "Square");
    await expectShape(shape, "square", "rect");
  });

  test("Users can change a shape's colour, and new shapes use the last picks", async ({ page }) => {
    const shape = await createShape(page);
    const shapeButton = page.locator("button.toolbar-shape-button");

    // Pick a colour and a shape, and verify the shape changed
    await pickFromMenu(page, shape, "Colour", "Red");
    await pickFromMenu(page, shape, "Shape", "Circle");
    await expectStyle(shape.locator(".shape-card"), "fill", RED);

    // Verify the Shape button and the next shape use the picks
    await expectStyle(shapeButton, "backgroundColor", RED);
    const secondShape = await createShape(page);
    await expectShape(secondShape, "circle", "ellipse");
    await expectStyle(secondShape.locator(".shape-card"), "fill", RED);

    // Verify notes kept their own default colour
    const note = await createNote(page);
    await expectStyle(note.locator(".note-card"), "backgroundColor", GREEN);

    // Reload the board and verify the colour and the Shape button's colour were saved
    await page.waitForTimeout(1000);
    await page.reload();
    await expectStyle(shape.locator(".shape-card"), "fill", RED);
    await expectStyle(shapeButton, "backgroundColor", RED);
  });

  test("Users can pick a custom shape colour by hex code", async ({ page }) => {
    const shape = await createShape(page);

    // Open the custom colour picker from the shape's Colour menu
    await openSubmenu(page, shape, "Colour");
    await page.getByRole("menuitemcheckbox", { name: "Custom…" }).click();
    const hexInput = page.locator(".custom-color-hex-input input");
    await expect(hexInput).toBeVisible();

    // Type a hex code, apply it and verify the shape uses it
    await hexInput.fill("#ff8800");
    await page.locator("button.custom-color-apply-button").click();
    await expectStyle(shape.locator(".shape-card"), "fill", "rgb(255, 136, 0)");
  });

  test("Users can set the next shape and its colour from the Shape button", async ({ page }) => {
    const shapeButton = page.locator("button.toolbar-shape-button");

    // Pick the next shape and colour by right-clicking the Shape button
    await pickFromMenu(page, shapeButton, "Next shape", "Triangle");
    await pickFromMenu(page, shapeButton, "Next shape colour", "Red");
    await expectStyle(shapeButton, "backgroundColor", RED);

    // Verify the next shape uses them
    const shape = await createShape(page);
    await expectShape(shape, "triangle", "polygon");
    await expectStyle(shape.locator(".shape-card"), "fill", RED);
  });
});
