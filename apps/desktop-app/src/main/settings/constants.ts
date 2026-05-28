import { app } from "electron";
import path from "path";
import {
  NetworkSettings,
  TranscriptionConfig,
  TranscriptionPluginConfig
} from "../types.js";

import { DEFAULT_YTDLP_ARGS } from "../../common/ytdlpDefaults.js";
import {
  createDefaultTranscriptionConfig,
  createDefaultTranscriptionPluginConfig,
  DEFAULT_TRANSCRIPTION_CONFIG_ID,
  DEFAULT_TRANSCRIPTION_YTDLP_ARGS
} from "../../common/transcriptionDefaults.js";
import { createConnectionAuthToken } from "../connectionAuth.js";
import {
  DEFAULT_CACHE_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_NETWORK_ENDPOINTS,
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_NAME,
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  DEFAULT_SUBTITLE_PRIMARY_COLOR,
  DEFAULT_SUBTITLE_SECONDARY_COLOR
} from "../../common/defaultSettings.js";

export { DEFAULT_YTDLP_ARGS };
export {
  DEFAULT_CACHE_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PROFILE_ID,
  DEFAULT_PROFILE_NAME,
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  DEFAULT_SUBTITLE_PRIMARY_COLOR,
  DEFAULT_SUBTITLE_SECONDARY_COLOR
};

export const SUPPORTED_LANGUAGES = ["en", "zh"];
export const DEFAULT_LANGUAGE = DEFAULT_GLOBAL_SETTINGS.language;
export const DEFAULT_WS_HOST = DEFAULT_NETWORK_ENDPOINTS[0]!.host;
export const DEFAULT_WS_PORT = DEFAULT_NETWORK_ENDPOINTS[0]!.port;
export const DEFAULT_WS_ENDPOINT_ID = DEFAULT_NETWORK_ENDPOINTS[0]!.id;

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  endpoints: DEFAULT_NETWORK_ENDPOINTS.map((endpoint) => ({ ...endpoint })),
  authToken: createConnectionAuthToken()
};

export const DEFAULT_FASTER_WHISPER_MODEL_DIR = path.join(app.getPath("userData"), "faster-whisper", "models");

export { DEFAULT_TRANSCRIPTION_CONFIG_ID };

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = createDefaultTranscriptionConfig({
  fasterWhisperModelDir: DEFAULT_FASTER_WHISPER_MODEL_DIR
});

export const DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG: TranscriptionPluginConfig = createDefaultTranscriptionPluginConfig({
  fasterWhisperModelDir: DEFAULT_FASTER_WHISPER_MODEL_DIR
});

export { DEFAULT_TRANSCRIPTION_YTDLP_ARGS } from "../../common/transcriptionDefaults.js";
