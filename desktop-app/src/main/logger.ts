import { execSync } from "child_process";
import { app } from "electron";
import fs from "fs";
import { promises as fsPromises } from "fs";
import iconv from "iconv-lite";
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

const dispatcher = new LogDispatcher();
const rootLogger = new ScopedLogger("USP", dispatcher);

export type { LogLevel };
export const logger = rootLogger;
export const createLogger = (scope: string): ScopedLogger => rootLogger.child(scope);
export const setLogLevel = (level: LogLevel) => dispatcher.setLevel(level);

class ConsoleTransport implements LogTransport {
  private readonly encoding: string;

  constructor() {
    this.encoding = detectConsoleEncoding();
  }

  write(record: LogRecord): void {
    const payload = ensureLineTerminated(formatRecord(record));
    const stream =
      record.level === "error" || record.level === "warn" ? process.stderr : process.stdout;
    this.writeToStream(stream, payload);
  }

  private writeToStream(stream: NodeJS.WriteStream, payload: string) {
    if (this.shouldTranscode(stream)) {
      try {
        const buffer = iconv.encode(payload, this.encoding);
        stream.write(buffer);
      } catch {
        stream.write(payload);
      }
      return;
    }
    stream.write(payload);
  }

  private shouldTranscode(stream: NodeJS.WriteStream) {
    return (
      process.platform === "win32" &&
      Boolean(stream.isTTY) &&
      this.encoding !== "utf8" &&
      iconv.encodingExists(this.encoding)
    );
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

async function resolveLogDirectory(): Promise<string> {
  const custom = process.env.USP_LOG_DIR?.trim();
  if (custom) {
    await fsPromises.mkdir(custom, { recursive: true });
    return custom;
  }
  if (!app.isReady()) {
    try {
      await app.whenReady();
    } catch {
      // ignore readiness errors, fall back to temp dir
    }
  }
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    await fsPromises.mkdir(dir, { recursive: true });
    return dir;
  } catch {
    const fallback = path.join(process.cwd(), "logs");
    await fsPromises.mkdir(fallback, { recursive: true });
    return fallback;
  }
}

async function rotateArchives(basePath: string, maxBackups: number) {
  if (maxBackups <= 0) {
    await fsPromises.rm(basePath, { force: true }).catch(() => {});
    return;
  }
  await fsPromises.rm(`${basePath}.${maxBackups}`, { force: true }).catch(() => {});
  for (let index = maxBackups - 1; index >= 0; index -= 1) {
    const source = index === 0 ? basePath : `${basePath}.${index}`;
    const target = `${basePath}.${index + 1}`;
    try {
      await fsPromises.access(source);
    } catch {
      continue;
    }
    await fsPromises.rename(source, target);
  }
}

const CODE_PAGE_TO_ICONV: Record<number, string> = {
  936: "gbk",
  950: "big5",
  932: "shift_jis",
  949: "cp949",
  1252: "win1252",
  1251: "win1251",
  1250: "win1250",
  437: "cp437",
  850: "cp850",
  866: "cp866",
  65001: "utf8"
};

let cachedEncoding: string | null = null;

function detectConsoleEncoding(): string {
  if (cachedEncoding) {
    return cachedEncoding;
  }
  if (process.platform !== "win32") {
    cachedEncoding = "utf8";
    return cachedEncoding;
  }
  const codePage = getActiveCodePage();
  const candidate = codePage ? CODE_PAGE_TO_ICONV[codePage] ?? `cp${codePage}` : "utf8";
  cachedEncoding = iconv.encodingExists(candidate) ? candidate : "utf8";
  return cachedEncoding;
}

function getActiveCodePage(): number | null {
  try {
    const shell = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    const output = execSync("chcp", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell
    });
    const match = /(\d+)\s*$/.exec(output.trim());
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  } catch {
    // ignore detection failures
  }
  return null;
}
