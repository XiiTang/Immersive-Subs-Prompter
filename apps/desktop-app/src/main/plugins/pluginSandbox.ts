import { promises as fs } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { SubtitleTrack } from "../types.js";
import type {
  MediaSourceAdapter,
  TranscriptionProvider,
  WordLookupProvider
} from "./pluginContributionRegistry.js";
import type { PluginPermission } from "./pluginManifest.js";
import { PluginPermissionGate } from "./pluginPermissionGate.js";
import type { PluginRuntimeConfigUpdate } from "./pluginRuntimeHost.js";

export type PluginSandboxContribution = "wordLookup" | "transcription" | "mediaSource";

export interface PluginSandboxOptions {
  pluginId: string;
  entryPath: string;
  permissions: PluginPermission[];
  config: Record<string, unknown>;
  allowedNetworkHosts?: string[];
  readableFiles?: string[];
  requestTimeoutMs?: number;
  onContribution?: (contribution: PluginSandboxContribution) => void;
  onRuntimeFault?: (error: Error) => void;
  transcriptionRuntime?: {
    transcribe(videoUrl: string, config: Record<string, unknown>): Promise<SubtitleTrack>;
  };
}

export interface PluginSandboxRuntime {
  getWordLookupProvider(): WordLookupProvider | null;
  getTranscriptionProvider(): TranscriptionProvider | null;
  getMediaSourceAdapter(): MediaSourceAdapter | null;
  updateConfig(update: PluginRuntimeConfigUpdate): Promise<void>;
  stop(): Promise<void>;
}

interface SandboxContributions {
  wordLookup: WordLookupProvider | null;
  transcription: TranscriptionProvider | null;
  mediaSource: MediaSourceAdapter | null;
}

type TimerMaps = {
  timeouts: Map<number, NodeJS.Timeout>;
  intervals: Map<number, NodeJS.Timeout>;
};

const DEFAULT_PLUGIN_REQUEST_TIMEOUT_MS = 30_000;
const SANDBOX_BOOTSTRAP_SOURCE = `
(() => {
  const invoke = globalThis.__uspInvoke;
  delete globalThis.__uspInvoke;

  const providers = {
    wordLookup: null,
    transcription: null,
    mediaSource: null
  };
  const disposers = [];
  const timerCallbacks = new Map();
  let nextTimerId = 0;

  function pack(value) {
    return JSON.stringify(value === undefined ? null : value);
  }

  function host(method, payload) {
    return invoke(String(method), pack(payload));
  }

  function unwrap(raw) {
    const result = JSON.parse(raw);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value;
  }

  async function unwrapAsync(rawPromise) {
    return unwrap(await rawPromise);
  }

  function hostValue(method, payload) {
    return unwrap(host(method, payload));
  }

  async function hostValueAsync(method, payload) {
    return unwrapAsync(host(method, payload));
  }

  function providerResult(operation) {
    return Promise.resolve()
      .then(operation)
      .then(
        (value) => JSON.stringify({ ok: true, value }),
        (error) => JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })
      );
  }

  globalThis.__uspCallProvider = async (method, payloadJson) => {
    const payload = JSON.parse(payloadJson || "null") || {};
    switch (method) {
      case "wordLookup.lookup":
        return providerResult(() => {
          if (!providers.wordLookup) throw new Error("Word lookup provider is not registered.");
          return providers.wordLookup.lookup(String(payload.token ?? ""));
        });
      case "transcription.transcribe":
        return providerResult(() => {
          if (!providers.transcription) throw new Error("Transcription provider is not registered.");
          return providers.transcription.transcribe(payload.context);
        });
      case "mediaSource.handleConnectionMessage":
        return providerResult(() => providers.mediaSource?.handleConnectionMessage?.(payload.message));
      case "mediaSource.handleSettingsUpdated":
        return providerResult(() => providers.mediaSource?.handleSettingsUpdated?.(payload.config));
      case "mediaSource.stop":
        return providerResult(() => providers.mediaSource?.stop?.());
      default:
        return JSON.stringify({ ok: false, error: "Unknown plugin provider method: " + method });
    }
  };

  globalThis.__uspStop = async () => {
    for (const dispose of disposers.splice(0)) {
      await dispose();
    }
  };

  globalThis.__uspFireTimer = (timerId) => {
    const timer = timerCallbacks.get(timerId);
    if (!timer) return;
    if (timer.once) {
      timerCallbacks.delete(timerId);
    }
    timer.callback(...timer.args);
  };

  class SandboxHeaders {
    constructor(entries) {
      this.entriesList = entries;
    }

    get(name) {
      const target = String(name).toLowerCase();
      const entry = this.entriesList.find(([key]) => String(key).toLowerCase() === target);
      return entry ? entry[1] : null;
    }

    entries() {
      return this.entriesList[Symbol.iterator]();
    }
  }

  function encodeUtf8(value) {
    const encoded = unescape(encodeURIComponent(value));
    const bytes = new Uint8Array(encoded.length);
    for (let index = 0; index < encoded.length; index += 1) {
      bytes[index] = encoded.charCodeAt(index);
    }
    return bytes.buffer;
  }

  class SandboxResponse {
    constructor(record) {
      this.ok = Boolean(record.ok);
      this.status = Number(record.status);
      this.statusText = String(record.statusText ?? "");
      this.url = String(record.url ?? "");
      this.headers = new SandboxHeaders(record.headers ?? []);
      this.bodyText = String(record.bodyText ?? "");
    }

    async text() {
      return this.bodyText;
    }

    async json() {
      return JSON.parse(this.bodyText);
    }

    async arrayBuffer() {
      return encodeUtf8(this.bodyText);
    }
  }

  class SandboxURLSearchParams {
    constructor(owner) {
      this.owner = owner;
    }

    get(name) {
      return hostValue("url.searchParamGet", { href: this.owner.__href, key: String(name) });
    }

    set(name, value) {
      this.owner.__href = hostValue("url.searchParamSet", {
        href: this.owner.__href,
        key: String(name),
        value: String(value)
      });
    }
  }

  class SandboxURL {
    constructor(input, base) {
      this.__href = hostValue("url.create", {
        input: String(input),
        base: base === undefined ? undefined : String(base)
      });
      this.searchParams = new SandboxURLSearchParams(this);
    }

    static canParse(input, base) {
      return hostValue("url.canParse", {
        input: String(input),
        base: base === undefined ? undefined : String(base)
      });
    }

    toString() {
      return this.__href;
    }

    get href() {
      return this.__href;
    }

    set href(value) {
      this.__href = hostValue("url.create", { input: String(value) });
    }

    get host() {
      return hostValue("url.get", { href: this.__href, key: "host" });
    }

    get pathname() {
      return hostValue("url.get", { href: this.__href, key: "pathname" });
    }

    set pathname(value) {
      this.__href = hostValue("url.set", { href: this.__href, key: "pathname", value: String(value) });
    }

    get search() {
      return hostValue("url.get", { href: this.__href, key: "search" });
    }

    set search(value) {
      this.__href = hostValue("url.set", { href: this.__href, key: "search", value: String(value) });
    }

    get hash() {
      return hostValue("url.get", { href: this.__href, key: "hash" });
    }

    set hash(value) {
      this.__href = hostValue("url.set", { href: this.__href, key: "hash", value: String(value) });
    }
  }

  function registerTimer(kind, callback, delay, args) {
    if (typeof callback !== "function") {
      throw new TypeError(kind + " callback must be a function");
    }
    const timerId = ++nextTimerId;
    timerCallbacks.set(timerId, { callback, args, once: kind === "setTimeout" });
    hostValue("timer." + kind, { timerId, delay: Number(delay) || 0 });
    return timerId;
  }

  globalThis.URL = SandboxURL;
  globalThis.setTimeout = (callback, delay, ...args) => registerTimer("setTimeout", callback, delay, args);
  globalThis.clearTimeout = (timerId) => {
    timerCallbacks.delete(Number(timerId));
    hostValue("timer.clearTimeout", { timerId: Number(timerId) });
  };
  globalThis.setInterval = (callback, delay, ...args) => registerTimer("setInterval", callback, delay, args);
  globalThis.clearInterval = (timerId) => {
    timerCallbacks.delete(Number(timerId));
    hostValue("timer.clearInterval", { timerId: Number(timerId) });
  };
  globalThis.usp = Object.freeze({
    getConfig: async () => JSON.parse(await hostValueAsync("config.getJson")),
    registerWordLookupProvider: (provider) => {
      providers.wordLookup = provider;
      hostValue("contribution.register", { contribution: "wordLookup" });
    },
    registerTranscriptionProvider: (provider) => {
      providers.transcription = provider;
      hostValue("contribution.register", { contribution: "transcription" });
    },
    registerMediaSourceAdapter: (adapter) => {
      providers.mediaSource = adapter;
      hostValue("contribution.register", { contribution: "mediaSource" });
    },
    registerDispose: (dispose) => {
      if (typeof dispose !== "function") {
        throw new TypeError("dispose must be a function");
      }
      disposers.push(dispose);
    },
    readFile: (targetPath) => hostValueAsync("file.read", { targetPath: String(targetPath) }),
    fetch: async (input, init) => {
      const requestUrl = input instanceof SandboxURL
        ? input.toString()
        : input && typeof input === "object" && typeof input.url === "string"
          ? input.url
          : String(input);
      const response = await hostValueAsync("network.fetch", {
        input: requestUrl,
        init: init === undefined ? null : init
      });
      return new SandboxResponse(response);
    },
    transcriptionRuntime: Object.freeze({
      transcribe: (videoUrl, config) => hostValueAsync("transcriptionRuntime.transcribe", {
        videoUrl: String(videoUrl),
        config: config ?? {}
      })
    })
  });
})();
`;

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(config);
}

function getRequestTimeoutMs(options: Pick<PluginSandboxOptions, "requestTimeoutMs">): number {
  return typeof options.requestTimeoutMs === "number" && options.requestTimeoutMs > 0
    ? options.requestTimeoutMs
    : DEFAULT_PLUGIN_REQUEST_TIMEOUT_MS;
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function normalizeFilePath(targetPath: string): string {
  return path.resolve(targetPath);
}

function getFetchHost(input: string): string {
  return normalizeHost(new URL(input).host);
}

function withPluginTimeout<T>(
  pluginId: string,
  timeoutMs: number,
  operation: () => Promise<T> | T,
  onTimeout?: (error: Error) => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new Error(`${pluginId} plugin call timed out after ${timeoutMs}ms`);
      onTimeout?.(error);
      reject(error);
    }, timeoutMs);
    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
  });
}

export async function startPluginSandbox(options: PluginSandboxOptions): Promise<PluginSandboxRuntime> {
  const gate = new PluginPermissionGate(options.pluginId, options.permissions);
  const timeoutMs = getRequestTimeoutMs(options);
  let currentConfig = cloneConfig(options.config);
  let allowedNetworkHosts = new Set((options.allowedNetworkHosts ?? []).map(normalizeHost).filter(Boolean));
  let readableFiles = new Set((options.readableFiles ?? []).map(normalizeFilePath));
  const timers: TimerMaps = {
    timeouts: new Map(),
    intervals: new Map()
  };
  const contributions: SandboxContributions = {
    wordLookup: null,
    transcription: null,
    mediaSource: null
  };
  const onTimeout = (error: Error) => options.onRuntimeFault?.(error);
  let context: vm.Context;

  const registerContribution = (contribution: unknown): void => {
    switch (contribution) {
      case "wordLookup":
        gate.require("wordLookupProvider");
        contributions.wordLookup = {
          lookup: (token) => withPluginTimeout(
            options.pluginId,
            timeoutMs,
            () => callSandboxProvider(context, "wordLookup.lookup", { token }),
            onTimeout
          )
        };
        options.onContribution?.("wordLookup");
        return;
      case "transcription":
        gate.require("transcriptionProvider");
        contributions.transcription = {
          transcribe: (providerContext) => withPluginTimeout(
            options.pluginId,
            timeoutMs,
            () => callSandboxProvider(context, "transcription.transcribe", { context: providerContext }) as Promise<SubtitleTrack>,
            onTimeout
          )
        };
        options.onContribution?.("transcription");
        return;
      case "mediaSource":
        gate.require("mediaSourceAdapter");
        contributions.mediaSource = {
          handleConnectionMessage: (message) => withPluginTimeout(
            options.pluginId,
            timeoutMs,
            () => callSandboxProvider(context, "mediaSource.handleConnectionMessage", { message }),
            onTimeout
          ),
          handleSettingsUpdated: (config) => withPluginTimeout(
            options.pluginId,
            timeoutMs,
            () => callSandboxProvider(context, "mediaSource.handleSettingsUpdated", { config }) as Promise<void>,
            onTimeout
          ),
          stop: () => withPluginTimeout(
            options.pluginId,
            timeoutMs,
            () => callSandboxProvider(context, "mediaSource.stop", {} ) as Promise<void>,
            onTimeout
          )
        };
        options.onContribution?.("mediaSource");
        return;
      default:
        throw new Error(`${options.pluginId} registered unsupported contribution: ${String(contribution)}`);
    }
  };

  const invoke = (method: string, payloadJson: string): string | Promise<string> => {
    const payload = parseBridgePayload(payloadJson);
    switch (method) {
      case "config.getJson":
        return bridgeResult(() => JSON.stringify(cloneConfig(currentConfig)));
      case "contribution.register":
        return bridgeResult(() => registerContribution(getRecordValue(payload, "contribution")));
      case "file.read":
        return bridgeResultAsync(async () => {
          gate.require("readSelectedFile");
          const targetPath = String(getRecordValue(payload, "targetPath") ?? "");
          if (!readableFiles.has(normalizeFilePath(targetPath))) {
            throw new Error(`${options.pluginId} cannot read unselected file: ${targetPath}`);
          }
          return fs.readFile(targetPath, "utf-8");
        });
      case "network.fetch":
        return bridgeResultAsync(async () => {
          gate.require("network");
          const input = String(getRecordValue(payload, "input") ?? "");
          const host = getFetchHost(input);
          if (!allowedNetworkHosts.has(host)) {
            throw new Error(`${options.pluginId} cannot access network host: ${host}`);
          }
          const response = await fetch(input, parseFetchInit(getRecordValue(payload, "init")));
          return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            headers: Array.from(response.headers.entries()),
            bodyText: await response.text()
          };
        });
      case "transcriptionRuntime.transcribe":
        return bridgeResultAsync(async () => {
          gate.require("transcriptionRuntime");
          if (!options.transcriptionRuntime) {
            throw new Error(`${options.pluginId} requested unavailable transcription runtime`);
          }
          return options.transcriptionRuntime.transcribe(
            String(getRecordValue(payload, "videoUrl") ?? ""),
            parseObjectValue(getRecordValue(payload, "config"))
          );
        });
      case "url.create":
        return bridgeResult(() => new URL(
          String(getRecordValue(payload, "input") ?? ""),
          optionalStringValue(getRecordValue(payload, "base"))
        ).toString());
      case "url.canParse":
        return bridgeResult(() => URL.canParse(
          String(getRecordValue(payload, "input") ?? ""),
          optionalStringValue(getRecordValue(payload, "base"))
        ));
      case "url.get":
        return bridgeResult(() => getUrlField(
          String(getRecordValue(payload, "href") ?? ""),
          String(getRecordValue(payload, "key") ?? "")
        ));
      case "url.set":
        return bridgeResult(() => setUrlField(
          String(getRecordValue(payload, "href") ?? ""),
          String(getRecordValue(payload, "key") ?? ""),
          String(getRecordValue(payload, "value") ?? "")
        ));
      case "url.searchParamGet":
        return bridgeResult(() => new URL(
          String(getRecordValue(payload, "href") ?? "")
        ).searchParams.get(String(getRecordValue(payload, "key") ?? "")));
      case "url.searchParamSet":
        return bridgeResult(() => {
          const parsed = new URL(String(getRecordValue(payload, "href") ?? ""));
          parsed.searchParams.set(
            String(getRecordValue(payload, "key") ?? ""),
            String(getRecordValue(payload, "value") ?? "")
          );
          return parsed.toString();
        });
      case "timer.setTimeout":
        return bridgeResult(() => setSandboxTimeout(context, timers, payload, options.onRuntimeFault));
      case "timer.clearTimeout":
        return bridgeResult(() => clearSandboxTimeout(timers, payload));
      case "timer.setInterval":
        return bridgeResult(() => setSandboxInterval(context, timers, payload, options.onRuntimeFault));
      case "timer.clearInterval":
        return bridgeResult(() => clearSandboxInterval(timers, payload));
      default:
        return bridgeResult(() => {
          throw new Error(`Unknown sandbox bridge method: ${method}`);
        });
    }
  };

  const source = await fs.readFile(options.entryPath, "utf-8");
  const sandbox = Object.create(null) as Record<string, unknown>;
  sandbox.__uspInvoke = invoke;
  context = vm.createContext(sandbox, {
    codeGeneration: {
      strings: false,
      wasm: false
    }
  });
  vm.runInContext(SANDBOX_BOOTSTRAP_SOURCE, context, { filename: `${options.pluginId}:bootstrap` });
  vm.runInContext(source, context, { filename: options.entryPath, timeout: timeoutMs });

  return {
    getWordLookupProvider: () => contributions.wordLookup,
    getTranscriptionProvider: () => contributions.transcription,
    getMediaSourceAdapter: () => contributions.mediaSource,
    updateConfig: async (update) => {
      currentConfig = cloneConfig(update.config);
      allowedNetworkHosts = new Set(update.allowedNetworkHosts.map(normalizeHost).filter(Boolean));
      readableFiles = new Set(update.readableFiles.map(normalizeFilePath));
    },
    stop: async () => {
      await runSandboxStop(context);
      clearSandboxTimers(timers);
    }
  };
}

async function callSandboxProvider(context: vm.Context, method: string, payload: unknown): Promise<unknown> {
  const rawPayload = JSON.stringify(payload ?? null);
  const raw = await vm.runInContext(
    `__uspCallProvider(${JSON.stringify(method)}, ${JSON.stringify(rawPayload)})`,
    context
  );
  return unwrapBridgeResult(String(raw));
}

async function runSandboxStop(context: vm.Context): Promise<void> {
  await vm.runInContext("__uspStop()", context);
}

function fireSandboxTimer(context: vm.Context, timerId: number, onRuntimeFault?: (error: Error) => void): void {
  try {
    vm.runInContext(`__uspFireTimer(${JSON.stringify(timerId)})`, context);
  } catch (error) {
    onRuntimeFault?.(error instanceof Error ? error : new Error(String(error)));
  }
}

function setSandboxTimeout(
  context: vm.Context,
  timers: TimerMaps,
  payload: unknown,
  onRuntimeFault?: (error: Error) => void
): void {
  const timerId = numberValue(getRecordValue(payload, "timerId"));
  const delay = Math.max(0, numberValue(getRecordValue(payload, "delay")));
  clearSandboxTimeout(timers, payload);
  const timeout = setTimeout(() => {
    timers.timeouts.delete(timerId);
    fireSandboxTimer(context, timerId, onRuntimeFault);
  }, delay);
  timers.timeouts.set(timerId, timeout);
}

function clearSandboxTimeout(timers: TimerMaps, payload: unknown): void {
  const timerId = numberValue(getRecordValue(payload, "timerId"));
  const timeout = timers.timeouts.get(timerId);
  if (timeout) {
    clearTimeout(timeout);
    timers.timeouts.delete(timerId);
  }
}

function setSandboxInterval(
  context: vm.Context,
  timers: TimerMaps,
  payload: unknown,
  onRuntimeFault?: (error: Error) => void
): void {
  const timerId = numberValue(getRecordValue(payload, "timerId"));
  const delay = Math.max(0, numberValue(getRecordValue(payload, "delay")));
  clearSandboxInterval(timers, payload);
  const interval = setInterval(() => fireSandboxTimer(context, timerId, onRuntimeFault), delay);
  timers.intervals.set(timerId, interval);
}

function clearSandboxInterval(timers: TimerMaps, payload: unknown): void {
  const timerId = numberValue(getRecordValue(payload, "timerId"));
  const interval = timers.intervals.get(timerId);
  if (interval) {
    clearInterval(interval);
    timers.intervals.delete(timerId);
  }
}

function bridgeResult(operation: () => unknown): string {
  try {
    return JSON.stringify({ ok: true, value: operation() });
  } catch (error) {
    return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function bridgeResultAsync(operation: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify({ ok: true, value: await operation() });
  } catch (error) {
    return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function unwrapBridgeResult(raw: string): unknown {
  const result = JSON.parse(raw);
  if (!result.ok) {
    throw new Error(String(result.error ?? "Plugin sandbox call failed"));
  }
  return result.value;
}

function parseBridgePayload(input: string): unknown {
  return JSON.parse(input || "null");
}

function parseObjectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function getRecordValue(input: unknown, key: string): unknown {
  return parseObjectValue(input)[key];
}

function optionalStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseFetchInit(input: unknown): RequestInit | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  return input as RequestInit;
}

function getUrlField(href: string, key: string): string {
  const parsed = new URL(href);
  switch (key) {
    case "host":
      return parsed.host;
    case "pathname":
      return parsed.pathname;
    case "search":
      return parsed.search;
    case "hash":
      return parsed.hash;
    default:
      throw new Error(`Unsupported URL field: ${key}`);
  }
}

function setUrlField(href: string, key: string, value: string): string {
  const parsed = new URL(href);
  switch (key) {
    case "pathname":
      parsed.pathname = value;
      break;
    case "search":
      parsed.search = value;
      break;
    case "hash":
      parsed.hash = value;
      break;
    default:
      throw new Error(`Unsupported URL field: ${key}`);
  }
  return parsed.toString();
}

function clearSandboxTimers(timers: TimerMaps): void {
  for (const timeout of timers.timeouts.values()) {
    clearTimeout(timeout);
  }
  timers.timeouts.clear();
  for (const interval of timers.intervals.values()) {
    clearInterval(interval);
  }
  timers.intervals.clear();
}
