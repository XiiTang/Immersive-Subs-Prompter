import { describe, expect, it } from "vitest";
import { redactUrlSecrets } from "./urlRedaction.js";

describe("redactUrlSecrets", () => {
  it("redacts known secret query parameters in valid URLs", () => {
    expect(redactUrlSecrets("http://server.local/stream?api_key=secret-123&deviceId=dev")).toBe(
      "http://server.local/stream?api_key=REDACTED&deviceId=dev"
    );
    expect(redactUrlSecrets("ws://server.local/socket?Access_Token=secret-123")).toBe(
      "ws://server.local/socket?Access_Token=REDACTED"
    );
  });

  it("redacts known secret query parameters in malformed URL-like strings", () => {
    expect(redactUrlSecrets("not a url?api_key=secret-123&x=1")).toBe(
      "not a url?api_key=REDACTED&x=1"
    );
  });
});
