# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Board Board is a full-stack app built from an earlier prototype (https://github.com/BrettLoewen/Board-Board-Prototype). Users sign up, add friends by friend code, and create boards holding cards they can drag and resize together in real time. The frontend is Vue 3 + TypeScript + Vite, with Pinia, Vue Router, Nuxt UI (via its Vite plugin, not Nuxt), vue-toastification and interact.js. The backend is Supabase (Postgres + RLS, Auth, Realtime and one Edge Function).

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173/Board-Board/
npm run build        # type-check (vue-tsc --build) and vite build, run in parallel
npm run type-check
npm run lint         # eslint . --fix
npm run format       # prettier --write src/
npx playwright test                              # all e2e tests
npx playwright test e2e/friendsPage.spec.ts      # one file
npx playwright test -g "Users can create Boards" # one test by title
```

There are no unit tests. Testing is Playwright e2e only, in `e2e/`.

### Local backend (needed for dev and tests)

- `supabase start` runs the local stack: API on 54321, Postgres on 54322, Studio on 54323, Inbucket on 54324. `.env` points the app at it, and `.env.production` points it at the hosted project.
- `supabase functions serve delete-user` serves the account-deletion Edge Function locally.
- `supabase migration new <name>` adds a migration, and `supabase db reset` re-applies all of them.
- Regenerate types after schema changes with `npm run gen-types`. Use the script rather than redirecting `supabase gen types` yourself: Windows PowerShell 5.1's `>` writes UTF-16, which git treats as binary and ESLint can't parse. npm runs the script through cmd.exe, whose `>` keeps the output as UTF-8. The Supabase client is typed with `Database`, so stale types cause type-check failures.

### How the e2e tests use the backend

`e2e/utils.ts` `startBackend()` (in `beforeAll`) runs `supabase start` if port 54321 is free and serves `delete-user` if it isn't reachable. `refreshBackend()` (in `beforeEach`) wipes all data by running `supabase/clear_db_data.sql` through `psql` (`truncate auth.users cascade`), so `psql` must be on PATH. Tests run serially with one worker because they share the database. Playwright starts `npm run dev` itself, or reuses a running server outside CI. Email confirmation is disabled in `supabase/config.toml`, so sign-up logs the user in straight away. Shared flows (sign up, log in, send/accept friend requests, create a board) live as helpers in `e2e/utils.ts`. Tests find elements by text and by marker CSS classes such as `navbar-right-button`, `back-button`, `clipboard-button`, `friend-request-primary-button`, `board-card` (with `data-card-id`), `note-card`, `note-textarea`, `toolbar-note-button` and `zoom-percent`, so keep those classes when changing components.

## Architecture

- **Base path**: the app is served under `/Board-Board/` (`vite.config.ts` `base`) because it deploys to GitHub Pages. The router uses `import.meta.env.BASE_URL`, and in CI `index.html` is copied to `404.html` so SPA routing works.
- **Routing and access control** (`src/router/index.ts`): route paths live in `ROUTES` in `src/constants.ts`. Route `meta.requiresAuth` and `meta.requiresBoardAccess` are enforced in a global `beforeEach`. Failures redirect to `/404` (not to login). Board access is checked by selecting the board row and relying on RLS: if no row comes back, the user has no access.
- **Security lives in Postgres**: every table has RLS, and permission logic sits in SQL helper functions (`can_select_board`, `can_access_card_board`, …). Multi-step actions are `security definer` RPCs (`send_friend_request`, `accept_friend_request`, `delete_friend_request`, `refresh_friend_code`) called with `supabase.rpc(...)`. Triggers create `user_profiles`/`user_preferences` on sign-up (`handle_new_user*`) and keep `updated_at` current. To change a rule, add a new migration. Never edit applied migrations, because CI runs `supabase db push` against production.
- **Auth store** (`src/stores/auth.ts`): holds `user`, `session` and `profile`. It listens to `onAuthStateChange`, loads the profile and applies the user's saved color-mode preference. Account deletion calls the `delete-user` Edge Function (`supabase/functions/delete-user`), which uses the service role.
- **Realtime**: there are two separate patterns.
  - `src/stores/realtime.ts` keeps one channel per topic with handlers per event (`on`/`off`/`sendToTopic`). Each logged-in user is subscribed to `user:<id>`. The friend-request flow sends broadcasts from the client (`FriendsPage.vue`) after the RPC succeeds, and `ToastManager.vue` turns them into toasts. Topic and event names are in `REALTIME` in `constants.ts`.
  - Each open board uses one private channel, `board:<id>` (`src/realtime/boardChannel.ts`). Only users who can view the board can join it, enforced by RLS policies on `realtime.messages` in the `board_realtime` migration. The channel carries client broadcasts (`card:geometry` throttled to 50 ms, `card:content` to 100 ms, `card:create`, `card:delete`) and database events from triggers (`INSERT`/`UPDATE`/`DELETE` with the committed row, `BOARD_DELETED`, `ACCESS_REVOKED`). It also carries presence, where each client (one per tab) shares the card it holds. Rates and event names are in `REALTIME` in `constants.ts`.
  - `src/stores/board.ts` (`useBoardStore`) is the single source of truth for the open board. Every local change bumps the card's `rev`. Remote state (broadcast or database) is applied only if its `rev` is higher, and never to the card this client is holding. A `before update` trigger skips writes with a lower `rev` than the stored one. Writes are throttled to 500 ms while dragging, with a final write on release.
  - **Holds/locks:** only the client holding a card (moving, resizing or editing it) changes it. `acquire` refuses a card someone else holds, which is the busy guard. `release` writes first, then broadcasts, then drops the hold. `src/realtime/locks.ts` derives the same holder on every client from presence, so near-simultaneous grabs are settled without coordination. A note's hold is released after 10 s without typing, and the next keystroke takes it back if the card is still free. On every (re)connect the store refetches the cards and merges them by `rev`. The store also owns the local-only camera, the board bounds (cards plus a margin, never smaller than a starting size, and never shrinking while the shrinking part is on screen) and camera clamping. Camera maths lives only in `src/utils/camera.ts`. `DigitalBoard.vue` is the viewport (pan, wheel zoom, initial fit) with a camera-transformed world layer, `BoardDots.vue` draws the dot grid on a canvas in screen space, and `ZoomControl.vue` is the zoom slider. `BaseCard.vue` handles interact.js drag and resize, dividing pointer deltas by the camera scale, and grabs the card before any change. Overlay UI inside the viewport needs the `board-overlay` class so pointerdowns on it don't start a pan. Card types are described in `src/cards/registry.ts` (`CARD_TYPES`): each type supplies a body component (such as `NoteCardBody.vue`) that only draws content and emits changes. `BaseCard.vue` owns everything board-related (click/hold/drag, selection, edit mode, the right-click menu via `CardMenu.vue`, layers, writes). Card colours are palette names resolved through `--card-*` CSS variables in `main.css` (light and dark), or custom `#rrggbb` values (`src/utils/colors.ts`). The user's default note colours live in `user_preferences.card_defaults`.
- **User-facing error text**: Supabase auth error strings and RPC exception messages are mapped to UI messages in `constants.ts` (`AUTH.ERRORS`/`AUTH.MESSAGES`, `FRIEND_REQUEST_ERRORS`). If you change a `raise exception` message in SQL, update the map to match.

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main`: Playwright tests, then build, then deploy the web app to GitHub Pages and the database (`supabase db push` and `functions deploy delete-user`) side by side. Feature work happens on branches that are merged into `main`.

## Style

Prettier uses double quotes, semicolons and `printWidth: 100`. ESLint uses the flat config in `eslint.config.ts` (Vue + TypeScript + Prettier). Use the `@/` alias for `src/`. Components in `src/components` are auto-registered by Nuxt UI's Vite plugin, so they aren't imported. A running dev server can miss a newly added component file and render it as an unknown element, so restart `npm run dev` after adding one. The code is heavily commented with explanatory line comments, and new code should match that.
