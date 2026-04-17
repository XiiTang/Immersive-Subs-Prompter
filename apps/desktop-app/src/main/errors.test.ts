import { describe, expect, it, vi } from "vitest";

// Logger uses electron; mocked by setup.ts. We also spy on console output to
// verify reportError writes to the configured transport.

describe("errors", () => {
  it("reportError passes an Error's name/message/stack to the logger", async () => {
    const { reportError } = await import("./errors.js");
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      reportError(new Error("boom"), "unit.test.reportError");
      const combined = [
        ...stderrSpy.mock.calls.map((c) => String(c[0])),
        ...stdoutSpy.mock.calls.map((c) => String(c[0]))
      ].join("\n");
      expect(combined).toContain("unit.test.reportError");
      expect(combined).toContain("boom");
    } finally {
      stderrSpy.mockRestore();
      stdoutSpy.mockRestore();
    }
  });

  it("reportError handles non-Error values without crashing", async () => {
    const { reportError } = await import("./errors.js");
    expect(() => reportError("plain string", "unit.test.nonError")).not.toThrow();
    expect(() => reportError(null, "unit.test.null")).not.toThrow();
    expect(() =>
      reportError({ code: 42 }, "unit.test.obj", { extra: { a: 1 } })
    ).not.toThrow();
  });

  it("swallow never throws and accepts any error shape", async () => {
    const { swallow } = await import("./errors.js");
    expect(() => swallow(new Error("x"), "ctx", "reason")).not.toThrow();
    expect(() => swallow("string", "ctx", "reason")).not.toThrow();
    expect(() => swallow(undefined, "ctx", "reason")).not.toThrow();
  });
});
