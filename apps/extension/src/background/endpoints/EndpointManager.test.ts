import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENDPOINTS_STORAGE_KEY } from "../../shared/constants";
import { EndpointManager } from "./EndpointManager";

describe("EndpointManager", () => {
  const defaultEndpoints = ["ws://127.0.0.1:44501"];
  let getMock: ReturnType<typeof vi.fn>;
  let setMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getMock = vi.fn();
    setMock = vi.fn((_: Record<string, unknown>, callback?: () => void) => callback?.());
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getMock,
          set: setMock
        }
      },
      runtime: {
        lastError: null
      }
    });
  });

  it("falls back to default endpoints when storage key is missing", async () => {
    getMock.mockImplementation((_: string[], callback: (result: Record<string, unknown>) => void) => {
      callback({});
    });

    const manager = new EndpointManager({
      storageKey: ENDPOINTS_STORAGE_KEY,
      defaultEndpoints
    });

    await expect(manager.load()).resolves.toEqual(defaultEndpoints);
  });

  it("falls back to default endpoints on empty set when fallbackToDefault is enabled", () => {
    const onChange = vi.fn();
    const manager = new EndpointManager({
      storageKey: ENDPOINTS_STORAGE_KEY,
      defaultEndpoints,
      onChange
    });

    const result = manager.set([], { persist: false, fallbackToDefault: true });

    expect(result).toEqual(defaultEndpoints);
    expect(manager.getEndpoints()).toEqual(defaultEndpoints);
    expect(onChange).toHaveBeenCalledWith(defaultEndpoints);
    expect(setMock).not.toHaveBeenCalled();
  });
});
