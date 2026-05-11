import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = path.resolve(import.meta.dirname);
const desktopAppRoot = path.resolve(rendererRoot, "..", "..");

function readDesktopFile(...segments: string[]) {
  return readFileSync(path.join(desktopAppRoot, ...segments), "utf8");
}

describe("Vue 3.5 upgrade", () => {
  it("pins the desktop app to exact Vue 3.5 and Vue TSC versions", () => {
    const packageJson = JSON.parse(readDesktopFile("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.vue).toBe("3.5.34");
    expect(packageJson.devDependencies?.["vue-tsc"]).toBe("3.2.8");
  });

  it("replaces legacy template refs with useTemplateRef", () => {
    const files = ["src/renderer/components/subtitle/TranscriptSurface.vue"];

    for (const file of files) {
      const source = readDesktopFile(file);
      expect(source).toMatch(/useTemplateRef(?:<[^>]+>)?\(/);
      expect(source).not.toMatch(/const\s+\w+Ref\s*=\s*ref<HTMLElement\s*\|\s*null>\(null\)/);
    }
  });

  it("uses reactive props destructuring across renderer components", () => {
    const files = [
      "src/renderer/components/icons/IconAdd.vue",
      "src/renderer/components/icons/IconDelete.vue",
      "src/renderer/components/top-panel/TopControlPanel.vue",
      "src/renderer/components/subtitle/CueAnchorRail.vue",
      "src/renderer/components/subtitle/PlaybackControls.vue",
      "src/renderer/components/subtitle/StatusBanner.vue",
      "src/renderer/components/subtitle/TrackSelector.vue",
      "src/renderer/components/subtitle/TranscriptionControls.vue",
      "src/renderer/components/subtitle/TranscriptBlock.vue",
      "src/renderer/components/subtitle/TranscriptSurface.vue"
    ];

    for (const file of files) {
      const source = readDesktopFile(file);
      expect(source).not.toContain("const props = defineProps");
      expect(source).not.toContain("withDefaults(defineProps");
    }
  });
});
