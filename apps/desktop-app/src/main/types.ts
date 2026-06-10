import type {
  LoopCommandPayload,
  LoopSnapshot,
  UrlRuleMatchType
} from "@immersive-subs/contracts";

export interface SubtitleCue {
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
}

export interface SubtitleTrack {
  id: string;
  sourceFile: string;
  cues: SubtitleCue[];
}

export interface SubtitleLoadResult {
  tracks: SubtitleTrack[];
}

export interface PlaybackState {
  currentTime: number;
  duration: number | null;
  playbackRate: number;
  lastUpdate: number | null;
  loop: LoopSnapshot | null;
}

export interface DesktopState {
  connectionCount: number;
  networkListeners: NetworkListenerStatus[];
  activeTabId: number | null;
  pageUrl: string | null;
  videoUrl: string | null;
  title: string | null;
  site: string | null;
  activeSource: SubtitleSource | null;
  status: "idle" | "awaiting-video" | "loading-subtitles" | "ready" | "error";
  error: string | null;
  playback: PlaybackState;
  subtitleTracks: SubtitleTrack[];
  selectedPrimarySubtitleId: string | null;
  selectedSecondarySubtitleId: string | null;
  primarySubtitles: SubtitleTrack | null;
  secondarySubtitles: SubtitleTrack | null;
  appliedProfileId: string | null;
  appliedProfileName: string | null;
  appliedRuleId: string | null;
  appliedRuleName: string | null;
  appliedRulePattern: string | null;
  appliedRuleMatchType: UrlRuleMatchType | null;
  pendingMediaServerItemId: string | null; // Used to prevent race conditions when switching between MediaServer and extension
  mediaServer: MediaServerPanelState;
  isFullscreen: boolean;
  transcription: TranscriptionState;
}

export type SubtitleSource = "extension" | "mediaserver";

export type VideoControlCommand =
  | { type: "seek"; time: number } // milliseconds
  | { type: "pause" }
  | { type: "play" }
  | {
      type: "loop";
      loop: LoopCommandPayload;
    }
  | { type: "stopLoop" };

type AlwaysOnTopLevel = "off" | "floating" | "screen-saver";

export type AppearanceTheme = "system" | "light" | "dark";

interface AppearanceSettings {
  theme: AppearanceTheme;
}

type TranscriptionProvider = "whisper-api" | "faster-whisper";
type FasterWhisperDevice = "cpu" | "cuda";

export interface GlobalSettings {
  autoLaunch: boolean;
  toggleWindowShortcut: string;
  gameProcessBlacklist: string[];
  autoHidePanels: boolean;
  alwaysOnTop: AlwaysOnTopLevel;
  panelOpacity: number;
  language: string;
  appearance: AppearanceSettings;
  autoCheckUpdates: boolean;
  lastUpdateCheckAt: number | null;
}

export interface TranscriptionConfig {
  id: string;
  name: string;
  provider: TranscriptionProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  language: string;
  prompt: string;
  enableWordTimestamps: boolean;
  extraParams: Record<string, string>;
  ytDlpArgs: string;
  fasterWhisperBinary: string;
  fasterWhisperModel: string;
  fasterWhisperModelDir: string;
  fasterWhisperDevice: FasterWhisperDevice;
  fasterWhisperVadFilter: boolean;
  fasterWhisperVadThreshold: number;
  fasterWhisperVadMethod: string;
  fasterWhisperUseKim2: boolean;
}

export interface SubtitleCacheSettings {
  enabled: boolean;
  path: string;
  retentionDays: number;
}

export interface NetworkSettings {
  endpoints: NetworkEndpoint[];
  authToken: string;
}

export interface NetworkEndpoint {
  id: string;
  host: string;
  port: number;
}

export interface NetworkListenerStatus {
  endpointId: string;
  host: string;
  port: number;
  status: "listening" | "error";
  error: string | null;
}

export interface ProfileSettings {
  primarySubtitleFontFamily: string;
  primarySubtitleFontSize: number;
  secondarySubtitleFontFamily: string;
  secondarySubtitleFontSize: number;
  subtitleTimestampFontSize: number;
  subtitleAutoHideMetaRow: boolean;
  subtitlePrimarySecondaryGap: number;
  subtitleLineHeight: number;
  subtitlePrimaryColor: string;
  subtitleSecondaryColor: string;
  subtitleActivePrimaryColor: string;
  subtitleActiveSecondaryColor: string;
  ytDlpArgs: string;
  subtitleAutoScrollTimeout: number;
  subtitleScrollPosition: number;
  subtitleBlockGap: number;
  primarySubtitlePriority: string[];
  secondarySubtitlePriority: string[];
}

export interface ProfileDefinition {
  id: string;
  name: string;
  description?: string | null;
  settings: ProfileSettings;
}

export interface ProfileRule {
  id: string;
  name: string;
  pattern: string;
  profileId: string;
}

export interface PluginSettingsRecord {
  config: Record<string, unknown>;
}

export interface AppSettings {
  global: GlobalSettings;
  network: NetworkSettings;
  profiles: ProfileDefinition[];
  defaultProfileId: string;
  rules: ProfileRule[];
  plugins: Record<string, PluginSettingsRecord>;
  cache: SubtitleCacheSettings;
}

export interface MediaServerSubtitleStream {
  index: number;
  codec: string | null;
  language: string | null;
  displayTitle: string | null;
  isDefault: boolean;
  isForced: boolean;
  isText: boolean;
}

export interface MediaServerSessionSummary {
  id: string;
  serverConfigId: string;
  serverName: string;
  serverType: string;
  deviceName: string | null;
  client: string | null;
  userName: string | null;
  nowPlayingItemId: string | null;
  nowPlayingItemName: string | null;
  mediaSourceId: string | null;
  runTimeTicks: number | null;
  positionTicks: number | null;
  isPaused: boolean;
  playbackRate: number | null;
  subtitleStreams: MediaServerSubtitleStream[];
}

interface MediaServerPanelState {
  connected: boolean;
  sessions: MediaServerSessionSummary[];
  selectedSessionId: string | null;
  lastUpdated: number | null; // timestamp in milliseconds
}

export interface MediaServerStatusPayload {
  connected: boolean;
  serverType: string;
}

export interface MediaServerSubtitlesPayload {
  sessionId: string | null;
  itemName: string | null;
  tracks: SubtitleTrack[];
  serverType: string;
}

export interface MediaServerPlaybackPayload {
  sessionId: string | null;
  itemName: string | null;
  positionMs: number | null;
  runTimeMs: number | null;
  playbackRate: number;
  isPaused: boolean;
  serverType: string;
}

export type TranscriptionStatus = "idle" | "running" | "success" | "error";

export interface TranscriptionState {
  status: TranscriptionStatus;
  message: string | null;
  configName: string | null;
  lastFinishedAt: number | null;
}
