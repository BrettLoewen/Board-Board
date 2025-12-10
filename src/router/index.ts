import { createRouter, createWebHistory, type RouteLocationNormalizedGeneric } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabaseClient";
import { ROUTES } from "@/constants";
import DashboardPage from "@/pages/DashboardPage.vue";
import WelcomePage from "@/pages/WelcomePage.vue";
import EmailConfirmationPage from "@/pages/EmailConfirmationPage.vue";
import NotFoundPage from "@/pages/NotFoundPage.vue";
import FriendsPage from "@/pages/FriendsPage.vue";
import SettingsPage from "@/pages/SettingsPage.vue";
import BoardPage from "@/pages/BoardPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: ROUTES.ROOT, component: WelcomePage },
    { path: ROUTES.EMAIL, component: EmailConfirmationPage },
    { path: ROUTES.DASHBOARD, component: DashboardPage, meta: { requiresAuth: true } },
    { path: ROUTES.FRIENDS, component: FriendsPage, meta: { requiresAuth: true } },
    { path: ROUTES.SETTINGS, component: SettingsPage, meta: { requiresAuth: true } },
    {
      path: ROUTES.BOARD_GENERIC,
      component: BoardPage,
      meta: { requiresAuth: true, requiresBoardAccess: true },
    },
    { path: ROUTES.NOT_FOUND, component: NotFoundPage },
  ],
});

router.beforeEach(async (to) => {
  // Get the route's meta data
  const requiresAuth = to.meta.requiresAuth as boolean | undefined;
  const requiresBoardAccess = to.meta.requiresBoardAccess as boolean | undefined;

  // If the route has nothing blocking it, continue to the route
  if (!requiresAuth && !requiresBoardAccess) {
    // console.log("not protected route: " + to.fullPath);
    return true;
  }
  // If it does, check if the user is authenticated
  else {
    if (requiresAuth) {
      // Check the auth status
      const authStatus = await checkAuth(to);

      // If the auth status for this route is invalid, return it for the route (redirect appropriately)
      if (!authStatus || authStatus === ROUTES.NOT_FOUND_STRING) {
        return authStatus;
      }

      if (requiresBoardAccess) {
        // Check if the user has read permission for this board
        const boardStatus = await checkBoardAccess(to);

        // If the board access status for this route is invalid, return it for the route (redirect appropriately)
        if (!boardStatus || boardStatus === ROUTES.NOT_FOUND_STRING) {
          return boardStatus;
        }
      }
    }

    // If all checks passed, continue to the route
    return true;
  }
});

// Check if the user is authenticated. If not, redirect them to the 404 page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkAuth(to: RouteLocationNormalizedGeneric): Promise<string | true> {
  const auth = useAuthStore();

  // If the user is authenticated, continue to the route
  if (auth.user) {
    // console.log("user is authenticated, continuing to " + to.fullPath);
    return true;
  }

  // Attempt to get session from supabase client (in case the user should be signed in but isn't) (in case page refreshed)
  const { data } = await supabase.auth.getSession();
  const session = data?.session ?? null;
  // If the user was found, continue to the route
  if (session?.user) {
    await auth.fetchProfile();
    // console.log("user was actually authenticated, continuing to " + to.fullPath);
    return true;
  }

  // If the user was unable to be authenticated, return the site's 404 page
  // console.log("not authenticated. Redirecting to 404 from " + to.fullPath);
  return ROUTES.NOT_FOUND_STRING;
}

// Check if the user has permission to access this board. If not, redirect them to the 404 page.
async function checkBoardAccess(to: RouteLocationNormalizedGeneric) {
  // Get the board's id out of the url
  const boardId = to.fullPath.substring(to.fullPath.length, 7);
  // console.log("boardId: " + boardId);

  // Query the board
  const { data } = await supabase.from("boards").select().eq("id", boardId);

  // If data for the board was returned, then the user has access to the board (use a select query to test rls policies)
  if (data && data.length > 0) {
    // console.log("The user has access to the board");
    // console.log(data);
    return true;
  }

  // If data was not returned, the user does not have access to the board, so redirect them to the 404 page
  return ROUTES.NOT_FOUND_STRING;
}

export default router;
