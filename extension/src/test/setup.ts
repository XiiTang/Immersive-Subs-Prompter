import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
