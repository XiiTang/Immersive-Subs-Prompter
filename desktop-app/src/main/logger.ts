import { app } from "electron";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import util from "util";

/**
 * Logger that mirrors console output to a UTF-8 (with BOM) log file so that
 * Windows viewers (e.g. 记事本) render non-ASCII characters correctly.
 */

const LOG_FILE_NAME = "usp-desktop.log";
const LOG_MAX_BYTES = 2 * 1024 * 1024; // 2MB cap before rolling
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

type LogLevel = "INFO" | "WARN" | "ERROR";

let logFilePath: string | null = null;
let initPromise: Promise<void> | null = null;
let flushPromise: Promise<void> | null = null;
let rotating = false;
const bufferQueue: string[] = [];

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number, size = 2) => n.toString().padStart(size, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(
    now.getMilliseconds(),
    3
  )}`;
}

function formatMessage(level: LogLevel, prefix: string, message: string): string {
  return `[${getTimestamp()}] [${level}] [${prefix}] ${message}`;
}

function serializeDetails(rest: unknown[]): string | null {
  if (!rest.length) {
    return null;
  }
  const parts = rest.map((item) => {
    if (item instanceof Error) {
      return item.stack || `${item.name}: ${item.message}`;
    }
    if (typeof item === "string") {
      return item;
    }
    return util.inspect(item, { depth: 5, colors: false, compact: true, breakLength: Infinity });
  });
  return parts.join(" ");
}

function enqueueLine(line: string) {
  bufferQueue.push(`${line}${os.EOL}`);
  if (logFilePath) {
    scheduleFlush();
  } else {
    ensureLogFile();
  }
}

function scheduleFlush() {
  if (flushPromise || !logFilePath) {
    return;
  }
  flushPromise = flushQueue().finally(() => {
    flushPromise = null;
    if (bufferQueue.length && logFilePath) {
      scheduleFlush();
    }
  });
}

async function flushQueue() {
  if (!logFilePath) return;
  try {
    while (bufferQueue.length) {
      const entry = bufferQueue.shift();
      if (!entry) continue;
      await rotateIfNeeded(logFilePath);
      await fs.appendFile(logFilePath, entry, { encoding: "utf8" });
    }
  } catch (error) {
    console.warn("[USP][logger] Failed to flush log queue", error);
  }
}

async function rotateIfNeeded(target: string) {
  if (rotating) return;
  rotating = true;
  try {
    const stats = await fs.stat(target);
    if (stats.size < LOG_MAX_BYTES) {
      return;
    }
    const backupPath = `${target}.1`;
    await fs.rename(target, backupPath).catch(() => {
      /* ignore rotation failures */
    });
    await fs.writeFile(target, UTF8_BOM);
  } catch (error) {
    console.warn("[USP][logger] Failed to rotate log file", error);
  } finally {
    rotating = false;
  }
}

async function ensureLogFile() {
  if (!initPromise) {
    initPromise = initializeLogFile()
      .catch((error) => {
        console.warn("[USP][logger] Unable to initialize log file", error);
        logFilePath = null;
      })
      .finally(() => {
        if (!logFilePath) {
          initPromise = null;
        }
      });
  }
  return initPromise;
}

async function initializeLogFile() {
  if (!app.isReady()) {
    await app.whenReady();
  }

  const baseDir = safeGetLogDir();
  await fs.mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, LOG_FILE_NAME);
  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    await fs.writeFile(filePath, UTF8_BOM);
  } else {
    await ensureUtf8Bom(filePath);
    await rotateIfNeeded(filePath);
  }

  logFilePath = filePath;
  if (bufferQueue.length) {
    scheduleFlush();
  }
}

function safeGetLogDir(): string {
  try {
    return app.getPath("logs");
  } catch {
    return path.join(app.getPath("userData"), "logs");
  }
}

async function ensureUtf8Bom(filePath: string) {
  const handle = await fs.open(filePath, "r");
  const header = Buffer.alloc(3);
  await handle.read(header, 0, 3, 0);
  await handle.close();

  const hasBom = header.equals(UTF8_BOM);
  if (hasBom) {
    return;
  }

  const content = await fs.readFile(filePath);
  await fs.writeFile(filePath, Buffer.concat([UTF8_BOM, content]));
}

function emit(level: LogLevel, prefix: string, message: string, ...rest: unknown[]) {
  const base = formatMessage(level, prefix, message);
  forwardToConsole(level, base, ...rest);
  const serialized = serializeDetails(rest);
  const line = serialized ? `${base} ${serialized}` : base;
  enqueueLine(line);
}

function forwardToConsole(level: LogLevel, message: string, ...rest: unknown[]) {
  if (level === "ERROR") {
    console.error(message, ...rest);
  } else if (level === "WARN") {
    console.warn(message, ...rest);
  } else {
    console.log(message, ...rest);
  }
}

ensureLogFile();

export const logger = {
  log(prefix: string, message: string, ...rest: unknown[]) {
    emit("INFO", prefix, message, ...rest);
  },

  info(prefix: string, message: string, ...rest: unknown[]) {
    emit("INFO", prefix, message, ...rest);
  },

  warn(prefix: string, message: string, ...rest: unknown[]) {
    emit("WARN", prefix, message, ...rest);
  },

  error(prefix: string, message: string, ...rest: unknown[]) {
    emit("ERROR", prefix, message, ...rest);
  }
};
