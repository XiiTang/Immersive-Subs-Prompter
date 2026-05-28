import { describe, expect, it } from "vitest";
import { sanitizeTranscriptionConfig } from "./transcriptionSanitizer.js";

describe("transcriptionSanitizer", () => {
  it("preserves an explicit Whisper API config name", () => {
    const result = sanitizeTranscriptionConfig({
      id: "transcription-1",
      name: "Team Whisper",
      provider: "whisper-api"
    });

    expect(result.name).toBe("Team Whisper");
  });

  it("uses the current provider default when the config name is empty", () => {
    const result = sanitizeTranscriptionConfig({
      id: "transcription-1",
      name: "   ",
      provider: "whisper-api"
    });

    expect(result.name).toBe("Whisper API");
  });
});
