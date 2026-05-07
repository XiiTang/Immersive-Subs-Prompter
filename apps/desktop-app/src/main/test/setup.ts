import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

const userDataDir = path.join(os.tmpdir(), "usp-test-userdata");

vi.mock("electron", () => {
  return {
    app: {
      isReady: () => true,
      whenReady: async () => undefined,
      getPath: (name: string) => {
        if (name === "userData") return userDataDir;
        if (name === "logs") return path.join(userDataDir, "logs");
        return os.tmpdir();
      },
      getVersion: () => "0.0.0-test",
      getAppPath: () => userDataDir,
      quit: () => undefined,
      on: () => undefined,
      off: () => undefined,
      setAppUserModelId: () => undefined
    },
    ipcMain: {
      handle: () => undefined,
      on: () => undefined,
      removeHandler: () => undefined
    },
    screen: {
      getDisplayNearestPoint: () => ({
        workArea: { x: 0, y: 0, width: 1440, height: 900 }
      }),
      getDisplayMatching: () => ({
        workArea: { x: 0, y: 0, width: 1440, height: 900 }
      }),
      getCursorScreenPoint: () => ({ x: 0, y: 0 })
    },
    BrowserWindow: class {
      static getAllWindows() {
        return [];
      }
    },
    Menu: {
      buildFromTemplate: () => ({
        popup: () => undefined
      }),
      setApplicationMenu: () => undefined
    },
    Tray: class {
      setToolTip() {}
      setContextMenu() {}
    },
    shell: {
      openExternal: async () => undefined,
      showItemInFolder: () => undefined,
      openPath: async () => ""
    },
    dialog: {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showMessageBox: async () => ({ response: 0 })
    },
    nativeTheme: {
      on: () => undefined,
      off: () => undefined
    }
  };
});

// Disable file log transport in tests; console-only logging is still captured.
process.env.USP_DISABLE_FILE_LOGS = "1";
