import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginRuntimeHost, getPluginUtilityProcessForkOptions } from "./pluginRuntimeHost.js";

const electronMock = vi.hoisted(() => {
  type Listener = (payload: unknown) => void;

  class FakeUtilityProcess {
    messages: unknown[] = [];
    killed = false;
    private readonly listeners = new Map<string, Set<Listener>>();

    on(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event) ?? new Set<Listener>();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }

    off(event: string, listener: Listener): this {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    emit(event: string, payload: unknown): void {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(payload);
      }
    }

    postMessage(message: unknown): void {
      this.messages.push(message);
      if (message && typeof message === "object" && (message as { type?: unknown }).type === "start") {
        queueMicrotask(() => this.emit("message", { type: "ready" }));
      }
      if (message && typeof message === "object" && (message as { type?: unknown }).type === "stop") {
        setTimeout(() => this.emit("message", { type: "stopped" }), 5);
      }
    }

    kill(): void {
      this.killed = true;
    }
  }

  return {
    children: [] as FakeUtilityProcess[],
    FakeUtilityProcess
  };
});

vi.mock("electron", () => ({
  app: {
    getAppPath: () => "/app"
  },
  utilityProcess: {
    fork: vi.fn(() => {
      const child = new electronMock.FakeUtilityProcess();
      electronMock.children.push(child);
      return child;
    })
  }
}));

describe("PluginRuntimeHost", () => {
  beforeEach(() => {
    electronMock.children.splice(0);
  });

  it("waits for the worker stop acknowledgement before killing the utility process", async () => {
    const runtime = await PluginRuntimeHost.start({
      pluginKey: "xiitang/word-lookup",
      entryPath: "/plugins/xiitang/word-lookup/main.js",
      permissions: ["wordLookupProvider"],
      config: {},
      requestTimeoutMs: 100
    });
    const child = electronMock.children[0]!;

    const stop = runtime.stop();

    expect(child.messages).toContainEqual({ type: "stop" });
    expect(child.killed).toBe(false);

    await stop;

    expect(child.killed).toBe(true);
  });

  it("reports a worker runtime fault once when the killed process exits", async () => {
    const onRuntimeExit = vi.fn();
    await PluginRuntimeHost.start({
      pluginKey: "xiitang/word-lookup",
      entryPath: "/plugins/xiitang/word-lookup/main.js",
      permissions: ["wordLookupProvider"],
      config: {},
      requestTimeoutMs: 100,
      onRuntimeExit
    });
    const child = electronMock.children[0]!;

    child.emit("message", { type: "runtime-fault", error: "timer callback timed out" });
    child.emit("exit", 1);

    expect(child.killed).toBe(true);
    expect(onRuntimeExit).toHaveBeenCalledTimes(1);
    expect(onRuntimeExit).toHaveBeenCalledWith(expect.objectContaining({
      message: "timer callback timed out"
    }));
  });

  it("disclaims macOS TCC responsibility for third-party plugin utility processes", () => {
    expect(getPluginUtilityProcessForkOptions("darwin")).toEqual({
      stdio: "pipe",
      disclaim: true
    });
  });
});
