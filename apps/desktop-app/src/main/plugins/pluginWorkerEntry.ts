import type { PluginPermission } from "./pluginManifest.js";
import { startPluginSandbox, type PluginSandboxRuntime } from "./pluginSandbox.js";
import type { SubtitleTrack } from "../types.js";
import type { TranscriptionProviderContext } from "./pluginContributionRegistry.js";
import type { PluginRuntimeConfigUpdate } from "./pluginRuntimeHost.js";

type ParentPort = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): void;
};

const parentPort = (process as NodeJS.Process & { parentPort?: ParentPort }).parentPort;
if (!parentPort) {
  throw new Error("Plugin worker requires an Electron parent port.");
}

let runtime: PluginSandboxRuntime | null = null;
let pluginKey = "";
let requestTimeoutMs = 30_000;
let nextHostRequestId = 0;
const pendingHostCalls = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

parentPort.on("message", (event) => {
  void handleParentMessage(event.data);
});

async function handleParentMessage(message: unknown): Promise<void> {
  if (!message || typeof message !== "object") {
    return;
  }
  const payload = message as Record<string, unknown>;
  if (payload.type === "start") {
    try {
      await startPlugin(payload);
      parentPort!.postMessage({ type: "ready" });
    } catch (error) {
      parentPort!.postMessage({ type: "startup-error", error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (payload.type === "call" && typeof payload.requestId === "number" && typeof payload.method === "string") {
    try {
      const result = await callRuntime(payload.method, payload.payload);
      parentPort!.postMessage({ type: "response", requestId: payload.requestId, ok: true, result });
    } catch (error) {
      parentPort!.postMessage({
        type: "response",
        requestId: payload.requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }
  if (payload.type === "host-response" && typeof payload.requestId === "number") {
    const request = pendingHostCalls.get(payload.requestId);
    if (!request) {
      return;
    }
    pendingHostCalls.delete(payload.requestId);
    if (payload.ok) {
      request.resolve(payload.result);
    } else {
      request.reject(new Error(String(payload.error ?? "Host runtime call failed")));
    }
    return;
  }
  if (payload.type === "stop") {
    try {
      await runtime?.stop();
      runtime = null;
      parentPort!.postMessage({ type: "stopped" });
    } catch (error) {
      runtime = null;
      parentPort!.postMessage({ type: "runtime-fault", error: error instanceof Error ? error.message : String(error) });
      parentPort!.postMessage({ type: "stopped" });
    }
  }
}

async function startPlugin(payload: Record<string, unknown>): Promise<void> {
  pluginKey = String(payload.pluginKey ?? "");
  requestTimeoutMs = typeof payload.requestTimeoutMs === "number" && payload.requestTimeoutMs > 0
    ? payload.requestTimeoutMs
    : 30_000;
  runtime = await startPluginSandbox({
    pluginKey,
    entryPath: String(payload.entryPath ?? ""),
    permissions: Array.isArray(payload.permissions) ? (payload.permissions as PluginPermission[]) : [],
    config: payload.config && typeof payload.config === "object" && !Array.isArray(payload.config)
      ? (payload.config as Record<string, unknown>)
      : {},
    allowedNetworkHosts: Array.isArray(payload.allowedNetworkHosts)
      ? payload.allowedNetworkHosts.map(String)
      : [],
    readableFiles: Array.isArray(payload.readableFiles) ? payload.readableFiles.map(String) : [],
    requestTimeoutMs,
    onContribution: (contribution) => parentPort!.postMessage({ type: "contribution", contribution }),
    onRuntimeFault: (error) => parentPort!.postMessage({ type: "runtime-fault", error: error.message }),
    transcriptionRuntime: {
      transcribe: async (videoUrl, config) =>
        hostCall("transcriptionRuntime.transcribe", { videoUrl, config }) as Promise<SubtitleTrack>
    }
  });
}

function hostCall(method: string, payload: unknown): Promise<unknown> {
  const requestId = ++nextHostRequestId;
  parentPort!.postMessage({ type: "host-call", requestId, method, payload });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingHostCalls.delete(requestId);
      reject(new Error(`${pluginKey} host call timed out after ${requestTimeoutMs}ms`));
    }, requestTimeoutMs);
    pendingHostCalls.set(requestId, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

async function callRuntime(method: string, payload: unknown): Promise<unknown> {
  if (!runtime) {
    throw new Error("Plugin runtime is not started.");
  }
  switch (method) {
    case "runtime.updateConfig":
      await runtime.updateConfig(payload as PluginRuntimeConfigUpdate);
      return undefined;
    case "wordLookup.lookup":
      return runtime.getWordLookupProvider()?.lookup(String(payload ?? ""));
    case "transcription.transcribe":
      return runtime.getTranscriptionProvider()?.transcribe(payload as TranscriptionProviderContext);
    case "mediaSource.handleConnectionMessage":
      return runtime.getMediaSourceAdapter()?.handleConnectionMessage?.(payload);
    case "mediaSource.handleSettingsUpdated":
      return runtime.getMediaSourceAdapter()?.handleSettingsUpdated?.(payload as Record<string, unknown>);
    case "mediaSource.stop":
      return runtime.getMediaSourceAdapter()?.stop?.();
    default:
      throw new Error(`Unknown plugin provider method: ${method}`);
  }
}
