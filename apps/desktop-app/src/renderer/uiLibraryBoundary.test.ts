import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const rendererRoot = join(process.cwd(), "src/renderer");
const uiRoot = join(rendererRoot, "components/ui");
const packageJsonPath = join(process.cwd(), "package.json");

const transcriptBodyFiles = new Set([
  "components/subtitle/TranscriptSurface.vue",
  "components/subtitle/TranscriptBlock.vue"
]);

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      return walkFiles(path);
    }
    return /\.(ts|vue)$/.test(path) ? [path] : [];
  });
}

function normalize(path: string): string {
  return relative(rendererRoot, path).replaceAll("\\", "/");
}

function isTestFile(path: string): boolean {
  return /\.test\.ts$/.test(path);
}

function isTranscriptBody(path: string): boolean {
  const rel = normalize(path);
  return transcriptBodyFiles.has(rel) || rel.startsWith("components/subtitle/transcript/");
}

describe("desktop UI library boundary", () => {
  it("declares the approved open-source UI dependencies", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["reka-ui"]).toBe("2.9.7");
    expect(packageJson.dependencies?.["lucide-vue-next"]).toBe("1.0.0");
  });

  it("keeps reka-ui imports inside the local UI primitive layer", () => {
    const offenders = walkFiles(rendererRoot)
      .filter((path) => !isTestFile(path))
      .filter((path) => !normalize(path).startsWith("components/ui/"))
      .filter((path) => !isTranscriptBody(path))
      .filter((path) => /from\s+["']reka-ui["']/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
    expect(existsSync(uiRoot)).toBe(true);
  });

  it("keeps shadcn registry imports out of feature components", () => {
    const offenders = walkFiles(rendererRoot)
      .filter((path) => !isTestFile(path))
      .filter((path) => !normalize(path).startsWith("components/ui/"))
      .filter((path) => /shadcn-vue|registry\/.*ui/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
  });

  it("keeps settings feature components on local primitives instead of raw controls", () => {
    const offenders = walkFiles(join(rendererRoot, "components/settings"))
      .filter((path) => !isTestFile(path))
      .filter((path) => /<(button|select|textarea)\b|<input\b/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
  });

  it("keeps top and subtitle-panel controls on local primitives outside the transcript body", () => {
    const allowedRawControlFiles = new Set(["components/subtitle/CueAnchorRail.vue"]);
    const controlFiles = [
      ...walkFiles(join(rendererRoot, "components/top-panel")),
      ...walkFiles(join(rendererRoot, "components/subtitle"))
    ];

    const offenders = controlFiles
      .filter((path) => !isTestFile(path))
      .filter((path) => !isTranscriptBody(path))
      .filter((path) => !allowedRawControlFiles.has(normalize(path)))
      .filter((path) => /<(button|select|textarea)\b|<input\b/.test(readFileSync(path, "utf8")))
      .map(normalize);

    expect(offenders).toEqual([]);
  });
});
