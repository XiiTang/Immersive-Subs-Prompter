import { createApp } from "vue";
import { createPinia } from "pinia";
import SettingsApp from "./SettingsApp.vue";
import "./style.css";

const app = createApp(SettingsApp);
app.use(createPinia());
app.mount("#app");
