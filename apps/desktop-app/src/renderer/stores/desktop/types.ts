import type {
  AppSettings,
  DesktopState,
  GlobalSettings,
  NetworkSettings,
  PlaybackState,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleCacheSettings,
  SubtitleTrack,
  FeatureSettings,
  TranscriptionState,
  VideoControlCommand
} from "../../../main/types";
import type { FeatureId } from "../../../common/featureDefaults";
import type { TranscriptBlock } from "../../components/subtitle/transcript/types";
import type { RendererApi } from "../../../preload.cts";
import type { ReleaseState } from "../../../main/releases/releaseManifest";

type CacheStats = Awaited<ReturnType<RendererApi["getCacheStats"]>>;
type ConfigurableFeatureId = Exclude<FeatureId, "transcription">;

interface DesktopStoreState {
  desktopState: DesktopState | null;
  settings: AppSettings | null;
  playback: PlaybackState | null;
  isInitializing: boolean;
  initError: string | null;
  editingProfileId: string | null;
  cacheStats: CacheStats | null;
  releaseState: ReleaseState | null;
}

interface DesktopStoreGetters {
  subtitleTracks: SubtitleTrack[];
  transcriptBlocks: TranscriptBlock[];
  activeProfileId: string | null;
  activeProfile: ProfileDefinition | null;
  editingProfile: ProfileDefinition | null;
  editingProfileSettings: ProfileSettings;
  panelOpacity: number;
  transcriptionState: TranscriptionState | null;
}

interface DesktopStoreActions {
  // init
  initialize(): Promise<void>;
  attachIpcListeners(): void;
  refreshReleaseState(): Promise<void>;

  // settings
  updateSettings(partial: Partial<AppSettings>): Promise<void>;
  updateGlobalSetting<Key extends keyof GlobalSettings>(key: Key, value: GlobalSettings[Key]): void;
  updateNetworkSetting<Key extends keyof NetworkSettings>(key: Key, value: NetworkSettings[Key]): void;

  // profile
  setEditingProfile(profileId: string): void;
  updateProfileSetting<Key extends keyof ProfileSettings>(
    key: Key,
    value: ProfileSettings[Key]
  ): void;
  addProfile(): void;
  duplicateProfile(): void;
  deleteProfile(profileId: string): void;
  reorderProfile(fromIndex: number, toIndex: number): void;
  toggleProfileEnabled(profileId: string, enabled: boolean): void;
  addPriority(role: "primary" | "secondary", value: string): void;
  removePriority(role: "primary" | "secondary", value: string): void;
  reorderPriority(role: "primary" | "secondary", fromIndex: number, toIndex: number): void;

  // rules
  addRule(payload: Omit<ProfileRule, "id">): void;
  deleteRule(ruleId: string): void;
  reorderProfileRule(profileId: string, fromIndex: number, toIndex: number): void;

  // features
  setFeatureEnabled(featureId: FeatureId, enabled: boolean): Promise<void>;
  setFeatureConfig<FeatureKey extends ConfigurableFeatureId>(
    featureId: FeatureKey,
    config: Partial<FeatureSettings[FeatureKey]["config"]>
  ): Promise<void>;
  setActiveTranscriptionConfig(configId: string): Promise<void>;
  setTranscriptionConfigs(
    configs: FeatureSettings["transcription"]["configs"],
    activeConfigId: string
  ): Promise<void>;
  addJellyfinEmbyServer(): Promise<string | null>;
  duplicateJellyfinEmbyServer(serverId: string): Promise<string | null>;
  updateJellyfinEmbyServer(
    serverId: string,
    patch: Partial<FeatureSettings["jellyfinEmby"]["config"]["servers"][number]>
  ): Promise<void>;
  deleteJellyfinEmbyServer(serverId: string): Promise<void>;

  // cache
  refreshCacheStats(): Promise<CacheStats>;
  openCacheFolder(): Promise<unknown>;
  updateCacheSetting<Key extends keyof SubtitleCacheSettings>(key: Key, value: SubtitleCacheSettings[Key]): void;

  // release
  checkForUpdates(): Promise<void>;
  openReleaseDownload(): Promise<void>;

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
