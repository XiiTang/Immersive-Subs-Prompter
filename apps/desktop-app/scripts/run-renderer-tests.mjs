import { spawnSync } from "node:child_process";

const extraArgs = process.argv.slice(2);
const forwardedArgs = extraArgs[0] === "--" ? extraArgs.slice(1) : extraArgs;
const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", ...forwardedArgs, "--project", "browser", "--project", "jsdom"],
  {
    stdio: "inherit",
    shell: process.platform === "win32"
  }
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
