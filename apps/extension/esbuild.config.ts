import * as esbuild from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type BuildTargetName = "chrome" | "firefox";

const shared: esbuild.BuildOptions = {
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  platform: "browser",
  target: ["chrome110", "firefox109"],
};

const targets: Record<BuildTargetName, { manifest: string; outDir: string }> = {
  chrome: {
    manifest: path.join(__dirname, "manifest.json"),
    outDir: path.join(__dirname, "dist", "chrome"),
  },
  firefox: {
    manifest: path.join(__dirname, "manifest.firefox.json"),
    outDir: path.join(__dirname, "dist", "firefox"),
  },
};

async function copyDirectory(src: string, dest: string) {
  await fs.cp(src, dest, { recursive: true });
}

async function copyStaticAssets({ manifest, outDir }: { manifest: string; outDir: string }) {
  await Promise.all([
    fs.copyFile(manifest, path.join(outDir, "manifest.json")),
    fs.copyFile(path.join(__dirname, "popup.html"), path.join(outDir, "popup.html")),
    fs.copyFile(path.join(__dirname, "popup.css"), path.join(outDir, "popup.css")),
    copyDirectory(path.join(__dirname, "icons"), path.join(outDir, "icons")),
    copyDirectory(path.join(__dirname, "_locales"), path.join(outDir, "_locales")),
  ]);
}

async function bundleScripts(outputDir: string) {
  const scriptsDir = path.join(outputDir, "dist");
  await fs.mkdir(scriptsDir, { recursive: true });

  await Promise.all([
    esbuild.build({
      ...shared,
      entryPoints: [path.join(__dirname, "src/background.ts")],
      outfile: path.join(scriptsDir, "background.js"),
      format: "esm",
    }),
    esbuild.build({
      ...shared,
      entryPoints: [path.join(__dirname, "src/content/index.ts")],
      outfile: path.join(scriptsDir, "content-script.js"),
      format: "iife",
      globalName: "USPContentScript",
    }),
    esbuild.build({
      ...shared,
      entryPoints: [path.join(__dirname, "src/popup.ts")],
      outfile: path.join(scriptsDir, "popup.js"),
      format: "esm",
    }),
  ]);
}

async function build() {
  const targetName = (process.argv[2] || "chrome") as BuildTargetName;
  const target = targets[targetName];

  if (!target) {
    throw new Error(`Unknown build target "${targetName}". Use "chrome" or "firefox".`);
  }

  await fs.rm(target.outDir, { recursive: true, force: true });
  await bundleScripts(target.outDir);
  await copyStaticAssets(target);

  console.log(`Built ${targetName} extension to ${target.outDir}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
