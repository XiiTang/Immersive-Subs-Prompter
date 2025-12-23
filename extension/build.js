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
      entryPoints: ["src/content-script.js"],
      outfile: "dist/content-script.js",
      format: "iife",
      globalName: "USPContentScript",
    }),
  ]);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
