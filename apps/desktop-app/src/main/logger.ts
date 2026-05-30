import { app } from "electron";
import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import util from "util";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogRecord {
  timestamp: Date;
  scope: string;
  level: LogLevel;
  message: string;
  args: unknown[];
}

interface LogTransport {
  write(record: LogRecord): void;
}

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const LOG_FILE_NAME = "usp-desktop.log";
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_BACKUPS = 3;

// Helper functions and constants - defined at the top
function resolveInitialLevel(): LogLevel {
  const fromEnv = normalizeLevel(process.env.USP_LOG_LEVEL ?? process.env.LOG_LEVEL);
  if (fromEnv) {
    return fromEnv;
  }
  return (process.env.NODE_ENV === "development" ? "debug" : "info") as LogLevel;
}

function normalizeLevel(input?: string | null): LogLevel | null {
  if (!input) {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  if (normalized in LOG_LEVEL_WEIGHT) {
    return normalized as LogLevel;
  }
  return null;
}

function ensureLineTerminated(message: string): string {
  return message.endsWith("\n") ? message : `${message}\n`;
}

function formatRecord(record: LogRecord): string {
  const head = `[${record.timestamp.toISOString()}] [${record.level.toUpperCase()}] [${record.scope}] ${record.message}`;
  const details = formatDetails(record.args);
  return details ? `${head}\n${details}` : head;
}

function formatDetails(args: unknown[]): string | null {
  if (!args.length) {
    return null;
  }
  return args
    .map(describeDetail)
    .map(indentMultiline)
    .join("\n");
}

function describeDetail(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
    return String(value);
  }
  return util.inspect(value, { depth: 4, colors: false, compact: false, breakLength: 120 });
}

function indentMultiline(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}

async function resolveLogDirectory(): Promise<string> {
  const custom = process.env.USP_LOG_DIR?.trim();
  if (custom) {
    await fsPromises.mkdir(custom, { recursive: true });
    return custom;
  }
  if (!app.isReady()) {
    try {
      await app.whenReady();
    } catch (readyError) {
      // Explicit swallow: app may already be quitting or main disposed — fall through to userData path.
      process.stderr.write(
        `[USP][logger] app.whenReady rejected: ${(readyError as Error)?.message ?? readyError}\n`
      );
    }
  }
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    await fsPromises.mkdir(dir, { recursive: true });
    return dir;
  } catch (userDataError) {
    process.stderr.write(
      `[USP][logger] userData logs dir unavailable (${(userDataError as Error)?.message ?? userDataError}); using cwd/logs\n`
    );
    const fallback = path.join(process.cwd(), "logs");
    await fsPromises.mkdir(fallback, { recursive: true });
    return fallback;
  }
}

async function rotateArchives(basePath: string, maxBackups: number) {
  if (maxBackups <= 0) {
    await fsPromises.rm(basePath, { force: true }).catch((error) => {
      // force:true already ignores ENOENT; anything else (EBUSY/EPERM) is non-fatal here.
      process.stderr.write(
        `[USP][logger] Failed to remove base log before rotation: ${(error as Error)?.message ?? error}\n`
      );
    });
    return;
  }
  await fsPromises.rm(`${basePath}.${maxBackups}`, { force: true }).catch((error) => {
    process.stderr.write(
      `[USP][logger] Failed to remove oldest archive: ${(error as Error)?.message ?? error}\n`
    );
  });
  for (let index = maxBackups - 1; index >= 0; index -= 1) {
    const source = index === 0 ? basePath : `${basePath}.${index}`;
    const target = `${basePath}.${index + 1}`;
    try {
      await fsPromises.access(source);
    } catch {
      continue; // archive rung does not exist yet; skip
    }
    await fsPromises.rename(source, target);
  }
}

// Transport classes - defined before LogDispatcher
class ConsoleTransport implements LogTransport {
  write(record: LogRecord): void {
    const payload = ensureLineTerminated(formatRecord(record));
    const stream =
      record.level === "error" || record.level === "warn" ? process.stderr : process.stdout;
    stream.write(payload);
  }
}

class FileTransport implements LogTransport {
  private readonly maxBytes: number;
  private readonly maxBackups: number;
  private stream: fs.WriteStream | null = null;
  private buffer: string[] = [];
  private ready = false;
  private filePath: string | null = null;

  constructor() {
    this.maxBytes = parseInt(process.env.USP_LOG_MAX_BYTES ?? "", 10) || DEFAULT_MAX_BYTES;
    this.maxBackups = parseInt(process.env.USP_LOG_MAX_BACKUPS ?? "", 10) || DEFAULT_MAX_BACKUPS;
    void this.initialize();
  }

  write(record: LogRecord): void {
    const payload = ensureLineTerminated(formatRecord(record));
    if (this.ready && this.stream) {
      this.stream.write(payload);
      return;
    }
    this.buffer.push(payload);
  }

  private async initialize() {
    try {
      const dir = await resolveLogDirectory();
      this.filePath = path.join(dir, LOG_FILE_NAME);
      await this.rotateIfNeeded();
      this.stream = fs.createWriteStream(this.filePath, { flags: "a", encoding: "utf8" });
      this.ready = true;
      this.flushBuffer();
    } catch (error) {
      this.ready = false;
      this.buffer = [];
      process.stderr.write(
        `[USP][logger] Failed to initialize log file transport: ${
          (error as Error)?.message ?? error
        }\n`
      );
    }
  }

  private flushBuffer() {
    if (!this.stream) {
      this.buffer = [];
      return;
    }
    for (const entry of this.buffer) {
      this.stream.write(entry);
    }
    this.buffer = [];
  }

  private async rotateIfNeeded() {
    if (!this.filePath) return;
    try {
      const stats = await fsPromises.stat(this.filePath);
      if (stats.size < this.maxBytes) {
        return;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
    await rotateArchives(this.filePath, this.maxBackups);
  }
}

// Core logger classes
class ScopedLogger {
  private readonly scope: string;
  private readonly dispatcher: LogDispatcher;

  constructor(scope: string, dispatcher: LogDispatcher) {
    this.scope = scope || "app";
    this.dispatcher = dispatcher;
  }

  child(childScope: string): ScopedLogger {
    const normalized = childScope?.trim();
    const nextScope = normalized ? `${this.scope}/${normalized}` : this.scope;
    return new ScopedLogger(nextScope, this.dispatcher);
  }

  debug(message: string, ...details: unknown[]) {
    this.emit("debug", message, details);
  }

  info(message: string, ...details: unknown[]) {
    this.emit("info", message, details);
  }

  warn(message: string, ...details: unknown[]) {
    this.emit("warn", message, details);
  }

  error(message: string, ...details: unknown[]) {
    this.emit("error", message, details);
  }

  log(message: string, ...details: unknown[]) {
    this.info(message, ...details);
  }

  private emit(level: LogLevel, message: string, args: unknown[]) {
    this.dispatcher.publish({
      timestamp: new Date(),
      scope: this.scope,
      level,
      message,
      args
    });
  }
}

class LogDispatcher {
  private level: LogLevel;
  private transports: LogTransport[];

  constructor() {
    this.level = resolveInitialLevel();
    this.transports = [new ConsoleTransport()];
    if (process.env.USP_DISABLE_FILE_LOGS !== "1") {
      this.transports.push(new FileTransport());
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  publish(record: LogRecord) {
    if (!this.shouldLog(record.level)) {
      return;
    }
    for (const transport of this.transports) {
      try {
        transport.write(record);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[USP][logger] Failed to write log entry", error);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[this.level];
  }
}

// Create singleton instances
const dispatcher = new LogDispatcher();
const rootLogger = new ScopedLogger("USP", dispatcher);

export type { LogLevel };
export const createLogger = (scope: string): ScopedLogger => rootLogger.child(scope);
