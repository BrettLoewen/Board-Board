import { createRouter, createWebHistory } from "vue-router";
import DashboardPage from "@/components/DashboardPage.vue";
import WelcomePage from "@/components/WelcomePage.vue";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/lib/supabaseClient";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: WelcomePage },
    { path: "/dashboard", component: DashboardPage, meta: { requiresAuth: true } },
  ],
});

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();
  // Wait for initial store init to resolve user (init runs on store creation)
  // If profile and user are null but there may be a session, let the store handle it.
  const requiresAuth = to.meta.requiresAuth as boolean | undefined;
  if (!requiresAuth) return next();
  // If user already known, go
  if (auth.user) return next();
  // Otherwise attempt to get session from supabase client (in case page refreshed)
  const { data } = await supabase.auth.getSession();
  const s = data?.session ?? null;
  if (s?.user) {
    await auth.fetchProfile();
    return next();
  }
  // not authenticated
  return next({ path: "/" });
});

export default router;
