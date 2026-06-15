import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

interface PopupStylesheetOptions {
  sharedUiEntrypoint?: string;
  popupLayoutPath: string;
}

export async function buildPopupStylesheet(options: PopupStylesheetOptions): Promise<string> {
  const sharedUiEntrypoint = options.sharedUiEntrypoint ?? require.resolve("@immersive-subs/ui/index.css");
  const sharedCss = await readCssWithImports(sharedUiEntrypoint);
  const popupLayoutCss = await fs.readFile(options.popupLayoutPath, "utf-8");

  return `${sharedCss.trimEnd()}\n\n${popupLayoutCss.trimEnd()}\n`;
}

export async function writePopupStylesheet(outDir: string, options: PopupStylesheetOptions): Promise<void> {
  const css = await buildPopupStylesheet(options);
  await fs.writeFile(path.join(outDir, "popup.css"), css, "utf-8");
}

async function readCssWithImports(filePath: string, seen = new Set<string>()): Promise<string> {
  const absolutePath = path.resolve(filePath);
  if (seen.has(absolutePath)) {
    throw new Error(`Circular CSS import detected at ${absolutePath}`);
  }
  seen.add(absolutePath);

  const lines = (await fs.readFile(absolutePath, "utf-8")).split(/\r?\n/);
  const output: string[] = [];
  for (const line of lines) {
    const importPath = line.match(/^\s*@import\s+["'](.+)["'];\s*$/)?.[1];
    if (!importPath) {
      output.push(line);
      continue;
    }
    output.push(await readCssWithImports(path.resolve(path.dirname(absolutePath), importPath), seen));
  }

  seen.delete(absolutePath);
  return output.join("\n");
}
