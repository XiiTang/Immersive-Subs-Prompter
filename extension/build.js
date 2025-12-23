const esbuild = require("esbuild");

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  platform: "browser",
  target: ["chrome110"],
};

async function build() {
  await Promise.all([
    esbuild.build({
      ...shared,
      entryPoints: ["src/background.js"],
      outfile: "dist/background.js",
      format: "esm",
    }),
    esbuild.build({
      ...shared,
      entryPoints: ["src/content/index.js"],
      outfile: "dist/content-script.js",
      format: "iife",
      globalName: "USPContentScript",
    }),
    esbuild.build({
      ...shared,
      entryPoints: ["src/popup.js"],
      outfile: "dist/popup.js",
      format: "esm",
    }),
  ]);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
