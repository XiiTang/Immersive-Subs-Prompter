import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/renderer", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/renderer/**/*.test.ts"],
    setupFiles: ["./src/renderer/test/setup.ts"]
  }
});
