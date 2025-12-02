import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import ui from "@nuxt/ui/vue-plugin";
import Toast, { type PluginOptions, POSITION } from "vue-toastification";
import "vue-toastification/dist/index.css";

import App from "./App.vue";
import router from "./router";

const app = createApp(App);

const toastOptions: PluginOptions = {
  transition: "Vue-Toastification__bounce",
  maxToasts: 5,
  newestOnTop: true,
  position: POSITION.BOTTOM_RIGHT,
};

app.use(createPinia());
app.use(router);
app.use(ui);
app.use(Toast, toastOptions);

app.mount("#app");
