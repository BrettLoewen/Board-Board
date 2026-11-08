export const AUTH = {
  // The modes that the auth form can switch between
  MODES: {
    LOGIN: "login",
    SIGN_UP: "sign-up",
  },
  // The states that an authentication attempt can evaluate to
  VALIDATION: {
    VALID: "valid",
    INVALID: "invalid",
    WEAK_PASSWORD: "weak_password",
    MISSING_FIELD: "missing_field",
    INVALID_USERNAME: "invalid_username",
  },
  // The error codes returned from supabase auth errors
  ERRORS: {
    INVALID: "AuthApiError: Invalid login credentials", // The user tried to log in with an email and password combination that does not match an account.
    ALREADY_REGISTERED: "AuthApiError: User already registered", // The user tried to sign up with an email that already is linked to an account.
    WEAK_PASSWORD: "AuthWeakPasswordError", // The password the user provided is too short.
    DATABASE_ERROR: "AuthApiError: Database error saving new user", // Triggered if the database insert failed, likely because the username provided didn't pass the constraint.
    EMAIL_NOT_CONFIRMED: "AuthApiError: Email not confirmed", // User tried to log in before confirming their email.
  },
  // The messages used to communicate the auth attempt's failure state to the user
  MESSAGES: {
    INVALID: "Invalid credentials!",
    WEAK_PASSWORD: "Weak password!",
    MISSING_FIELD: "Missing field!",
    INVALID_USERNAME: "Username is too short!",
  },
};

export const ROUTES = {
  NOT_FOUND: "/:catchAll(.*)",
  NOT_FOUND_STRING: "/404",
  ROOT: "/",
  EMAIL: "/email",
  DASHBOARD: "/dashboard",
  FRIENDS: "/dashboard/friends",
  SETTINGS: "/dashboard/settings",
  BOARD_GENERIC: "/board/:id",
  BOARD: (boardId: string) => {
    return `/board/${boardId}`;
  },
};

const friendRequestErrorMessageMap = new Map();
friendRequestErrorMessageMap.set(
  "You can only send a friend request from yourself",
  "Invalid Friend Code!",
);
friendRequestErrorMessageMap.set(
  "You can only send a friend request to a valid friend code",
  "Invalid Friend Code!",
);
friendRequestErrorMessageMap.set(
  "You cannot send a friend request to yourself",
  "You cannot send a friend request to yourself!",
);
friendRequestErrorMessageMap.set(
  "You cannot send a friend request to a user that you are already friends with",
  "You are already friends with that user!",
);

export const REALTIME = {
  TOPICS: {
    USER: "user:",
    // Each board's private channel is "board:<board id>"
    BOARD: "board:",
  },
  EVENTS: {
    FRIEND_REQUEST: "friend_request",
    FRIEND_ACCEPTED: "friend_accepted",
    // Sent between clients on a board's channel, before changes are written
    CARD_GEOMETRY: "card:geometry",
    CARD_CONTENT: "card:content",
    CARD_CREATE: "card:create",
    CARD_DELETE: "card:delete",
    // A line being drawn, shown to everyone else as it is drawn (a "ghost" line), until its card arrives
    STROKE_PREVIEW: "stroke:preview",
    STROKE_END: "stroke:end",
    STROKE_CANCEL: "stroke:cancel",
    // Where someone's pointer is on the board (or that it left the board)
    CURSOR: "cursor",
    // Sent by database triggers on a board's channel (see the board_realtime migration)
    DB_INSERT: "INSERT",
    DB_UPDATE: "UPDATE",
    DB_DELETE: "DELETE",
    BOARD_DELETED: "BOARD_DELETED",
    ACCESS_REVOKED: "ACCESS_REVOKED",
  },
  // How often (ms) a card's changes are broadcast while it is being moved, resized or typed in.
  // A final broadcast is always sent when the card is released. Kept in one place so they can be tuned:
  // the free tier allows roughly 100 messages per second per project, and going over disconnects clients.
  RATES: {
    GEOMETRY: 50,
    CONTENT: 100,
    // New points of a line being drawn
    STROKE: 50,
    // The pointer's position. Not sent while dragging a card or drawing: others work the pointer out from the
    // card's movement or the line instead, which saves messages.
    CURSOR: 100,
  },
  // Someone's cursor is hidden this long (ms) after their last update
  CURSOR_TIMEOUT: 5000,
  // A ghost line is removed this long (ms) after its last points arrive, in case the person drawing it left
  // without finishing it (lines whose card arrives are removed straight away)
  GHOST_STROKE_TIMEOUT: 10000,
  // After a ghost line is finished, how long (ms) to keep showing it while its card is on the way
  GHOST_STROKE_END_DELAY: 1500,
  // Two clients can grab the same card before either sees the other's presence. Holds that arrive within
  // this long (ms) of each other are settled by the earliest grab. A hold arriving later never displaces
  // a hold everyone has already seen.
  CONTEST_WINDOW: 1500,
  // How long (ms) without typing before a note's lock is released (the note stays focused, and the lock is
  // taken again on the next keystroke if nobody else has taken it)
  EDIT_IDLE_RELEASE: 10000,
};

export const BOARD = {
  // Card positions and sizes are clamped to this on the client.
  // Matches the `sane_geometry` check on the cards table so local and database state can't differ.
  MAX_COORDINATE: 99999,
  // If a card's top-left corner is within this distance of where a new card would go,
  // the new card is offset diagonally by this amount so repeated clicks don't stack cards exactly
  CREATE_OFFSET: 20,
  // How often (ms) a card's geometry is written to the database while it is being dragged or resized.
  // A final write is always made when the interaction ends.
  GEOMETRY_WRITE_INTERVAL: 500,
  // The size of the board before any cards are added (in world units). Centred on the origin.
  // The board never shrinks below this (or below the viewport's size at 100% zoom).
  START_SIZE: { w: 3200, h: 2000 },
  // The space kept around the cards at the board's edge (in world units)
  MARGIN: 300,
  // The zoom limits. The actual minimum zoom is higher whenever the whole board fits at a closer zoom.
  MIN_SCALE: 0.1,
  MAX_SCALE: 4,
  // How fast the mouse wheel zooms (per pixel scrolled). Pinch gestures send much smaller deltas, so they use a larger value.
  WHEEL_ZOOM_SPEED: 0.0015,
  PINCH_ZOOM_SPEED: 0.01,
  // Dragging a card within this distance (px) of the viewport's edge pans the board in that direction,
  // speeding up towards the edge to this many screen pixels per second
  EDGE_PAN_ZONE: 50,
  EDGE_PAN_SPEED: 800,
  // How long (ms) a card can be pressed without moving and still count as a click (which starts editing a note).
  // Pressing for longer "picks up" the card instead. Moving the pointer starts a drag straight away.
  CLICK_HOLD_TIME: 300,
  // How far (px) the pointer must move after pressing a card before it starts dragging (the Windows drag threshold)
  DRAG_THRESHOLD: 4,
  // The band around a card's edge where a press resizes it rather than moving it: this far (screen px) inside
  // the edge, and this far outside it. Reaching outside makes the edge easy to hit without taking much of the
  // card's own area away from moving it.
  RESIZE_MARGIN: 5,
  RESIZE_REACH: 8,
  // How long (ms) after the last keystroke a note's text is written to the database.
  // It is also written straight away when editing stops.
  CONTENT_WRITE_DELAY: 600,
  // The dot grid: the screen spacing (px) of the dots at the start of each zoom level, their radius (px),
  // and how much the dots grow halfway between levels (0.4 = 40% bigger)
  DOT_SPACING: 32,
  DOT_RADIUS: 1.5,
  DOT_GROWTH: 0.4,
};

export const DRAW = {
  // Space (world units) around a drawn line inside its card, on top of half the line's thickness.
  // It gives thin lines enough card to grab and to resize from.
  PADDING: 8,
  // How far (world units) past each side of a line a click still counts as clicking the line.
  // Kept below PADDING so the clickable area stays inside the card.
  HIT_MARGIN: 6,
  // How far (screen px) a point can stray from a straight line before simplifying keeps it.
  // Converted to world units with the zoom at the time the line is finished.
  SIMPLIFY_TOLERANCE: 0.5,
  // The most points a line keeps (more are simplified away), so its card stays well inside the size limits
  // of the database's `content_size` check and of realtime messages
  MAX_POINTS: 2000,
  // Points are stored as fractions of the card's drawing area, rounded to this many decimal places
  POINT_PRECISION: 4,
};

export const FRIEND_REQUEST_ERRORS = {
  MAP: friendRequestErrorMessageMap,
  DEFAULT: "Invalid Friend Code!",
};
