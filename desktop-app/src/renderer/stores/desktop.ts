import { defineStore } from "pinia";
import { toRaw } from "vue";
import type {
  AppSettings,
  DesktopState,
  GlobalSettings,
  MediaServerConfig,
  MediaServerSettings,
  NetworkSettings,
  PlaybackState,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleCacheSettings,
  SubtitleCue,
  SubtitleTrack,
  TranscriptionConfig,
  TranscriptionState,
  VideoControlCommand
} from "../main/types.js";
import {
  DEFAULT_AUTO_HIDE_ZONE_HEIGHT
} from "../../common/autoHide.js";

export type CombinedCue = {
  start: number;
  end: number;
  primaryText: string;
  secondaryText: string | null;
};

export const DEFAULT_PROFILE_TEMPLATE: ProfileSettings = {
  subtitleFontFamily: "",
  subtitleFontSize: 14,
  subtitleLineSpacing: 0,
  subtitleTimeTextGap: 2,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: "#f5f5f5",
  subtitleSecondaryColor: "#c7d2fe",
  subtitleActivePrimaryColor: "#fff8dc",
  subtitleActiveSecondaryColor: "#fff9c4",
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};

const DEFAULT_PANEL_OPACITY = 100;
type CacheStats = {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
};

const DEFAULT_TRANSCRIPTION_CONFIG: Omit<TranscriptionConfig, "id"> = {
  name: "Whisper API",
  provider: "whisper-api",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "whisper-1",
  language: "",
  prompt: "",
  enableWordTimestamps: false,
  extraParams: {},
  ytDlpArgs:
    '--extract-audio --audio-format wav --audio-quality 32K --postprocessor-args "-ac 1 -ar 16000" --cookies-from-browser firefox',
  fasterWhisperBinary: "faster-whisper",
  fasterWhisperModel: "base",
  fasterWhisperModelDir: "",
  fasterWhisperDevice: "cpu",
  fasterWhisperVadFilter: true,
  fasterWhisperVadThreshold: 0.5,
  fasterWhisperVadMethod: "",
  fasterWhisperUseKim2: false
};

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${(crypto as Crypto).randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function mergePartial<T>(target: T | null, patch: Partial<T>): T {
  const base: any = Array.isArray(target) ? [...(target as any)] : { ...(target as any) };
  for (const [key, value] of Object.entries(patch)) {
    const current = (target as any)?.[key];
    if (Array.isArray(value)) {
      base[key] = [...value];
    } else if (value && typeof value === "object") {
      base[key] = mergePartial(current ?? (Array.isArray(value) ? [] : {}), value as any);
    } else if (value !== undefined) {
      base[key] = value;
    }
  }
  return base as T;
}

function mergeSubtitleCues(primary: SubtitleCue[], secondary: SubtitleCue[]): CombinedCue[] {
  if (!primary.length) {
    return [];
  }

  if (!secondary.length) {
    return primary.map((cue) => ({
      start: cue.start,
      end: cue.end,
      primaryText: cue.text,
      secondaryText: null
    }));
  }

  const merged: CombinedCue[] = [];
  let secondaryIndex = 0;

  for (const primaryCue of primary) {
    while (secondaryIndex < secondary.length && secondary[secondaryIndex].end < primaryCue.start) {
      secondaryIndex += 1;
    }

    let bestMatch: SubtitleCue | null = null;
    let bestOverlap = -1;

    for (let i = secondaryIndex; i < secondary.length; i += 1) {
      const candidate = secondary[i];
      if (candidate.start > primaryCue.end) {
        break;
      }
      const overlap = Math.min(primaryCue.end, candidate.end) - Math.max(primaryCue.start, candidate.start);
      if (overlap >= 0 && overlap >= bestOverlap) {
        bestOverlap = overlap;
        bestMatch = candidate;
      }
    }

    merged.push({
      start: primaryCue.start,
      end: primaryCue.end,
      primaryText: primaryCue.text,
      secondaryText: bestMatch ? bestMatch.text : null
    });
  }

  return merged;
}

function toPlain<T>(value: T): T {
  const rawValue = toRaw(value) as unknown as T;
  if (rawValue === null || typeof rawValue !== "object") {
    return rawValue;
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => toPlain(entry)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(rawValue as Record<string, unknown>)) {
    result[key] = toPlain(entry);
  }
  return result as T;
}

export const useDesktopStore = defineStore("desktop", {
  state: () => ({
    desktopState: null as DesktopState | null,
    settings: null as AppSettings | null,
    playback: null as PlaybackState | null,
    isInitializing: false,
    initError: null as string | null,
    isSettingsOpen: false,
    editingProfileId: null as string | null,
    cacheStats: null as CacheStats | null
  }),
  getters: {
    subtitleTracks(state): SubtitleTrack[] {
      return state.desktopState?.subtitleTracks ?? [];
    },
    combinedCues(state): CombinedCue[] {
      const primary = state.desktopState?.primarySubtitles?.cues ?? [];
      const secondary = state.desktopState?.secondarySubtitles?.cues ?? [];
      return mergeSubtitleCues(primary, secondary);
    },
    connectionLabel(state): string {
      if (!state.desktopState) {
        return "Connecting...";
      }
      const browser = state.desktopState.connectionCount;
      const mediaServer = state.desktopState.mediaServer.sessions.length;
      return `Extension: ${browser} · Media Server: ${mediaServer}`;
    },
    activeProfileId(state): string | null {
      return state.desktopState?.appliedProfileId ?? state.settings?.defaultProfileId ?? null;
    },
    activeProfile(state): ProfileDefinition | null {
      if (!state.settings) {
        return null;
      }
      const targetId = state.desktopState?.appliedProfileId ?? state.settings.defaultProfileId;
      return state.settings.profiles.find((profile) => profile.id === targetId) ?? state.settings.profiles[0] ?? null;
    },
    editingProfile(state): ProfileDefinition | null {
      if (!state.settings || state.settings.profiles.length === 0) {
        return null;
      }
      const requestedId = state.editingProfileId ?? state.settings.defaultProfileId;
      return state.settings.profiles.find((profile) => profile.id === requestedId) ?? state.settings.profiles[0];
    },
    editingProfileSettings(): ProfileSettings {
      return this.editingProfile?.settings ?? DEFAULT_PROFILE_TEMPLATE;
    },
    panelOpacity(state): number {
      return state.settings?.global.panelOpacity ?? DEFAULT_PANEL_OPACITY;
    },
    autoHideZoneHeight(state): number {
      return state.settings?.global.autoHideActiveZoneHeight ?? DEFAULT_AUTO_HIDE_ZONE_HEIGHT;
    },
    transcriptionState(state): TranscriptionState | null {
      return state.desktopState?.transcription ?? null;
    },
    activeTranscriptionConfig(state): TranscriptionConfig | null {
      const transcription = state.settings?.transcription;
      if (!transcription) {
        return null;
      }
      return (
        transcription.configs.find((config) => config.id === transcription.activeConfigId) ??
        transcription.configs[0] ??
        null
      );
    }
  },
  actions: {
    async initialize() {
      this.isInitializing = true;
      this.initError = null;
      try {
        const [state, settings] = await Promise.all([window.usp.getInitialState(), window.usp.getSettings()]);
        this.desktopState = state;
        this.playback = state.playback;
        this.settings = settings;
        this.editingProfileId = settings.defaultProfileId;
        this.attachIpcListeners();
        await this.refreshCacheStats();
      } catch (error) {
        this.initError = error instanceof Error ? error.message : String(error);
      } finally {
        this.isInitializing = false;
      }
    },
    attachIpcListeners() {
      window.usp.onStateChange((nextState) => {
        this.desktopState = nextState;
        this.playback = nextState.playback;
      });
      window.usp.onPlayback((payload) => {
        this.playback = payload;
        if (this.desktopState) {
          this.desktopState = { ...this.desktopState, playback: payload };
        }
      });
      window.usp.onSettingsChange((settings) => {
        this.settings = settings;
        if (!this.editingProfileId && settings.profiles.length) {
          this.editingProfileId = settings.defaultProfileId ?? settings.profiles[0].id;
        }
        this.refreshCacheStats();
      });
      window.usp.onLoopCleared(() => {
        if (this.playback) {
          this.playback = { ...this.playback, isLooping: false, loopCueIndex: null };
        }
      });
    },
    setSettingsOpen(next: boolean) {
      this.isSettingsOpen = next;
    },
    setEditingProfile(profileId: string) {
      if (!this.settings) {
        return;
      }
      const exists = this.settings.profiles.some((profile) => profile.id === profileId);
      this.editingProfileId = exists ? profileId : this.settings.defaultProfileId ?? this.settings.profiles[0].id;
    },
    applySettingsPatch(partial: Partial<AppSettings>) {
      if (!this.settings) {
        return;
      }
      this.settings = mergePartial(this.settings, partial);
    },
    async updateSettings(partial: Partial<AppSettings>) {
      if (!this.settings) {
        return;
      }
      const payload = toPlain(partial);
      this.applySettingsPatch(payload);
      try {
        const next = await window.usp.updateSettings(payload);
        this.settings = next;
      } catch (error) {
        console.error("[Renderer] Failed to update settings", error);
      }
    },
    updateGlobalSetting<Key extends keyof GlobalSettings>(key: Key, value: GlobalSettings[Key]) {
      if (!this.settings) {
        return;
      }
      const nextGlobal = { ...this.settings.global, [key]: value } as GlobalSettings;
      this.updateSettings({ global: nextGlobal });
    },
    updateNetworkSetting<Key extends keyof NetworkSettings>(key: Key, value: NetworkSettings[Key]) {
      if (!this.settings) {
        return;
      }
      const nextNetwork = { ...this.settings.network, [key]: value } as NetworkSettings;
      this.updateSettings({ network: nextNetwork });
    },
    updateProfileSetting<Key extends keyof ProfileSettings>(key: Key, value: ProfileSettings[Key]) {
      if (!this.settings || !this.editingProfileId) {
        return;
      }
      const nextProfiles = this.settings.profiles.map((profile) =>
        profile.id === this.editingProfileId
          ? {
            ...profile,
            settings: {
              ...profile.settings,
              [key]: value
            }
          }
          : profile
      );
      this.updateSettings({ profiles: nextProfiles });
    },
    updateProfileMeta(partial: Partial<ProfileDefinition>) {
      if (!this.settings || !this.editingProfileId) {
        return;
      }
      const nextProfiles = this.settings.profiles.map((profile) =>
        profile.id === this.editingProfileId ? { ...profile, ...partial } : profile
      );
      this.updateSettings({ profiles: nextProfiles });
    },
    addProfile() {
      if (!this.settings) {
        return;
      }
      const newProfile: ProfileDefinition = {
        id: createId("profile"),
        name: `Profile ${this.settings.profiles.length + 1}`,
        description: null,
        settings: { ...DEFAULT_PROFILE_TEMPLATE }
      };
      this.editingProfileId = newProfile.id;
      this.updateSettings({
        profiles: [...this.settings.profiles, newProfile]
      });
    },
    duplicateProfile() {
      if (!this.settings || !this.editingProfileId) {
        return;
      }
      const existing = this.settings.profiles.find((profile) => profile.id === this.editingProfileId);
      if (!existing) {
        return;
      }
      const copy: ProfileDefinition = {
        ...existing,
        id: createId("profile"),
        name: `${existing.name} Copy`,
        settings: mergePartial(existing.settings, {})
      };
      this.editingProfileId = copy.id;
      this.updateSettings({
        profiles: [...this.settings.profiles, copy]
      });
    },
    deleteProfile(profileId: string) {
      if (!this.settings) {
        return;
      }
      if (this.settings.profiles.length <= 1) {
        console.warn("[Renderer] At least one profile must remain.");
        return;
      }
      const nextProfiles = this.settings.profiles.filter((profile) => profile.id !== profileId);
      const nextDefault = this.settings.defaultProfileId === profileId ? nextProfiles[0]?.id : this.settings.defaultProfileId;
      this.editingProfileId = nextDefault ?? nextProfiles[0]?.id ?? null;
      this.updateSettings({
        profiles: nextProfiles,
        defaultProfileId: nextDefault ?? undefined
      });
    },
    setDefaultProfile(profileId: string) {
      if (!this.settings) {
        return;
      }
      this.updateSettings({ defaultProfileId: profileId });
    },
    addGameProcess(processName: string) {
      const normalized = processName.trim();
      if (!this.settings || !normalized) {
        return;
      }
      const current = this.settings.global.gameProcessBlacklist ?? [];
      if (current.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
        return;
      }
      const nextList = [...current, normalized];
      this.updateGlobalSetting("gameProcessBlacklist", nextList);
    },
    removeGameProcess(processName: string) {
      if (!this.settings) {
        return;
      }
      const nextList = (this.settings.global.gameProcessBlacklist ?? []).filter(
        (entry) => entry.toLowerCase() !== processName.toLowerCase()
      );
      this.updateGlobalSetting("gameProcessBlacklist", nextList);
    },
    addPriority(role: "primary" | "secondary", value: string) {
      const normalized = value.trim();
      if (!this.settings || !this.editingProfileId || !normalized) {
        return;
      }
      const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
      const current = this.editingProfileSettings[key] ?? [];
      if (current.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
        return;
      }
      const next = [...current, normalized];
      this.updateProfileSetting(key as keyof ProfileSettings, next as any);
    },
    removePriority(role: "primary" | "secondary", value: string) {
      if (!this.settings || !this.editingProfileId) {
        return;
      }
      const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
      const current = this.editingProfileSettings[key] ?? [];
      const next = current.filter((entry) => entry.toLowerCase() !== value.toLowerCase());
      this.updateProfileSetting(key as keyof ProfileSettings, next as any);
    },
    reorderPriority(role: "primary" | "secondary", fromIndex: number, toIndex: number) {
      if (!this.settings || !this.editingProfileId) {
        return;
      }
      const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
      const list = [...(this.editingProfileSettings[key] ?? [])];
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= list.length ||
        toIndex >= list.length
      ) {
        return;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      this.updateProfileSetting(key as keyof ProfileSettings, list as any);
    },
    async selectSubtitleTrack(trackId: string | null, role: "primary" | "secondary" = "primary") {
      await window.usp.selectSubtitleTrack(trackId, role);
      if (!this.desktopState) {
        return;
      }
      const nextState =
        role === "primary"
          ? { ...this.desktopState, selectedPrimarySubtitleId: trackId }
          : { ...this.desktopState, selectedSecondarySubtitleId: trackId };
      this.desktopState = nextState;
    },
    async controlVideo(command: VideoControlCommand) {
      try {
        await window.usp.controlVideo(command);
      } catch (error) {
        console.error("[Renderer] Failed to send control command", error);
      }
    },
    async toggleFullscreen() {
      try {
        await window.usp.toggleDisplayFullscreen();
      } catch (error) {
        console.error("[Renderer] Failed to toggle fullscreen", error);
      }
    },
    addMediaServerConfig(): string | null {
      if (!this.settings) {
        return null;
      }
      const newConfig: MediaServerConfig = {
        id: createId("mediaserver"),
        name: `Server ${this.settings.mediaServer.configs.length + 1}`,
        type: "jellyfinemby",
        serverUrl: "",
        apiKey: "",
        webSocketPath: "",
        enabled: true
      };
      const nextConfigs = [...this.settings.mediaServer.configs, newConfig];
      this.updateSettings({
        mediaServer: {
          ...this.settings.mediaServer,
          configs: nextConfigs
        }
      });
      return newConfig.id;
    },
    updateMediaServerConfig(configId: string, patch: Partial<MediaServerConfig>) {
      if (!this.settings) {
        return;
      }
      const nextConfigs = this.settings.mediaServer.configs.map((config) =>
        config.id === configId ? mergePartial(config, patch) : config
      );
      this.updateSettings({
        mediaServer: {
          ...this.settings.mediaServer,
          configs: nextConfigs
        }
      });
    },
    deleteMediaServerConfig(configId: string) {
      if (!this.settings) {
        return;
      }
      const configs = this.settings.mediaServer.configs;
      if (configs.length <= 1 && this.settings.mediaServer.enabled) {
        console.warn("[Renderer] Cannot delete the last media server configuration while MediaServer is enabled.");
        return;
      }
      const nextConfigs = configs.filter((config) => config.id !== configId);
      this.updateSettings({
        mediaServer: {
          ...this.settings.mediaServer,
          configs: nextConfigs
        }
      });
    },
    setMediaServerEnabled(enabled: boolean) {
      if (!this.settings) {
        return;
      }
      this.updateSettings({
        mediaServer: {
          ...this.settings.mediaServer,
          enabled
        }
      });
    },
    updateCacheSetting<Key extends keyof SubtitleCacheSettings>(key: Key, value: SubtitleCacheSettings[Key]) {
      if (!this.settings) {
        return;
      }
      const nextCache = { ...this.settings.cache, [key]: value } as SubtitleCacheSettings;
      this.updateSettings({ cache: nextCache });
    },
    setActiveTranscriptionConfig(configId: string) {
      if (!this.settings) {
        return;
      }
      const configs = this.settings.transcription.configs;
      const exists = configs.some((config) => config.id === configId);
      const nextActive = exists ? configId : configs[0]?.id ?? null;
      this.updateSettings({
        transcription: {
          ...this.settings.transcription,
          activeConfigId: nextActive
        }
      });
    },
    addTranscriptionConfig() {
      if (!this.settings) {
        return null;
      }
      const id = createId("transcription");
      const newConfig: TranscriptionConfig = {
        ...DEFAULT_TRANSCRIPTION_CONFIG,
        id
      };
      const configs = [...this.settings.transcription.configs, newConfig];
      this.updateSettings({
        transcription: {
          ...this.settings.transcription,
          configs,
          activeConfigId: this.settings.transcription.activeConfigId ?? id
        }
      });
      return id;
    },
    updateTranscriptionConfig(configId: string, patch: Partial<TranscriptionConfig>) {
      if (!this.settings) {
        return;
      }
      const configs = this.settings.transcription.configs.map((config) =>
        config.id === configId ? mergePartial(config, patch) : config
      );
      this.updateSettings({
        transcription: {
          ...this.settings.transcription,
          configs
        }
      });
    },
    deleteTranscriptionConfig(configId: string) {
      if (!this.settings) {
        return;
      }
      let configs = this.settings.transcription.configs.filter((config) => config.id !== configId);
      if (!configs.length) {
        const id = createId("transcription");
        configs = [
          {
            ...DEFAULT_TRANSCRIPTION_CONFIG,
            id
          }
        ];
      }
      const activeConfigId =
        this.settings.transcription.activeConfigId === configId
          ? configs[0]?.id ?? null
          : this.settings.transcription.activeConfigId;
      this.updateSettings({
        transcription: {
          ...this.settings.transcription,
          configs,
          activeConfigId
        }
      });
    },
    async startTranscription() {
      try {
        const result = await window.usp.startTranscription();
        if (!result?.ok && result?.error) {
          console.error("[Renderer] Transcription failed:", result.error);
        }
      } catch (error) {
        console.error("[Renderer] Transcription IPC failed", error);
      }
    },
    addRule(payload: Omit<ProfileRule, "id">) {
      if (!this.settings) {
        return;
      }
      const rule: ProfileRule = { ...payload, id: createId("rule") };
      this.updateSettings({
        rules: [...this.settings.rules, rule]
      });
    },
    updateRule(ruleId: string, patch: Partial<ProfileRule>) {
      if (!this.settings) {
        return;
      }
      const nextRules = this.settings.rules.map((rule) =>
        rule.id === ruleId ? mergePartial(rule, patch) : rule
      );
      this.updateSettings({ rules: nextRules });
    },
    deleteRule(ruleId: string) {
      if (!this.settings) {
        return;
      }
      const nextRules = this.settings.rules.filter((rule) => rule.id !== ruleId);
      this.updateSettings({ rules: nextRules });
    },
    moveRule(ruleId: string, direction: "up" | "down") {
      if (!this.settings) {
        return;
      }
      const rules = [...this.settings.rules];
      const index = rules.findIndex((rule) => rule.id === ruleId);
      if (index === -1) {
        return;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rules.length) {
        return;
      }
      [rules[index], rules[targetIndex]] = [rules[targetIndex], rules[index]];
      this.updateSettings({ rules });
    },
    async refreshCacheStats() {
      const stats = await window.usp.getCacheStats();
      this.cacheStats = stats;
      return stats;
    },
    async clearCache() {
      const result = await window.usp.clearCache();
      await this.refreshCacheStats();
      return result;
    },
    async cleanupCache() {
      const result = await window.usp.cleanupCache();
      await this.refreshCacheStats();
      return result;
    },
    async openCacheFolder() {
      return window.usp.openCacheFolder();
    }
  }
});
