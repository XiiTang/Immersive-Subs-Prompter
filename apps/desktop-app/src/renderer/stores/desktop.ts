import { defineStore } from "pinia";
import type {
  AppSettings,
  DesktopState,
  PlaybackState,
  ProfileDefinition,
  ProfileSettings,
  SubtitleTrack,
  TranscriptionState
} from "../../main/types";
import type { PluginCatalogRow } from "../../main/plugins/pluginTypes";
import type { TranscriptBlock } from "../components/subtitle/transcript/types";
import { createTranscriptBlocksCache } from "./desktop/transcriptBlocksCache";
import { DEFAULT_PANEL_OPACITY, DEFAULT_PROFILE_TEMPLATE } from "./desktop/defaults";
import type { RendererApi } from "../../preload.cts";
import { settingsActions } from "./desktop/actions/settingsActions";
import { profileActions } from "./desktop/actions/profileActions";
import { mediaServerActions } from "./desktop/actions/mediaServerActions";
import { ruleActions } from "./desktop/actions/ruleActions";
import { pluginActions } from "./desktop/actions/pluginActions";
import { cacheActions } from "./desktop/actions/cacheActions";
import { gameBlacklistActions } from "./desktop/actions/gameBlacklistActions";
import { playbackActions } from "./desktop/actions/playbackActions";
import { initActions } from "./desktop/actions/initActions";
import { JELLYFINEMBY_PLUGIN_ID } from "../../common/pluginIds.js";

export { DEFAULT_PROFILE_TEMPLATE } from "./desktop/defaults";

type CacheStats = Awaited<ReturnType<RendererApi["getCacheStats"]>>;

const transcriptBlocksCache = createTranscriptBlocksCache();

export const useDesktopStore = defineStore("desktop", {
  state: () => ({
    desktopState: null as DesktopState | null,
    settings: null as AppSettings | null,
    playback: null as PlaybackState | null,
    isInitializing: false,
    initError: null as string | null,
    editingProfileId: null as string | null,
    cacheStats: null as CacheStats | null,
    pluginCatalog: [] as PluginCatalogRow[]
  }),
  getters: {
    subtitleTracks(state): SubtitleTrack[] {
      return state.desktopState?.subtitleTracks ?? [];
    },
    transcriptBlocks(state): TranscriptBlock[] {
      const primary = state.desktopState?.primarySubtitles?.cues ?? [];
      const secondary = state.desktopState?.secondarySubtitles?.cues ?? [];
      return transcriptBlocksCache.get(primary, secondary);
    },
    connectionLabel(state): string {
      if (!state.desktopState) {
        return "Connecting...";
      }
      const browser = state.desktopState.connectionCount;
      const jellyfinembyEnabled = state.pluginCatalog.some(
        (plugin) => plugin.id === JELLYFINEMBY_PLUGIN_ID && plugin.enabled
      );
      if (jellyfinembyEnabled) {
        const pluginConfig = state.settings?.plugins[JELLYFINEMBY_PLUGIN_ID]?.config as
          | { servers?: Array<{ enabled?: boolean }> }
          | undefined;
        const enabledServers = pluginConfig?.servers?.filter((server) => server.enabled).length ?? 0;
        return `Extension: ${browser} · Media Server: ${enabledServers}`;
      }
      return `Extension: ${browser}`;
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
    transcriptionState(state): TranscriptionState | null {
      return state.desktopState?.transcription ?? null;
    }
  },
  actions: {
    ...initActions,
    ...settingsActions,
    ...profileActions,
    ...mediaServerActions,
    ...ruleActions,
    ...pluginActions,
    ...cacheActions,
    ...gameBlacklistActions,
    ...playbackActions
  }
});
