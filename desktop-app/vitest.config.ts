import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, defineProject } from "vitest/config";

const sharedSetupFiles = ["./src/renderer/test/setup.ts"];
const rendererProjectConfig = {
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/renderer", import.meta.url))
    }
  }
};

export default defineConfig({
  test: {
    attachmentsDir: ".vitest-a",
    projects: [
      defineProject({
        ...rendererProjectConfig,
        test: {
          name: "browser",
          globals: true,
          include: ["src/renderer/**/*.browser.test.ts"],
          setupFiles: sharedSetupFiles,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            trace: {
              mode: "retain-on-failure",
              tracesDir: "./.vitest-traces"
            },
            instances: [
              {
                browser: "chromium"
              }
            ]
          }
        }
      }),
      defineProject({
        ...rendererProjectConfig,
        test: {
          name: "jsdom",
          environment: "jsdom",
          globals: true,
          testTimeout: 15000,
          include: ["src/renderer/**/*.test.ts"],
          exclude: ["src/renderer/**/*.browser.test.ts"],
          setupFiles: sharedSetupFiles
        }
      })
    ]
  }
});
