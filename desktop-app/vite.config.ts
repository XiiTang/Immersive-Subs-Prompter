import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  plugins: [vue()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer")
    }
  },
  build: {
    target: "chrome146",
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/renderer/index.html"),
        settings: path.resolve(__dirname, "src/renderer/settings.html")
      }
    }
  }
});
