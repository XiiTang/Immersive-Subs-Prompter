import { describe, expect, it } from "vitest";
import { sanitizeTranscriptionConfig } from "./transcriptionSanitizer.js";

describe("transcriptionSanitizer", () => {
  it("migrates the old verbose default Whisper config name", () => {
    const result = sanitizeTranscriptionConfig({
      id: "transcription-1",
      name: "Default Whisper API",
      provider: "whisper-api"
    });

    expect(result.name).toBe("Whisper API");
  });
});
