import { AppEventBus } from "./appEventBus.js";
import { createLogger } from "./logger.js";
import {
  AppSettings,
  DesktopState,
  MediaServerSessionSummary,
  PlaybackState,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleSource,
  SubtitleTrack,
  TranscriptionState,
  TranscriptionStatus
} from "./types.js";

const clone = <T>(value: T): T => {
  if (typeof (globalThis as any).structuredClone === "function") {
    return (globalThis as any).structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

type Status = DesktopState["status"];

const STATUS_TRANSITIONS: Record<Status, Status[]> = {
  idle: ["awaiting-video", "loading-subtitles", "idle", "error"],
  "awaiting-video": ["loading-subtitles", "error", "idle", "awaiting-video"],
  "loading-subtitles": ["ready", "error", "awaiting-video", "idle", "loading-subtitles"],
  ready: ["loading-subtitles", "error", "awaiting-video", "idle", "ready"],
  error: ["awaiting-video", "loading-subtitles", "idle", "error", "ready"]
};

function createInitialState(settings: AppSettings): {
  state: DesktopState;
  activeProfileId: string | null;
} {
  const initialProfile =
    settings.profiles.find((profile) => profile.id === settings.defaultProfileId) ??
    settings.profiles[0] ??
    null;
  const profileId = initialProfile?.id ?? null;

  return {
    activeProfileId: profileId,
    state: {
      connectionCount: 0,
      activeTabId: null,
      pageUrl: null,
      videoUrl: null,
      title: null,
      site: null,
      activeSource: null,
      status: "idle",
      error: null,
      playback: {
        currentTime: 0,
        playbackRate: 1,
        lastUpdate: null,
        isLooping: false,
        loopCueIndex: null
      },
      subtitleTracks: [],
      selectedPrimarySubtitleId: null,
      selectedSecondarySubtitleId: null,
      primarySubtitles: null,
      secondarySubtitles: null,
      appliedProfileId: profileId,
      appliedProfileName: initialProfile?.name ?? null,
      appliedRuleId: null,
      appliedRuleName: null,
      appliedRulePattern: null,
      appliedRuleMatchType: null,
      pendingMediaServerItemId: null,
      mediaServer: {
        connected: false,
        sessions: [],
        selectedSessionId: null,
        lastUpdated: null
      },
      isFullscreen: false,
      transcription: createDefaultTranscriptionState()
    }
  };
}

function normalizePriorityEntries(entries: string[]): string[] {
  return entries.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
}

function matchesRule(url: string, rule: ProfileRule): boolean {
  if (!rule.isEnabled) {
    return false;
  }
  const source = url ?? "";
  switch (rule.matchType) {
    case "exact":
      return source.toLowerCase() === rule.pattern.toLowerCase();
    case "regex":
      try {
        const regex = new RegExp(rule.pattern);
        return regex.test(source);
      } catch {
        return false;
      }
    case "contains":
    default:
      return source.toLowerCase().includes(rule.pattern.toLowerCase());
  }
}

function createDefaultTranscriptionState(): TranscriptionState {
  return {
    status: "idle",
    message: null,
    configName: null,
    lastFinishedAt: null
  };
}

export class StateManager {
  private state: DesktopState;
  private activeProfileId: string | null;
  private readonly log = createLogger("state");

  constructor(private readonly bus: AppEventBus, private readonly getSettings: () => AppSettings) {
    const initial = createInitialState(getSettings());
    this.state = initial.state;
    this.activeProfileId = initial.activeProfileId;
  }

  getState(): DesktopState {
    return this.state;
  }

  updateState(mutator: (draft: DesktopState) => void, options?: { emitState?: boolean }): DesktopState {
    const next = clone(this.state);
    mutator(next);
    return this.commit(next, options);
  }

  /**
   * Emit the current state without any modifications.
   * Use this when you need to push the latest state to subscribers.
   */
  emitCurrentState(): void {
    this.bus.emit("state:changed", this.state);
  }

  setStatus(status: Status) {
    return this.updateState((draft) => {
      draft.status = status;
    });
  }

  setActiveSource(activeSource: SubtitleSource | null) {
    return this.updateState((draft) => {
      draft.activeSource = activeSource;
    });
  }

  setActiveTab(tabId: number | null) {
    return this.updateState((draft) => {
      draft.activeTabId = tabId;
    });
  }

  setPageContext(tabId: number, payload: { pageUrl?: string | null; site?: string | null; title?: string | null }) {
    return this.updateState((draft) => {
      draft.activeTabId = tabId;
      draft.pageUrl = payload.pageUrl ?? null;
      draft.site = payload.site ?? null;
      draft.title = payload.title ?? null;
    });
  }

  changeConnectionCount(delta: number) {
    return this.updateState((draft) => {
      draft.connectionCount = Math.max(0, draft.connectionCount + delta);
      if (draft.connectionCount === 0 && draft.activeSource !== "mediaserver") {
        draft.status = "idle";
        draft.activeTabId = null;
        this.resetSubtitleStateInternal(draft);
        this.applyProfileSelectionInternal(getDefaultProfile(this.getSettings()), null, draft);
      } else if (draft.connectionCount > 0 && draft.status === "idle" && draft.activeSource !== "mediaserver") {
        draft.status = "awaiting-video";
      }
    });
  }

  setFullscreen(isFullscreen: boolean) {
    return this.updateState((draft) => {
      draft.isFullscreen = isFullscreen;
    });
  }

  updatePlayback(updates: Partial<PlaybackState>) {
    const next = clone(this.state);
    next.playback = {
      ...next.playback,
      ...updates,
      lastUpdate: Date.now()
    };
    this.state = next;
    this.bus.emit("state:playback", next.playback);
    return next;
  }

  setTranscriptionStatus(
    status: TranscriptionStatus,
    message: string | null = null,
    configName: string | null = null
  ) {
    return this.updateState((draft) => {
      draft.transcription.status = status;
      draft.transcription.message = message;
      draft.transcription.configName = configName;
      if (status === "success" || status === "error") {
        draft.transcription.lastFinishedAt = Date.now();
      }
    });
  }

  setSubtitleTrack(trackId: string | null, role: "primary" | "secondary" = "primary") {
    return this.updateState((draft) => {
      const track = trackId ? draft.subtitleTracks.find((t) => t.id === trackId) || null : null;
      if (role === "primary") {
        draft.selectedPrimarySubtitleId = track ? track.id : null;
        draft.primarySubtitles = track;
      } else {
        draft.selectedSecondarySubtitleId = track ? track.id : null;
        draft.secondarySubtitles = track;
      }
    });
  }

  addOrReplaceSubtitleTrack(track: SubtitleTrack, selectAsPrimary = false) {
    return this.updateState((draft) => {
      const remaining = draft.subtitleTracks.filter((t) => t.id !== track.id);
      draft.subtitleTracks = [track, ...remaining];
      if (selectAsPrimary) {
        draft.selectedPrimarySubtitleId = track.id;
        draft.primarySubtitles = track;
      }
    });
  }

  applyPreferredTracksFromSettings(
    tracks: SubtitleTrack[],
    profileSettings: ProfileSettings = this.getActiveProfileSettings()
  ) {
    return this.updateState((draft) => {
      if (!tracks.length) {
        this.resetSubtitleStateInternal(draft);
        return;
      }

      const primary = this.pickTrackByPriority(tracks, profileSettings.primarySubtitlePriority);

      draft.primarySubtitles = primary ?? null;
      draft.selectedPrimarySubtitleId = primary?.id ?? null;

      const exclude = new Set<string>();
      if (primary) {
        exclude.add(primary.id);
      }

      const secondary = this.pickTrackByPriority(tracks, profileSettings.secondarySubtitlePriority, exclude);
      draft.secondarySubtitles = secondary ?? null;
      draft.selectedSecondarySubtitleId = secondary?.id ?? null;
    });
  }

  setSubtitleTracks(tracks: SubtitleTrack[]) {
    return this.updateState((draft) => {
      draft.subtitleTracks = tracks;
    });
  }

  resetSubtitleState(clearError = false) {
    const result = this.updateState((draft) => this.resetSubtitleStateInternal(draft, clearError));
    // Emit playback state change separately to ensure renderer stops prediction loop
    this.bus.emit("state:playback", this.state.playback);
    return result;
  }

  getActiveProfileSettings(): ProfileSettings {
    const settings = this.getSettings();
    return getProfileSettingsFrom(settings, this.activeProfileId ?? settings.defaultProfileId);
  }

  applyProfileSelection(profile: ProfileDefinition, rule: ProfileRule | null): boolean {
    let changed = false;
    this.updateState((draft) => {
      changed = this.applyProfileSelectionInternal(profile, rule, draft);
    });
    return changed;
  }

  selectProfileForUrl(url: string | null): { profile: ProfileDefinition; rule: ProfileRule | null } {
    const settings = this.getSettings();
    if (url) {
      for (const rule of settings.rules) {
        if (!rule.isEnabled) {
          continue;
        }
        if (matchesRule(url, rule)) {
          const profile = getProfileById(settings, rule.profileId) ?? getDefaultProfile(settings);
          return { profile, rule };
        }
      }
    }
    return { profile: getDefaultProfile(settings), rule: null };
  }

  reapplyActiveProfileForCurrentVideo(): boolean {
    const selection = this.selectProfileForUrl(this.state.videoUrl);
    return this.applyProfileSelection(selection.profile, selection.rule);
  }

  handleSettingsUpdated(previous: AppSettings, next: AppSettings) {
    const previousProfileSettings = getProfileSettingsFrom(previous, this.activeProfileId);
    const hadTracks = this.state.subtitleTracks.length > 0;

    const activeProfileChanged = this.reapplyActiveProfileForCurrentVideo();
    const nextProfileSettings = this.getActiveProfileSettings();
    const primaryPriorityChanged = !areStringArraysEqual(
      previousProfileSettings.primarySubtitlePriority,
      nextProfileSettings.primarySubtitlePriority
    );
    const secondaryPriorityChanged = !areStringArraysEqual(
      previousProfileSettings.secondarySubtitlePriority,
      nextProfileSettings.secondarySubtitlePriority
    );

    if (hadTracks && (primaryPriorityChanged || secondaryPriorityChanged || activeProfileChanged)) {
      this.applyPreferredTracksFromSettings(this.state.subtitleTracks, nextProfileSettings);
    }
  }

  setMediaServerSessions(sessions: MediaServerSessionSummary[]) {
    return this.updateState((draft) => {
      draft.mediaServer.sessions = sessions;
      draft.mediaServer.lastUpdated = Date.now();
    });
  }

  setMediaServerSelectedSession(sessionId: string | null) {
    return this.updateState((draft) => {
      draft.mediaServer.selectedSessionId = sessionId;
    });
  }

  setPendingMediaServerItemId(itemId: string | null) {
    return this.updateState((draft) => {
      draft.pendingMediaServerItemId = itemId;
    });
  }

  private commit(next: DesktopState, options?: { emitState?: boolean }): DesktopState {
    const emitState = options?.emitState ?? true;
    const previous = this.state;
    next.status = this.enforceStatusTransition(previous.status, next.status);
    next.activeSource = this.normalizeActiveSource(next.activeSource, previous.activeSource);
    this.state = next;

    if (previous.connectionCount !== next.connectionCount) {
      this.bus.emit("state:connection-count", { count: next.connectionCount });
    }

    if (emitState) {
      this.bus.emit("state:changed", this.state);
    }
    return this.state;
  }

  private enforceStatusTransition(current: Status, next: Status): Status {
    if (current === next) {
      return next;
    }
    const allowed = STATUS_TRANSITIONS[current] ?? [];
    if (allowed.includes(next)) {
      return next;
    }
    this.log.warn(`Illegal status transition ${current} -> ${next}, keeping ${current}`);
    return current;
  }

  private normalizeActiveSource(
    next: SubtitleSource | null,
    fallback: SubtitleSource | null
  ): SubtitleSource | null {
    if (next === null || next === "extension" || next === "mediaserver") {
      return next;
    }
    this.log.warn(`Invalid activeSource "${next}", reverting to previous`);
    return fallback;
  }

  private pickTrackByPriority(
    tracks: SubtitleTrack[],
    priorities: string[],
    excludeIds: Set<string> = new Set()
  ): SubtitleTrack | null {
    if (!tracks.length) {
      return null;
    }
    const normalized = normalizePriorityEntries(priorities);
    const candidates = tracks.filter((track) => !excludeIds.has(track.id));
    if (normalized.length) {
      for (const priority of normalized) {
        const matched = candidates.find((track) =>
          track.sourceFile.toLowerCase().includes(priority)
        );
        if (matched) {
          return matched;
        }
      }
    }
    return candidates[0] ?? null;
  }

  private resetSubtitleStateInternal(draft: DesktopState, clearError = false) {
    draft.subtitleTracks = [];
    draft.selectedPrimarySubtitleId = null;
    draft.selectedSecondarySubtitleId = null;
    draft.primarySubtitles = null;
    draft.secondarySubtitles = null;
    draft.transcription = createDefaultTranscriptionState();
    draft.playback = {
      currentTime: 0,
      playbackRate: 0,
      lastUpdate: null,
      isLooping: false,
      loopCueIndex: null
    };
    if (clearError) {
      draft.error = null;
    }
  }

  private applyProfileSelectionInternal(
    profile: ProfileDefinition,
    rule: ProfileRule | null,
    draft: DesktopState
  ): boolean {
    const ruleId = rule?.id ?? null;
    const ruleName = rule?.name ?? null;
    const rulePattern = rule?.pattern ?? null;
    const ruleType = rule?.matchType ?? null;
    const changed =
      draft.appliedProfileId !== profile.id ||
      draft.appliedProfileName !== profile.name ||
      draft.appliedRuleId !== ruleId ||
      draft.appliedRuleName !== ruleName ||
      draft.appliedRulePattern !== rulePattern ||
      draft.appliedRuleMatchType !== ruleType;

    this.activeProfileId = profile.id;
    draft.appliedProfileId = profile.id;
    draft.appliedProfileName = profile.name;
    draft.appliedRuleId = ruleId;
    draft.appliedRuleName = ruleName;
    draft.appliedRulePattern = rulePattern;
    draft.appliedRuleMatchType = ruleType;
    return changed;
  }
}

function getProfileById(settings: AppSettings, profileId: string | null | undefined): ProfileDefinition | null {
  if (!profileId) {
    return null;
  }
  return settings.profiles.find((profile) => profile.id === profileId) ?? null;
}

function getDefaultProfile(settings: AppSettings): ProfileDefinition {
  return (
    settings.profiles.find((profile) => profile.id === settings.defaultProfileId) ??
    settings.profiles[0]!
  );
}

function getProfileSettingsFrom(settings: AppSettings, profileId: string | null | undefined): ProfileSettings {
  const profile = getProfileById(settings, profileId) ?? getDefaultProfile(settings);
  return profile.settings;
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}
