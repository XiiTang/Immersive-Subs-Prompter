import { shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

export type OpenFolderResult = { ok: true } | { ok: false; error: string };

export async function openFolder(targetPath: string, operation: string): Promise<OpenFolderResult> {
  try {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      throw new Error(`${operation} path is empty.`);
    }
    const resolved = path.resolve(trimmed);
    await fs.mkdir(resolved, { recursive: true });
    const canonical = await fs.realpath(resolved);
    const shellError = await shell.openPath(canonical);
    if (shellError) {
      throw new Error(shellError);
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
