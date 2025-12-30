const esbuild = require("esbuild");
const fs = require("fs/promises");
const path = require("path");

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  platform: "browser",
  target: ["chrome110", "firefox109"],
};

const targets = {
  chrome: {
    manifest: path.join(__dirname, "manifest.json"),
    outDir: path.join(__dirname, "dist", "chrome"),
  },
  firefox: {
    manifest: path.join(__dirname, "manifest.firefox.json"),
    outDir: path.join(__dirname, "dist", "firefox"),
  },
};

async function copyDirectory(src, dest) {
  if (typeof fs.cp === "function") {
    await fs.cp(src, dest, { recursive: true });
    return;
  }

  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(src, entry.name);
      const targetPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    })
  );
}

async function copyStaticAssets({ manifest, outDir }) {
  await Promise.all([
    fs.copyFile(manifest, path.join(outDir, "manifest.json")),
    fs.copyFile(path.join(__dirname, "popup.html"), path.join(outDir, "popup.html")),
    fs.copyFile(path.join(__dirname, "popup.css"), path.join(outDir, "popup.css")),
    copyDirectory(path.join(__dirname, "icons"), path.join(outDir, "icons")),
  ]);
}

async function bundleScripts(outputDir) {
  const scriptsDir = path.join(outputDir, "dist");
  await fs.mkdir(scriptsDir, { recursive: true });

  await Promise.all([
    esbuild.build({
      ...shared,
      entryPoints: ["src/background.js"],
      outfile: path.join(scriptsDir, "background.js"),
      format: "esm",
    }),
    esbuild.build({
      ...shared,
      entryPoints: ["src/content/index.js"],
      outfile: path.join(scriptsDir, "content-script.js"),
      format: "iife",
      globalName: "USPContentScript",
    }),
    esbuild.build({
      ...shared,
      entryPoints: ["src/popup.js"],
      outfile: path.join(scriptsDir, "popup.js"),
      format: "esm",
    }),
  ]);
}

async function build() {
  const targetName = process.argv[2] || "chrome";
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
