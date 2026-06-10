import { execFileSync } from "node:child_process";
import { normalizeVersion, updatePackageVersions } from "./utils.mjs";

const versionArg = process.argv[2];
if (!versionArg) {
  throw new Error("Usage: pnpm release:prepare <version>");
}

const version = normalizeVersion(versionArg);
updatePackageVersions(process.cwd(), version);
execFileSync("pnpm", ["install", "--lockfile-only"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});
console.log(`Prepared release version ${version}`);
