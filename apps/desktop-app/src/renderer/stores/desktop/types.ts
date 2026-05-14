import type {
  AppSettings,
  DesktopState,
  GlobalSettings,
  JellyfinembyPluginConfig,
  JellyfinembyServerConfig,
  NetworkSettings,
  PlaybackState,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleCacheSettings,
  SubtitleTrack,
  PluginSettingsRecord,
  TranscriptionState,
  VideoControlCommand
} from "../../../main/types";
import type { PluginCatalogRow } from "../../../main/plugins/pluginTypes";
import type { TranscriptBlock } from "../../components/subtitle/transcript/types";
import type { CacheStats, DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG } from "./defaults";
import type { WordLookupPluginConfig } from "../../plugins/wordLookupTypes";

export interface DesktopStoreState {
  desktopState: DesktopState | null;
  settings: AppSettings | null;
  playback: PlaybackState | null;
  isInitializing: boolean;
  initError: string | null;
  editingProfileId: string | null;
  cacheStats: CacheStats | null;
  pluginCatalog: PluginCatalogRow[];
}

export interface DesktopStoreGetters {
  subtitleTracks: SubtitleTrack[];
  transcriptBlocks: TranscriptBlock[];
  connectionLabel: string;
  activeProfileId: string | null;
  activeProfile: ProfileDefinition | null;
  editingProfile: ProfileDefinition | null;
  editingProfileSettings: ProfileSettings;
  panelOpacity: number;
  transcriptionState: TranscriptionState | null;
}

export interface DesktopStoreActions {
  // init
  initialize(): Promise<void>;
  attachIpcListeners(): void;

  // settings
  applySettingsPatch(partial: Partial<AppSettings>): void;
  updateSettings(partial: Partial<AppSettings>): Promise<void>;
  updateGlobalSetting<Key extends keyof GlobalSettings>(key: Key, value: GlobalSettings[Key]): void;
  updateNetworkSetting<Key extends keyof NetworkSettings>(key: Key, value: NetworkSettings[Key]): void;

  // profile
  setEditingProfile(profileId: string): void;
  updateProfileSetting<Key extends keyof ProfileSettings>(key: Key, value: ProfileSettings[Key]): void;
  updateProfileMeta(partial: Partial<ProfileDefinition>): void;
  addProfile(): void;
  duplicateProfile(): void;
  deleteProfile(profileId: string): void;
  setDefaultProfile(profileId: string): void;
  addPriority(role: "primary" | "secondary", value: string): void;
  removePriority(role: "primary" | "secondary", value: string): void;
  reorderPriority(role: "primary" | "secondary", fromIndex: number, toIndex: number): void;

  // media server
  addMediaServerConfig(): string | null;
  updateMediaServerConfig(configId: string, patch: Partial<JellyfinembyServerConfig>): void;
  deleteMediaServerConfig(configId: string): void;

  // rules
  addRule(payload: Omit<ProfileRule, "id">): void;
  updateRule(ruleId: string, patch: Partial<ProfileRule>): void;
  deleteRule(ruleId: string): void;
  moveRule(ruleId: string, direction: "up" | "down"): void;

  // plugins
  refreshPluginCatalog(): Promise<void>;
  enablePlugin(pluginId: string): Promise<void>;
  disablePlugin(pluginId: string): Promise<void>;
  setPluginConfig(pluginId: string, config: PluginSettingsRecord["config"]): void;
  isPluginEnabled(pluginId: string): boolean;
  getTranscriptionPluginConfig(): typeof DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG;
  getWordLookupPluginConfig(): WordLookupPluginConfig;
  getJellyfinembyPluginConfig(): JellyfinembyPluginConfig;

  // cache
  refreshCacheStats(): Promise<CacheStats>;
  clearCache(): Promise<unknown>;
  cleanupCache(): Promise<unknown>;
  openCacheFolder(): Promise<unknown>;
  updateCacheSetting<Key extends keyof SubtitleCacheSettings>(key: Key, value: SubtitleCacheSettings[Key]): void;

  // game blacklist
  addGameProcess(processName: string): void;
  removeGameProcess(processName: string): void;

  // playback
  selectSubtitleTrack(trackId: string | null, role?: "primary" | "secondary"): Promise<void>;
  controlVideo(command: VideoControlCommand): Promise<void>;
  toggleFullscreen(): Promise<void>;
  startTranscription(): Promise<void>;
}

export type DesktopStoreThis = DesktopStoreState & DesktopStoreGetters & DesktopStoreActions;
