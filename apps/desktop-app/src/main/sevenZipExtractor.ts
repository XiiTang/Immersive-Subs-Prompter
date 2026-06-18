import { spawn } from "node:child_process";
import { createRequire } from "node:module";

type SevenZipBin = {
  path7za?: string;
};

export type RunProcess = (file: string, args: string[]) => Promise<void>;

export type ExtractSevenZipOptions = {
  archivePath: string;
  destinationDir: string;
  sevenZipPath?: string;
  runProcess?: RunProcess;
};

const require = createRequire(import.meta.url);

export async function extractSevenZipArchive(options: ExtractSevenZipOptions): Promise<void> {
  const sevenZipPath = options.sevenZipPath ?? getBundledSevenZipPath();
  const runProcess = options.runProcess ?? runProcessDefault;

  await runProcess(sevenZipPath, [
    "x",
    options.archivePath,
    `-o${options.destinationDir}`,
    "-y"
  ]);
}

function getBundledSevenZipPath(): string {
  const sevenZip = require("7zip-bin") as SevenZipBin;
  if (!sevenZip.path7za) {
    throw new Error("Bundled 7za executable was not found.");
  }
  return sevenZip.path7za;
}

async function runProcessDefault(file: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    const stderr: Buffer[] = [];

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`7z extraction failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf-8").trim()}`));
    });
  });
}
