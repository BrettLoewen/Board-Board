import { execSync, spawnSync, spawn } from "child_process";
import detect from "detect-port";
import { Locator, Page, expect } from "@playwright/test";

// Ensure the backend is setup before any tests are run
export async function startBackend() {
  await startSupabase();
  reseedDb();
}

// Ensure a fresh database exists for each test
export async function refreshBackend() {
  reseedDb();
}

// Ensure the database exists
async function startSupabase() {
  // Detect if supabase is running or not
  const port = await detect(54321);
  // If supabase is not running, start it
  if (port === 54321) {
    console.warn("Supabase not detected. Starting it now");
    execSync("supabase start");
  }

  // Check if the delete-user edge function is running
  const functionUrl = "http://127.0.0.1:54321/functions/v1/delete-user";
  const reachable = await isFunctionAvailable(functionUrl);

  // If it is not running, serve it
  if (!reachable) {
    console.log("Starting Supabase Edge function: delete-user");
    spawn("supabase", ["functions", "serve", "delete-user"], {
      stdio: "inherit",
      shell: true,
    });
  }

  return;
}

async function isFunctionAvailable(url: string) {
  try {
    // Try to hit the given url for an edge function.
    // If the fetch doesn't fail, then the function is running.
    await fetch(url, { method: "HEAD" });
    return true;
  } catch {
    // If the fetch fails, then the function is not running.
    return false;
  }
}

// Clear all the data so all tests are running in a known environment
function reseedDb() {
  spawnSync(
    "psql",
    ["-U", "postgres", "-h", "127.0.0.1", "-p", "54322", "-f", "supabase/clear_db_data.sql"],
    {
      stdio: "ignore",
      env: { ...process.env, PGPASSWORD: "postgres" },
    },
  );
}

export async function signUp(
  page: Page,
  userEmail: string,
  userPassword: string,
  userName: string,
) {
  // Open the sign up form
  const signUpButton = page.locator("button", { hasText: "Sign Up" }).first();
  await signUpButton.click();

  // Enter the test user's info
  const usernameInput = page.locator('input[name="username"]');
  await usernameInput.fill(userName);
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill(userEmail);
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(userPassword);

  // Submit the sign up form
  await page.keyboard.press("Enter");

  // Verify the dashboard page was reached and the user is logged in.
  await verifyDashboardReached(page, userName);
}

export async function login(page: Page, userEmail: string, userPassword: string) {
  // Open the login form
  const loginButton = page.locator("button", { hasText: "Login" }).first();
  await loginButton.click();

  // Enter the test user's info
  const emailInput = page.locator('input[name="email"]');
  await emailInput.fill(userEmail);
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(userPassword);

  // Submit the login form
  await page.keyboard.press("Enter");

  // Verify the dashboard page was reached and the user is logged in.
  await verifyDashboardReached(page, undefined);
}

export async function verifyDashboardReached(page: Page, username: string | undefined) {
  // Verify the dashboard page was reached.
  const welcomePageLink = page.locator("a", { hasText: "Board Board" });
  await expect(welcomePageLink).toHaveCount(1);

  // Open the user dropdown
  const userButton = page.locator("button.navbar-right-button");
  await expect(userButton).toHaveCount(1);
  await userButton.click();

  // If a username was passed, check to see that is displayed in the user dropdown
  if (username) {
    const usernameDisplay = page.getByText(username);
    await expect(usernameDisplay).toBeVisible();
    await expect(usernameDisplay).toHaveCount(1);
  }

  // Verify the logout button exists
  const logoutButton = page.locator("button", { hasText: "Logout" });
  await expect(logoutButton).toBeVisible();
  await expect(logoutButton).toHaveCount(1);

  // Close the user dropdown so further testing doesn't break
  await page.keyboard.press("Escape");
}

export async function signUpToSettingsPage(
  page: Page,
  userEmail: string,
  userPassword: string,
  userName: string,
) {
  // Sign up
  await signUp(page, userEmail, userPassword, userName);

  // Open the user dropdown, click the settings button, and verify the settings page was reached
  await navigateToSettingsPageFromDashboard(page);
}

export async function navigateToSettingsPageFromDashboard(page: Page) {
  // Open the user dropdown
  const userButton = page.locator("button.navbar-right-button");
  await expect(userButton).toHaveCount(1);
  await userButton.click();

  // Verify the settings button exists and click it
  const settingsButton = page.locator("a", { hasText: "Settings" });
  await expect(settingsButton).toBeVisible();
  await expect(settingsButton).toHaveCount(1);
  await settingsButton.click();

  // Verify that the settings page was reached
  const settingsPageHeader = page.locator("h1", { hasText: "Settings" });
  await expect(settingsPageHeader).toHaveCount(1);
}

export async function goToFriendsPage(page: Page) {
  // Open the user dropdown
  const userButton = page.locator("button.navbar-right-button");
  await expect(userButton).toHaveCount(1);
  await userButton.click();

  // Verify the friends button exists and click it
  const friendsButton = page.locator("a", { hasText: "Friends" });
  await expect(friendsButton).toBeVisible();
  await expect(friendsButton).toHaveCount(1);
  await friendsButton.click();

  // Verify that the friends page was reached
  const friendsPageHeader = page.locator("h1", { hasText: "Friends" });
  await expect(friendsPageHeader).toHaveCount(1);
}

export async function signUpToFriendsPage(
  page: Page,
  userEmail: string,
  userPassword: string,
  userName: string,
) {
  // Sign up
  await signUp(page, userEmail, userPassword, userName);

  // Go to the friends page
  await goToFriendsPage(page);
}

export async function sendFriendRequest(
  user1Page: Page,
  user1Name: string,
  user2Page: Page,
  user2Name: string,
) {
  // Verify that both users are actually on the friends page (sanity check)
  const user1FriendsPageHeader = user1Page.locator("h1", { hasText: "Friends" });
  await expect(user1FriendsPageHeader).toHaveCount(1);
  const user2FriendsPageHeader = user2Page.locator("h1", { hasText: "Friends" });
  await expect(user2FriendsPageHeader).toHaveCount(1);

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

  // Send a friend request from user2 to user1
  const friendRequestButton = user2Page.locator("button", { hasText: "Send Request" });
  await expect(friendRequestButton).toBeVisible();
  await expect(friendRequestButton).toHaveCount(1);
  await friendRequestButton.click();

  // Verify that user1 recieved a friend request from user2
  const friendRequestText = user1Page.locator("p.content-center", { hasText: user2Name });
  await expect(friendRequestText).toBeVisible();
  await expect(friendRequestText).toHaveCount(1);
  const friendRequestAcceptButton = user1Page.locator("button.friend-request-primary-button", {
    hasText: "Accept",
  });
  await expect(friendRequestAcceptButton).toBeVisible();
  await expect(friendRequestAcceptButton).toHaveCount(1);
  const friendRequestRejectButton = user1Page.locator("button.friend-request-error-button", {
    hasText: "Reject",
  });
  await expect(friendRequestRejectButton).toBeVisible();
  await expect(friendRequestRejectButton).toHaveCount(1);
}

// Assumes both users to start on the dashboard.
// Returns both users to the dashboard after they become friends.
export async function sendAndAcceptFriendRequest(
  user1Page: Page,
  user1Name: string,
  user2Page: Page,
  user2Name: string,
) {
  // Send both users to the friends page
  await goToFriendsPage(user1Page);
  await goToFriendsPage(user2Page);

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

  // Return both users to the dashboard
  const user1BackButton = user1Page.locator("button.back-button");
  await expect(user1BackButton).toBeVisible();
  await expect(user1BackButton).toHaveCount(1);
  await user1BackButton.click();
  const user2BackButton = user2Page.locator("button.back-button");
  await expect(user2BackButton).toBeVisible();
  await expect(user2BackButton).toHaveCount(1);
  await user2BackButton.click();
}

export async function createBoard(page: Page, boardName: string) {
  // Open the Create Board modal
  const newBoardButton = page.locator("button", { hasText: "New Board" });
  await expect(newBoardButton).toBeVisible();
  await expect(newBoardButton).toHaveCount(1);
  await newBoardButton.click();

  // Verify the Create Board modal was opened
  const createBoardModalHeader = page.locator("h2", { hasText: "Create a New Board" });
  await expect(createBoardModalHeader).toHaveCount(1);

  // Fill in the board's name
  const boardNameInput = page.locator('input[placeholder="Board name"]');
  await boardNameInput.fill(boardName);

  // Create the Board
  const createBoardButton = page.locator("button", { hasText: "Create Board" });
  await expect(createBoardButton).toBeVisible();
  await expect(createBoardButton).toHaveCount(1);
  await createBoardButton.click();

  // Verify the modal window was closed
  await expect(createBoardButton).not.toBeVisible();

  // Verify the new board was created and appears in the list of boards
  const boardRowButton = page.locator("tr", { hasText: boardName });
  await expect(boardRowButton).toBeVisible();
  await expect(boardRowButton).toHaveCount(1);
}

export async function verifyBoardPageReached(page: Page, boardName: string) {
  // Verify the url is for a board page (/board/<board id>)
  await expect(page).toHaveURL(
    /\/board\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  );

  // Verify the board's name is displayed in the board page's navbar
  const boardTitle = page.locator("h1.navbar-board-title");
  await expect(boardTitle).toBeVisible();
  await expect(boardTitle).toHaveCount(1);
  await expect(boardTitle).toHaveText(boardName);
}

export async function openBoard(page: Page, boardName: string) {
  // Open the board from the dashboard (the whole row is a button)
  const boardRowButton = page.locator("td", { hasText: boardName });
  await expect(boardRowButton).toBeVisible();
  await expect(boardRowButton).toHaveCount(1);
  await boardRowButton.click();

  // Verify the board page was reached and is showing the board's name
  await verifyBoardPageReached(page, boardName);

  // Verify the board itself is showing (the board viewport and its zoom control)
  await expect(page.locator(".board-viewport")).toBeVisible();
  await expect(page.locator(".zoom-percent")).toBeVisible();

  // Wait 1 second to guarantee the cards are loaded and the board's realtime channel is connected
  await page.waitForTimeout(1000);
}

export async function createNote(page: Page): Promise<Locator> {
  // Create a note with the toolbar's Note button
  const cards = page.locator(".board-card");
  const cardCount = await cards.count();
  const noteButton = page.locator("button.toolbar-note-button");
  await expect(noteButton).toBeVisible();
  await expect(noteButton).toHaveCount(1);
  await noteButton.click();

  // Verify one more card exists, and that the new card is a note (new cards are selected straight away)
  await expect(cards).toHaveCount(cardCount + 1);
  const newCard = page.locator(".board-card-selected");
  await expect(newCard).toHaveCount(1);
  await expect(newCard.locator(".note-card")).toHaveCount(1);

  // Return a locator that keeps finding this card by its id, even after it is deselected
  const cardId = await newCard.getAttribute("data-card-id");
  return page.locator(`.board-card[data-card-id="${cardId}"]`);
}

export async function createShape(page: Page): Promise<Locator> {
  // Create a shape with the toolbar's Shape button
  const cards = page.locator(".board-card");
  const cardCount = await cards.count();
  const shapeButton = page.locator("button.toolbar-shape-button");
  await expect(shapeButton).toBeVisible();
  await expect(shapeButton).toHaveCount(1);
  await shapeButton.click();

  // Verify one more card exists, and that the new card is a shape (new cards are selected straight away)
  await expect(cards).toHaveCount(cardCount + 1);
  const newCard = page.locator(".board-card-selected");
  await expect(newCard).toHaveCount(1);
  await expect(newCard.locator(".shape-card")).toHaveCount(1);

  // Return a locator that keeps finding this card by its id, even after it is deselected
  const cardId = await newCard.getAttribute("data-card-id");
  return page.locator(`.board-card[data-card-id="${cardId}"]`);
}

export async function setDrawTool(page: Page, on: boolean) {
  // Turn the Draw tool on or off with the toolbar's Draw button, if it isn't already
  const drawButton = page.locator("button.toolbar-draw-button");
  await expect(drawButton).toBeVisible();
  if ((await drawButton.getAttribute("aria-pressed")) !== String(on)) await drawButton.click();
  await expect(drawButton).toHaveAttribute("aria-pressed", String(on));
}

export async function drawLine(page: Page, points: [number, number][]): Promise<Locator> {
  // Draw a line through the given screen points with the Draw tool (turning it on if needed)
  await setDrawTool(page, true);
  const cards = page.locator(".board-card");
  const cardCount = await cards.count();
  const [first, ...rest] = points;
  await page.mouse.move(first![0], first![1]);
  await page.mouse.down();
  for (const [x, y] of rest) await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();

  // Verify the line became a new draw card (the newest card is the last one on the board)
  await expect(cards).toHaveCount(cardCount + 1);
  const newCard = cards.last();
  await expect(newCard.locator(".draw-card")).toHaveCount(1);

  // Return a locator that keeps finding this card by its id
  const cardId = await newCard.getAttribute("data-card-id");
  return page.locator(`.board-card[data-card-id="${cardId}"]`);
}

export async function cardBox(card: Locator) {
  // Get a card's position and size on the screen (in screen pixels)
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

export async function cardWorldPosition(card: Locator) {
  // Get a card's position on the board (in world units, which don't depend on the camera),
  // read from the transform that positions it in the board's world layer
  const transform = await card.evaluate((element) => (element as HTMLElement).style.transform);
  const match = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
  expect(match).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]) };
}

export async function dragCard(page: Page, card: Locator, dx: number, dy: number) {
  // Drag a card from its middle (away from its resize edges) by the given distance in screen pixels
  const box = await cardBox(card);
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
  await page.mouse.up();
}

export async function shareBoardWith(page: Page, friendName: string) {
  // Open the share modal (from the dashboard, with a single board)
  const shareModalButton = page.locator("button", { hasText: "Share" });
  await expect(shareModalButton).toBeVisible();
  await expect(shareModalButton).toHaveCount(1);
  await shareModalButton.click();

  // Verify the friend appears in the modal
  const friendElement = page.locator("div.friend-div", { hasText: friendName });
  await expect(friendElement).toBeVisible();
  await expect(friendElement).toHaveCount(1);

  // Share the board to the friend (the first Share button is the dashboard's, behind the modal)
  const shareButtons = page.locator("button", { hasText: /^Share$/ });
  await expect(shareButtons).toHaveCount(2);
  await shareButtons.last().click();

  // Verify the friend is now shown as receiving the board
  const unshareButton = page.locator("button", { hasText: /^Unshare$/ });
  await expect(unshareButton).toBeVisible();
  await expect(unshareButton).toHaveCount(1);

  // Close the share modal and wait for it to be gone
  await page.keyboard.press("Escape");
  await expect(page.locator("h2", { hasText: "Share Board" })).not.toBeVisible();
}

// The CSS properties the card tests read
type StyleProperty =
  | "backgroundColor"
  | "color"
  | "fontSize"
  | "fill"
  | "boxShadow"
  | "stroke"
  | "strokeWidth";

// Read a CSS property of an element as the browser computed it
export async function computedStyle(element: Locator, property: StyleProperty) {
  return element.evaluate((el, prop) => getComputedStyle(el)[prop], property);
}

// Verify a CSS property of an element, waiting for it to settle (buttons fade between colours)
export async function expectStyle(element: Locator, property: StyleProperty, expected: string) {
  await expect.poll(() => computedStyle(element, property)).toBe(expected);
}

// Open a menu from a right-click on an element, then open one of its submenus
export async function openSubmenu(page: Page, target: Locator, submenu: string) {
  const box = await target.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2, { button: "right" });
  const submenuItem = page.getByRole("menuitem", { name: submenu, exact: true });
  await expect(submenuItem).toBeVisible();
  await submenuItem.hover();
}

// Pick an option from a submenu of an element's right-click menu
export async function pickFromMenu(page: Page, target: Locator, submenu: string, option: string) {
  await openSubmenu(page, target, submenu);
  const optionItem = page.getByRole("menuitemcheckbox", { name: option, exact: true });
  await expect(optionItem).toBeVisible();
  await optionItem.click();
  await expect(optionItem).not.toBeVisible();
}
