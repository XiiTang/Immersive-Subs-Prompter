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
import { ruleActions } from "./desktop/actions/ruleActions";
import { pluginActions } from "./desktop/actions/pluginActions";
import { cacheActions } from "./desktop/actions/cacheActions";
import { gameBlacklistActions } from "./desktop/actions/gameBlacklistActions";
import { playbackActions } from "./desktop/actions/playbackActions";
import { initActions } from "./desktop/actions/initActions";
import { releaseActions } from "./desktop/actions/releaseActions";
import type { ReleaseState } from "../../main/releases/releaseManifest";

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
    pluginCatalog: [] as PluginCatalogRow[],
    releaseState: null as ReleaseState | null
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
    activeProfileId(state): string | null {
      return state.desktopState?.appliedProfileId ?? state.settings?.defaultProfileId ?? null;
    },
    activeProfile(state): ProfileDefinition | null {
      if (!state.settings) {
        return null;
      }
      const targetId = state.desktopState?.appliedProfileId ?? state.settings.defaultProfileId;
      return state.settings.profiles.find((profile) => profile.id === targetId) ?? getDefaultProfile(state.settings);
    },
    editingProfile(state): ProfileDefinition | null {
      if (!state.settings) {
        return null;
      }
      const requestedId = state.editingProfileId ?? state.settings.defaultProfileId;
      return state.settings.profiles.find((profile) => profile.id === requestedId) ?? getDefaultProfile(state.settings);
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
    ...ruleActions,
    ...pluginActions,
    ...cacheActions,
    ...gameBlacklistActions,
    ...playbackActions,
    ...releaseActions
  }
});

function getDefaultProfile(settings: AppSettings): ProfileDefinition | null {
  return settings.profiles.find((profile) => profile.id === settings.defaultProfileId) ?? null;
}
