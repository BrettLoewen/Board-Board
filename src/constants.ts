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
  ROOT: "/",
  DASHBOARD: "/dashboard/",
  EMAIL: "/email/",
  NOT_FOUND: "/:pathMatch(.*)*",
};
