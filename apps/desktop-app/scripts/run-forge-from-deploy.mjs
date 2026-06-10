import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(appDir, "../..");
const stagingDir = path.join(workspaceRoot, "out", "desktop-forge-input");
const stagingOutDir = path.join(stagingDir, "out");
const finalOutDir = path.join(appDir, "out");
const stagingPackageJsonPath = path.join(stagingDir, "package.json");

const [command, ...forgeArgs] = process.argv.slice(2);
if (!command || !["package", "make"].includes(command)) {
  console.error("Usage: node ./scripts/run-forge-from-deploy.mjs <package|make> [...forgeArgs]");
  process.exit(1);
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (typeof result.status === "number") {
    if (result.status !== 0) {
      process.exit(result.status);
    }
    return;
  }
  process.exit(1);
}

await fs.rm(stagingDir, { recursive: true, force: true });
await fs.mkdir(path.dirname(stagingDir), { recursive: true });

run("pnpm", ["--filter", "@immersive-subs/desktop-app", "deploy", "--legacy", stagingDir], workspaceRoot);

const stagingPackageJson = JSON.parse(await fs.readFile(stagingPackageJsonPath, "utf-8"));
stagingPackageJson.devDependencies = {
  electron: stagingPackageJson.devDependencies?.electron
};
stagingPackageJson.config = {
  ...(stagingPackageJson.config ?? {}),
  forge: "./forge.config.mjs"
};
await fs.writeFile(stagingPackageJsonPath, `${JSON.stringify(stagingPackageJson, null, 2)}\n`);

run("pnpm", ["exec", "electron-forge", command, stagingDir, ...forgeArgs], appDir);

await fs.rm(finalOutDir, { recursive: true, force: true });
await fs.rename(stagingOutDir, finalOutDir);
await fs.rm(stagingDir, { recursive: true, force: true });
