import { describe, expect, it } from "vitest";
import { assertHttpUrl, assertPublicHttpUrl, isPublicHttpUrl } from "./networkUrlSafety.js";

describe("networkUrlSafety", () => {
  it("rejects local private link-local multicast and metadata hosts", () => {
    for (const url of [
      "http://localhost:8096/watch",
      "http://localhost.:8096/watch",
      "http://app.localhost/watch",
      "http://app.localhost./watch",
      "http://service.local./watch",
      "http://127.0.0.1:8080/watch",
      "http://10.0.0.5/watch",
      "http://172.16.0.5/watch",
      "http://192.168.1.45/watch",
      "http://100.64.0.1/watch",
      "http://169.254.169.254/latest/meta-data",
      "http://metadata.google.internal/computeMetadata/v1",
      "http://metadata.google.internal./computeMetadata/v1",
      "http://224.0.0.1/watch",
      "http://[::1]/watch",
      "http://[fc00::1]/watch",
      "http://[fe80::1]/watch",
      "http://[ff00::1]/watch"
    ]) {
      expect(isPublicHttpUrl(url), url).toBe(false);
    }
  });

  it("accepts public HTTP and HTTPS URLs", () => {
    expect(assertPublicHttpUrl("https://youtube.com/watch?v=abc", "Subtitle video URL")).toBe(
      "https://youtube.com/watch?v=abc"
    );
    expect(isPublicHttpUrl("http://example.com/watch")).toBe(true);
  });

  it("accepts local and private HTTP(S) URLs for user-configured endpoints", () => {
    expect(assertHttpUrl("https://api.openai.com/v1", "Whisper API base URL")).toBe("https://api.openai.com/v1");
    expect(assertHttpUrl("http://127.0.0.1:8080/v1", "Whisper API base URL")).toBe(
      "http://127.0.0.1:8080/v1"
    );
    expect(assertHttpUrl("http://localhost:8080/v1", "Whisper API base URL")).toBe(
      "http://localhost:8080/v1"
    );
    expect(assertHttpUrl("http://192.168.1.20:8080/v1", "Whisper API base URL")).toBe(
      "http://192.168.1.20:8080/v1"
    );
  });

  it("rejects non HTTP(S) schemes for user-configured endpoints", () => {
    expect(() => assertHttpUrl("file:///tmp/socket", "Whisper API base URL")).toThrow(
      "Whisper API base URL must use http or https."
    );
    expect(() => assertHttpUrl("not a url", "Whisper API base URL")).toThrow(
      "Whisper API base URL must be a valid URL."
    );
  });
});
