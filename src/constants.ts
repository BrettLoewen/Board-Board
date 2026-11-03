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
  },
  EVENTS: {
    FRIEND_REQUEST: "friend_request",
    FRIEND_ACCEPTED: "friend_accepted",
  },
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
  // How close (px) to a card's edge a press must be to resize it rather than move it
  RESIZE_MARGIN: 6,
  // How long (ms) after the last keystroke a note's text is written to the database.
  // It is also written straight away when editing stops.
  CONTENT_WRITE_DELAY: 600,
  // The dot grid: the screen spacing (px) of the dots at the start of each zoom level, their radius (px),
  // and how much the dots grow halfway between levels (0.4 = 40% bigger)
  DOT_SPACING: 32,
  DOT_RADIUS: 1.5,
  DOT_GROWTH: 0.4,
};

export const FRIEND_REQUEST_ERRORS = {
  MAP: friendRequestErrorMessageMap,
  DEFAULT: "Invalid Friend Code!",
};
