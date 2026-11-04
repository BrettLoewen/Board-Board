import { test, expect, type Page } from "@playwright/test";
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
} from "./utils";

// For every test...
// Ensure a fresh database exists
// And ensure the test starts on the app's welcome page
test.beforeAll(startBackend);
test.beforeEach(refreshBackend);
test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:5173/Board-Board/");
});

// The board's starting size is 3200 x 2000 world units, centred on the origin (BOARD.START_SIZE).
// With Playwright's default 1280 x 720 window the board viewport is 1280 x 656 pixels, so:
// - at 100% zoom the view can pan (3200 - 1280) / 2 = 960 pixels left or right of the origin
// - the furthest zoom out (the whole board fits) is 656 / 2000 = 33%
const MAX_PAN_AT_100 = 960;
const MIN_ZOOM = "33%";

// Get the board viewport's position and size on the screen
async function viewportBox(page: Page) {
  const box = await page.locator(".board-viewport").boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

// Read the zoom percentage shown in the zoom control
async function zoomPercent(page: Page) {
  return page.locator(".zoom-percent").innerText();
}

// Type a zoom value into the zoom control and press Enter
async function typeZoom(page: Page, value: string) {
  const zoomButton = page.locator("button.zoom-percent");
  await expect(zoomButton).toBeVisible();
  await zoomButton.click();
  const zoomInput = page.locator("input.zoom-input");
  await expect(zoomInput).toBeFocused();
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

test.describe("Board Camera", () => {
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

  test("Empty boards open at 100% and new notes appear in the centre of the view", async ({
    page,
  }) => {
    // Verify an empty board opens at 100% zoom
    expect(await zoomPercent(page)).toBe("100%");

    // Create a note and verify it is centred in the board viewport
    const viewport = await viewportBox(page);
    const note = await createNote(page);
    const box = await cardBox(note);
    expect(box.x + box.width / 2).toBeCloseTo(viewport.x + viewport.width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(viewport.y + viewport.height / 2, 0);

    // Create a second note and verify it is offset diagonally rather than stacked exactly on the first
    const secondNote = await createNote(page);
    const secondBox = await cardBox(secondNote);
    expect(secondBox.x - box.x).toBeCloseTo(20, 0);
    expect(secondBox.y - box.y).toBeCloseTo(20, 0);
  });

  test("Users can pan the board by dragging empty space", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardBox(note);
    const worldBefore = await cardWorldPosition(note);

    // Drag an empty part of the board
    const viewport = await viewportBox(page);
    await page.mouse.move(viewport.x + 300, viewport.y + 100);
    await page.mouse.down();
    await page.mouse.move(viewport.x + 400, viewport.y + 150, { steps: 5 });
    await page.mouse.up();

    // Verify the note moved on screen with the board, but didn't move on the board
    const after = await cardBox(note);
    expect(after.x - before.x).toBeCloseTo(100, 0);
    expect(after.y - before.y).toBeCloseTo(50, 0);
    expect(await cardWorldPosition(note)).toEqual(worldBefore);
  });

  test("Users can pan the board by middle-dragging, even over a card", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardBox(note);
    const worldBefore = await cardWorldPosition(note);

    // Middle-drag starting on top of the note
    await page.mouse.move(before.x + 100, before.y + 100);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(before.x + 50, before.y + 80, { steps: 5 });
    await page.mouse.up({ button: "middle" });

    // Verify the board panned (the note moved on screen) but the note itself wasn't dragged
    const after = await cardBox(note);
    expect(after.x - before.x).toBeCloseTo(-50, 0);
    expect(after.y - before.y).toBeCloseTo(-20, 0);
    expect(await cardWorldPosition(note)).toEqual(worldBefore);
  });

  test("Panning stops at the edge of the board", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardBox(note);

    // Drag the board far to the right, twice (2050 pixels in total)
    const viewport = await viewportBox(page);
    for (let i = 0; i < 2; i++) {
      await page.mouse.move(viewport.x + 200, viewport.y + 300);
      await page.mouse.down();
      await page.mouse.move(viewport.x + 1225, viewport.y + 300, { steps: 10 });
      await page.mouse.up();
    }

    // Verify the board only panned as far as its left edge
    const after = await cardBox(note);
    expect(after.x - before.x).toBeCloseTo(MAX_PAN_AT_100, 0);
  });

  test("Scrolling zooms in and out around the cursor", async ({ page }) => {
    const note = await createNote(page);
    const before = await cardBox(note);

    // Scroll up with the cursor over the note's top-left corner
    await page.mouse.move(before.x, before.y);
    await page.mouse.wheel(0, -300);

    // Verify the board zoomed in, and the point under the cursor stayed in place
    await expect.poll(() => zoomPercent(page)).not.toBe("100%");
    const zoomedIn = await cardBox(note);
    expect(zoomedIn.x).toBeCloseTo(before.x, 0);
    expect(zoomedIn.y).toBeCloseTo(before.y, 0);
    expect(zoomedIn.width).toBeGreaterThan(before.width);

    // Scroll down a lot and verify the board stops zooming out once the whole board fits
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 1000);
    await expect.poll(() => zoomPercent(page)).toBe(MIN_ZOOM);
  });

  test("Users can type a zoom level", async ({ page }) => {
    // Type a zoom level
    await typeZoom(page, "250");
    expect(await zoomPercent(page)).toBe("250%");

    // Verify Escape cancels typing a zoom level
    await page.locator("button.zoom-percent").click();
    await page.keyboard.type("120");
    await page.keyboard.press("Escape");
    expect(await zoomPercent(page)).toBe("250%");

    // Verify zoom levels outside the allowed range are clamped (a "%" is accepted too)
    await typeZoom(page, "5%");
    expect(await zoomPercent(page)).toBe(MIN_ZOOM);
    await typeZoom(page, "1000");
    expect(await zoomPercent(page)).toBe("400%");

    // Verify text that isn't a number is ignored
    await typeZoom(page, "abc");
    expect(await zoomPercent(page)).toBe("400%");
  });

  test("The zoom slider and Fit button change the zoom", async ({ page }) => {
    const note = await createNote(page);

    // Click the right end of the zoom slider and verify it zooms all the way in
    const slider = page.locator(".zoom-slider");
    await expect(slider).toBeVisible();
    const sliderBox = await slider.boundingBox();
    await page.mouse.click(
      sliderBox!.x + sliderBox!.width - 1,
      sliderBox!.y + sliderBox!.height / 2,
    );
    expect(await zoomPercent(page)).toBe("400%");

    // Click the Fit button and verify the note is back in the centre of the view, below 100% zoom
    const fitButton = page.locator("button.zoom-fit-button");
    await expect(fitButton).toBeVisible();
    await fitButton.click();
    const viewport = await viewportBox(page);
    const box = await cardBox(note);
    expect(box.x + box.width / 2).toBeCloseTo(viewport.x + viewport.width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(viewport.y + viewport.height / 2, 0);
    expect(parseInt(await zoomPercent(page))).toBeLessThanOrEqual(100);
  });

  test("Cards follow the pointer when dragged and resized while zoomed in", async ({ page }) => {
    const note = await createNote(page);
    await typeZoom(page, "200");
    const before = await cardBox(note);
    const worldBefore = await cardWorldPosition(note);

    // Drag the note and verify it moved exactly with the pointer on screen (half as far on the board at 200%)
    await dragCard(page, note, 100, 60);
    const dragged = await cardBox(note);
    expect(dragged.x - before.x).toBeCloseTo(100, 0);
    expect(dragged.y - before.y).toBeCloseTo(60, 0);
    const worldAfter = await cardWorldPosition(note);
    expect(worldAfter.x - worldBefore.x).toBeCloseTo(50, 0);
    expect(worldAfter.y - worldBefore.y).toBeCloseTo(30, 0);

    // Resize the note from its right edge and verify it grew exactly with the pointer
    await page.mouse.move(dragged.x + dragged.width - 2, dragged.y + dragged.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragged.x + dragged.width + 98, dragged.y + dragged.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
    const resized = await cardBox(note);
    expect(resized.width - dragged.width).toBeCloseTo(100, 0);
  });

  test("Dragging a card to the edge of the view pans and grows the board", async ({ page }) => {
    const note = await createNote(page);
    const box = await cardBox(note);
    const viewport = await viewportBox(page);
    const worldBefore = await cardWorldPosition(note);

    // Drag the note to the right edge of the view and hold it there
    const grabX = box.x + 50;
    const grabY = box.y + 50;
    const edgeX = viewport.x + viewport.width - 10;
    await page.mouse.move(grabX, grabY);
    await page.mouse.down();
    await page.mouse.move(edgeX, grabY, { steps: 15 });
    await page.waitForTimeout(1000);

    // Verify the board panned and carried the note further right than the drag alone could,
    // with the note still under the pointer
    const held = await cardBox(note);
    expect(edgeX - held.x).toBeCloseTo(50, 0);
    const worldHeld = await cardWorldPosition(note);
    expect(worldHeld.x - worldBefore.x).toBeGreaterThan(edgeX - grabX + 200);

    // Verify the panning stops when the note is let go
    await page.mouse.up();
    const released = await cardWorldPosition(note);
    await page.waitForTimeout(300);
    expect(await cardWorldPosition(note)).toEqual(released);
  });

  test("Boards open with every card in view", async ({ page }) => {
    const note = await createNote(page);
    const viewport = await viewportBox(page);

    // Drag the note to the right edge and hold it there, so it ends up far outside the starting view
    const box = await cardBox(note);
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(viewport.x + viewport.width - 10, box.y + 50, { steps: 15 });
    await page.waitForTimeout(1500);
    await page.mouse.up();

    // Pan back to where the board started, and verify the note is out of view
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(viewport.x + 200, viewport.y + 300);
      await page.mouse.down();
      await page.mouse.move(viewport.x + 1200, viewport.y + 300, { steps: 10 });
      await page.mouse.up();
    }
    expect((await cardBox(note)).x).toBeGreaterThan(viewport.x + viewport.width);

    // Wait for the note's position to be written, then reload the board
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify the board opened with the note inside the view
    const reloaded = await cardBox(page.locator(".board-card").first());
    expect(reloaded.x).toBeGreaterThanOrEqual(viewport.x);
    expect(reloaded.x + reloaded.width).toBeLessThanOrEqual(viewport.x + viewport.width);
    expect(reloaded.y).toBeGreaterThanOrEqual(viewport.y);
    expect(reloaded.y + reloaded.height).toBeLessThanOrEqual(viewport.y + viewport.height);
  });

  test("Resizing the window keeps the view centred", async ({ page }) => {
    // Make the window bigger after the board has opened
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);

    // Create a note (in the centre of the resized view) and zoom all the way out
    const note = await createNote(page);
    const viewport = await viewportBox(page);
    await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2);
    for (let i = 0; i < 15; i++) await page.mouse.wheel(0, 100);
    await page.waitForTimeout(100);

    // Verify the note is still in the centre of the view (it would drift if the resize kept the top-left corner fixed)
    const box = await cardBox(note);
    expect(box.x + box.width / 2).toBeCloseTo(viewport.x + viewport.width / 2, 0);
    expect(box.y + box.height / 2).toBeCloseTo(viewport.y + viewport.height / 2, 0);
  });

  test("The board shows a dot grid", async ({ page }) => {
    // Verify the dot grid's canvas exists and has dots drawn on it
    const dots = page.locator("canvas.board-dots");
    await expect(dots).toHaveCount(1);
    const drawnPixels = await dots.evaluate((canvas) => {
      const element = canvas as HTMLCanvasElement;
      const pixels = element
        .getContext("2d")!
        .getImageData(0, 0, element.width, element.height).data;
      let count = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) count++;
      return count;
    });
    expect(drawnPixels).toBeGreaterThan(0);
  });
});
