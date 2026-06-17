import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("renderer-to-main security surface", () => {
  it("does not expose a generic external opener or renderer-controlled release URL", () => {
    const preload = readSource("src/preload.cts");
    const settingsHandlers = readSource("src/main/ipc/handlers/settingsHandlers.ts");
    const releaseHandlers = readSource("src/main/ipc/handlers/releaseHandlers.ts");

    expect(preload).not.toContain("openExternal");
    expect(preload).toContain("openReleaseDownload: ()");
    expect(preload).toContain('ipcRenderer.invoke("usp:open-release-download")');
    expect(preload).not.toContain('ipcRenderer.invoke("usp:open-release-download",');
    expect(settingsHandlers).not.toContain("usp:open-external");
    expect(releaseHandlers).not.toContain("payload");
    expect(releaseHandlers).toContain("context.releaseService.openDownload()");
  });
});
