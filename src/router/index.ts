import { createRouter, createWebHistory } from "vue-router";
import DashboardPage from "@/components/DashboardPage.vue";
import WelcomePage from "@/components/WelcomePage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: WelcomePage },
    { path: "/dashboard", component: DashboardPage },
  ],
});

export default router;
