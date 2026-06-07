function stringField(value, defaultValue, fieldName) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "string") {
    throw new Error(`Transcription ${fieldName} must be a string.`);
  }
  return value;
}

function parseExtraParamsJson(value) {
  const raw = stringField(value, "{}", "extra params JSON").trim();
  if (!raw) {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Transcription extra params must be valid JSON: ${message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Transcription extra params must be a JSON object.");
  }
  const params = {};
  for (const [key, paramValue] of Object.entries(parsed)) {
    if (!key.trim() || key !== key.trim()) {
      throw new Error("Transcription extra params keys must be non-empty strings without edge whitespace.");
    }
    if (typeof paramValue !== "string") {
      throw new Error(`Transcription extra param "${key}" must be a string.`);
    }
    params[key] = paramValue;
  }
  return params;
}

function booleanField(value, defaultValue, fieldName) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Transcription ${fieldName} must be a boolean.`);
  }
  return value;
}

function numberField(value, defaultValue, fieldName) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Transcription ${fieldName} must be a finite number.`);
  }
  return numeric;
}

function providerValue(value) {
  if (value === undefined || value === null || value === "") {
    return "whisper-api";
  }
  if (value === "whisper-api" || value === "faster-whisper") {
    return value;
  }
  throw new Error("Transcription provider must be whisper-api or faster-whisper.");
}

function deviceValue(value) {
  if (value === undefined || value === null || value === "") {
    return "cpu";
  }
  if (value === "cpu" || value === "cuda") {
    return value;
  }
  throw new Error("Transcription faster-whisper device must be cpu or cuda.");
}

function normalizeConfig(config) {
  return {
    id: "plugin-transcription",
    name: "Plugin Transcription",
    provider: providerValue(config.provider),
    baseUrl: stringField(config.baseUrl, "https://api.openai.com/v1", "API base URL"),
    apiKey: stringField(config.apiKey, "", "API key"),
    model: stringField(config.model, "whisper-1", "model"),
    language: stringField(config.language, "", "language"),
    prompt: stringField(config.prompt, "", "prompt"),
    enableWordTimestamps: booleanField(config.enableWordTimestamps, false, "word timestamps"),
    extraParams: parseExtraParamsJson(config.extraParamsJson),
    ytDlpArgs: stringField(config.ytDlpArgs, "", "yt-dlp args"),
    fasterWhisperBinary: stringField(config.fasterWhisperBinary, "faster-whisper", "faster-whisper binary"),
    fasterWhisperModel: stringField(config.fasterWhisperModel, "base", "faster-whisper model"),
    fasterWhisperModelDir: stringField(config.fasterWhisperModelDir, "", "faster-whisper model directory"),
    fasterWhisperDevice: deviceValue(config.fasterWhisperDevice),
    fasterWhisperVadFilter: booleanField(config.fasterWhisperVadFilter, true, "faster-whisper VAD filter"),
    fasterWhisperVadThreshold: numberField(config.fasterWhisperVadThreshold, 0.5, "faster-whisper VAD threshold"),
    fasterWhisperVadMethod: stringField(config.fasterWhisperVadMethod, "", "faster-whisper VAD method"),
    fasterWhisperUseKim2: booleanField(config.fasterWhisperUseKim2, false, "faster-whisper Kim2")
  };
}

usp.registerTranscriptionProvider({
  transcribe: async ({ videoUrl, config }) => {
    return usp.transcriptionRuntime.transcribe(videoUrl, normalizeConfig(config ?? {}));
  }
});
