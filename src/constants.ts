export const AUTH = {
  MODES: {
    LOGIN: "login",
    SIGN_UP: "sign-up",
  },
  VALIDATION: {
    VALID: "valid",
    INVALID: "invalid",
    WEAK_PASSWORD: "weak_password",
    MISSING_FIELD: "missing_field",
    INVALID_USERNAME: "invalid_username",
  },
  ERRORS: {
    INVALID: "AuthApiError: Invalid login credentials",
    ALREADY_REGISTERED: "AuthApiError: User already registered",
    WEAK_PASSWORD: "AuthWeakPasswordError",
    DATABASE_ERROR: "AuthApiError: Database error saving new user",
    EMAIL_NOT_CONFIRMED: "AuthApiError: Email not confirmed",
  },
};

export const ROUTES = {
  ROOT: "/",
  DASHBOARD: "/dashboard/",
  EMAIL: "/email/",
  NOT_FOUND: "/:pathMatch(.*)*",
};
