import path from "node:path";
import { app, utilityProcess, type UtilityProcess } from "electron";
import type { PluginPermission } from "./pluginManifest.js";
import type {
  MediaSourceAdapter,
  TranscriptionProvider,
  WordLookupProvider
} from "./pluginContributionRegistry.js";
import type { SubtitleTrack } from "../types.js";

export interface PluginRuntimeHostOptions {
  pluginKey: string;
  entryPath: string;
  permissions: PluginPermission[];
  config: Record<string, unknown>;
  allowedNetworkHosts?: string[];
  readableFiles?: string[];
  requestTimeoutMs?: number;
  onRuntimeExit?: (error: Error) => void;
  onContributionsChanged?: () => void;
  transcriptionRuntime?: {
    transcribe(videoUrl: string, config: Record<string, unknown>): Promise<SubtitleTrack>;
  };
}

export interface PluginRuntimeConfigUpdate {
  config: Record<string, unknown>;
  allowedNetworkHosts: string[];
  readableFiles: string[];
}

interface RuntimeContributions {
  wordLookup: WordLookupProvider | null;
  transcription: TranscriptionProvider | null;
  mediaSource: MediaSourceAdapter | null;
}

const DEFAULT_PLUGIN_REQUEST_TIMEOUT_MS = 30_000;

export function getPluginUtilityProcessForkOptions(
  platform: NodeJS.Platform = process.platform
): Electron.ForkOptions {
  const options: Electron.ForkOptions = { stdio: "pipe" };
  if (platform === "darwin") {
    options.disclaim = true;
  }
  return options;
}

function getRequestTimeoutMs(options: Pick<PluginRuntimeHostOptions, "requestTimeoutMs">): number {
  return typeof options.requestTimeoutMs === "number" && options.requestTimeoutMs > 0
    ? options.requestTimeoutMs
    : DEFAULT_PLUGIN_REQUEST_TIMEOUT_MS;
}

function rejectPendingRequests(
  pending: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>,
  error: Error
): void {
  for (const [requestId, request] of pending.entries()) {
    clearTimeout(request.timeout);
    request.reject(error);
    pending.delete(requestId);
  }
}

function waitForWorkerStop(child: UtilityProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off("message", onMessage);
      resolve();
    }, timeoutMs);
    const onMessage = (message: unknown) => {
      if (message && typeof message === "object" && (message as { type?: unknown }).type === "stopped") {
        clearTimeout(timeout);
        child.off("message", onMessage);
        resolve();
      }
    };
    child.on("message", onMessage);
    child.postMessage({ type: "stop" });
  });
}

export class PluginRuntimeHost {
  private stopped = false;

  private constructor(
    readonly pluginKey: string,
    private readonly contributions: RuntimeContributions,
    private readonly disposers: Array<() => void | Promise<void>>,
    private readonly updateRuntimeConfig: (update: PluginRuntimeConfigUpdate) => Promise<void> | void,
    private readonly utility?: UtilityProcess
  ) {}

  static async start(options: PluginRuntimeHostOptions): Promise<PluginRuntimeHost> {
    return PluginRuntimeHost.startUtilityProcess(options);
  }

  private static async startUtilityProcess(options: PluginRuntimeHostOptions): Promise<PluginRuntimeHost> {
    const workerEntry = path.join(app.getAppPath(), "dist/main/plugins/pluginWorkerEntry.js");
    const child = utilityProcess.fork(workerEntry, [], getPluginUtilityProcessForkOptions());
    const timeoutMs = getRequestTimeoutMs(options);
    let stopped = false;
    let nextRequestId = 0;
    const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }>();
    const contributions: RuntimeContributions = {
      wordLookup: null,
      transcription: null,
      mediaSource: null
    };

    const callWorker = (method: string, payload: unknown) => {
      const requestId = ++nextRequestId;
      return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          const error = new Error(`${options.pluginKey} plugin call timed out after ${timeoutMs}ms`);
          stopped = true;
          child.kill();
          options.onRuntimeExit?.(error);
          reject(error);
        }, timeoutMs);
        pending.set(requestId, { resolve, reject, timeout });
        child.postMessage({ type: "call", requestId, method, payload });
      });
    };

    child.on("message", (message: unknown) => {
      if (!message || typeof message !== "object") {
        return;
      }
      const payload = message as Record<string, unknown>;
      if (payload.type === "response" && typeof payload.requestId === "number") {
        const request = pending.get(payload.requestId);
        if (!request) {
          return;
        }
        pending.delete(payload.requestId);
        clearTimeout(request.timeout);
        if (payload.ok) {
          request.resolve(payload.result);
        } else {
          request.reject(new Error(String(payload.error ?? "Plugin worker call failed")));
        }
      }
      if (payload.type === "contribution" && payload.contribution === "wordLookup") {
        contributions.wordLookup = {
          lookup: (token) => callWorker("wordLookup.lookup", token)
        };
        options.onContributionsChanged?.();
      }
      if (payload.type === "contribution" && payload.contribution === "transcription") {
        contributions.transcription = {
          transcribe: (context) => callWorker("transcription.transcribe", context) as Promise<SubtitleTrack>
        };
        options.onContributionsChanged?.();
      }
      if (payload.type === "contribution" && payload.contribution === "mediaSource") {
        contributions.mediaSource = {
          handleConnectionMessage: (message) => callWorker("mediaSource.handleConnectionMessage", message),
          handleSettingsUpdated: (config) => callWorker("mediaSource.handleSettingsUpdated", config) as Promise<void>,
          stop: () => callWorker("mediaSource.stop", undefined) as Promise<void>
        };
        options.onContributionsChanged?.();
      }
      if (payload.type === "host-call" && typeof payload.requestId === "number") {
        void handleHostCall(options, child, payload.requestId, String(payload.method ?? ""), payload.payload);
      }
      if (payload.type === "runtime-fault") {
        const error = new Error(String(payload.error ?? "Plugin worker runtime fault"));
        rejectPendingRequests(pending, error);
        stopped = true;
        child.kill();
        options.onRuntimeExit?.(error);
      }
    });

    child.on("error", (type, location) => {
      const error = new Error(`${options.pluginKey} plugin worker error: ${type} at ${location}`);
      rejectPendingRequests(pending, error);
    });

    child.on("exit", (code) => {
      const error = new Error(`${options.pluginKey} plugin worker exited with code ${code}`);
      rejectPendingRequests(pending, error);
      if (!stopped) {
        options.onRuntimeExit?.(error);
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`${options.pluginKey} plugin worker did not start`));
      }, 5000);
      const onMessage = (message: unknown) => {
        if (message && typeof message === "object" && (message as { type?: unknown }).type === "ready") {
          clearTimeout(timeout);
          child.off("message", onMessage);
          resolve();
        }
        if (message && typeof message === "object" && (message as { type?: unknown }).type === "startup-error") {
          clearTimeout(timeout);
          child.off("message", onMessage);
          child.kill();
          reject(new Error(String((message as { error?: unknown }).error ?? "Plugin worker startup failed")));
        }
      };
      child.on("message", onMessage);
      child.postMessage({
        type: "start",
        pluginKey: options.pluginKey,
        entryPath: options.entryPath,
        permissions: options.permissions,
        config: options.config,
        allowedNetworkHosts: options.allowedNetworkHosts ?? [],
        readableFiles: options.readableFiles ?? [],
        requestTimeoutMs: timeoutMs
      });
    });

    return new PluginRuntimeHost(
      options.pluginKey,
      contributions,
      [
        async () => {
          stopped = true;
          await waitForWorkerStop(child, timeoutMs);
        }
      ],
      (update) => callWorker("runtime.updateConfig", update) as Promise<void>,
      child
    );
  }

  getWordLookupProvider(): WordLookupProvider | null {
    return this.contributions.wordLookup;
  }

  getTranscriptionProvider(): TranscriptionProvider | null {
    return this.contributions.transcription;
  }

  getMediaSourceAdapter(): MediaSourceAdapter | null {
    return this.contributions.mediaSource;
  }

  async updateConfig(update: PluginRuntimeConfigUpdate): Promise<void> {
    await this.updateRuntimeConfig(update);
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    for (const dispose of this.disposers.splice(0)) {
      await dispose();
    }
    this.utility?.kill();
  }
}

async function handleHostCall(
  options: PluginRuntimeHostOptions,
  child: UtilityProcess,
  requestId: number,
  method: string,
  payload: unknown
): Promise<void> {
  try {
    if (method !== "transcriptionRuntime.transcribe") {
      throw new Error(`Unknown host runtime method: ${method}`);
    }
    if (!options.transcriptionRuntime) {
      throw new Error(`${options.pluginKey} requested unavailable transcription runtime`);
    }
    const source = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const result = await options.transcriptionRuntime.transcribe(
      String(source.videoUrl ?? ""),
      source.config && typeof source.config === "object" && !Array.isArray(source.config)
        ? (source.config as Record<string, unknown>)
        : {}
    );
    child.postMessage({ type: "host-response", requestId, ok: true, result });
  } catch (error) {
    child.postMessage({
      type: "host-response",
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
