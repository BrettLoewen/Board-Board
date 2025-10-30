import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabaseClient";
import { ROUTES } from "@/constants";
import DashboardPage from "@/pages/DashboardPage.vue";
import WelcomePage from "@/pages/WelcomePage.vue";
import EmailConfirmationPage from "@/pages/EmailConfirmationPage.vue";
import NotFoundPage from "@/pages/NotFoundPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: ROUTES.ROOT, component: WelcomePage },
    { path: ROUTES.EMAIL, component: EmailConfirmationPage },
    { path: ROUTES.DASHBOARD, component: DashboardPage, meta: { requiresAuth: true } },
    { path: ROUTES.NOT_FOUND, component: NotFoundPage },
  ],
});

router.beforeEach(async (to) => {
  // Check if the route requires authentication
  const requiresAuth = to.meta.requiresAuth as boolean | undefined;

  // If it does not, continue to the route
  if (!requiresAuth) {
    // console.log("not protected route " + to.fullPath);
    return true;
  }
  // If it does, check if the user is authenticated
  else {
    const auth = useAuthStore();

    // If the user is authenticated, continue to the route
    if (auth.user) {
      return true;
    }

    // Attempt to get session from supabase client (in case the user should be signed in but isn't) (in case page refreshed)
    const { data } = await supabase.auth.getSession();
    const session = data?.session ?? null;
    // If the user was found, continue to the route
    if (session?.user) {
      await auth.fetchProfile();
      return true;
    }

    // If the user was unable to be authenticated, return the site's homepage
    // console.log("not authenticated " + to.fullPath);
    return ROUTES.ROOT;
  }
});

export default router;
