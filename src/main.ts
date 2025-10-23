import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import ui from "@nuxt/ui/vue-plugin";

import App from "./App.vue";
import router from "./router";
// import { supabase } from "./lib/supabaseClient";
// import { useAuthStore } from "./stores/auth";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ui);

// supabase.auth.onAuthStateChange(async (event, session) => {
//   if (event === "SIGNED_IN" && session) {
//     console.log("User signed in:", session.user);
//     router.push("/dashboard");
//   }
// });

app.mount("#app");
