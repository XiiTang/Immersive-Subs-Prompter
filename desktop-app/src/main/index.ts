import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, globalShortcut, shell } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { SubtitleService, pickBestTrack } from "./subtitleService.js";
import { JellyfinSubtitleService } from "./jellyfinSubtitleService.js";
import { YtDlpManager } from "./ytDlpManager.js";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import { normalizeServerUrl, ticksToMilliseconds } from "./jellyfinUtils.js";
import {
  AppSettings,
  DesktopState,
  ExtensionMessage,
  ExtensionMessageType,
  ExtensionPayload,
  JellyfinPlaybackPayload,
  JellyfinSessionSummary,
  JellyfinSubtitlesPayload,
  PlaybackState,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleSource,
  SubtitleTrack,
  VideoControlCommand
} from "./types.js";

const WS_PORT = Number(process.env.USP_WS_PORT ?? 44501);
const ytDlpManager = new YtDlpManager();
let appSettings: AppSettings = DEFAULT_SETTINGS;
let activeProfileId = DEFAULT_SETTINGS.defaultProfileId;
const cacheManager = new SubtitleCacheManager(() => appSettings.cache);
const subtitleService = new SubtitleService(() => ytDlpManager.getBinaryPath(), () => getActiveProfileSettings(), cacheManager);
const jellyfinService = new JellyfinSubtitleService(() => appSettings.jellyfin, cacheManager);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAHklEQVR4nGOw2PvjPzUxw6iBowaOGjhq4KiBI9VAAN3kkP39BLd4AAAAAElFTkSuQmCC";

let mainWindow: BrowserWindow | null = null;
let subtitleRequestToken = 0;
const tabSockets = new Map<number, WebSocket>();
const socketTabs = new Map<WebSocket, Set<number>>();
// Track which Jellyfin itemId each tab is currently playing
const tabJellyfinItems = new Map<number, string>();
let tray: Tray | null = null;
let isQuitting = false;
let settingsStore: SettingsStore | null = null;
const mainLogger = createLogger("desktop");

const initialProfile =
  DEFAULT_SETTINGS.profiles.find((profile) => profile.id === DEFAULT_SETTINGS.defaultProfileId) ??
  DEFAULT_SETTINGS.profiles[0];

const state: DesktopState = {
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
    lastUpdate: null
  },
  subtitleTracks: [],
  selectedPrimarySubtitleId: null,
  selectedSecondarySubtitleId: null,
  primarySubtitles: null,
  secondarySubtitles: null,
  appliedProfileId: initialProfile?.id ?? null,
  appliedProfileName: initialProfile?.name ?? null,
  appliedRuleId: null,
  appliedRuleName: null,
  appliedRulePattern: null,
  appliedRuleMatchType: null,
  pendingJellyfinItemId: null,
  jellyfin: {
    connected: false,
    sessions: [],
    selectedSessionId: null,
    lastUpdated: null
  }
};

function getProfileById(settings: AppSettings, profileId: string | null | undefined): ProfileDefinition | null {
  if (!profileId) {
    return null;
  }
  return settings.profiles.find((profile) => profile.id === profileId) ?? null;
}

function getDefaultProfile(settings: AppSettings = appSettings): ProfileDefinition {
  return (
    settings.profiles.find((profile) => profile.id === settings.defaultProfileId) ??
    settings.profiles[0] ??
    DEFAULT_SETTINGS.profiles[0]
  );
}

function getProfileSettingsFrom(settings: AppSettings, profileId: string | null | undefined): ProfileSettings {
  const profile = getProfileById(settings, profileId) ?? getDefaultProfile(settings);
  return profile.settings;
}

function getActiveProfileSettings(): ProfileSettings {
  return getProfileSettingsFrom(appSettings, activeProfileId);
}

function ensureActiveProfile(): ProfileDefinition {
  const existing = getProfileById(appSettings, activeProfileId);
  if (existing) {
    return existing;
  }
  const fallback = getDefaultProfile();
  activeProfileId = fallback.id;
  return fallback;
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

function selectProfileForUrl(url: string | null): { profile: ProfileDefinition; rule: ProfileRule | null } {
  if (url) {
    for (const rule of appSettings.rules) {
      if (!rule.isEnabled) {
        continue;
      }
      if (matchesRule(url, rule)) {
        const profile = getProfileById(appSettings, rule.profileId) ?? getDefaultProfile();
        return { profile, rule };
      }
    }
  }
  return { profile: getDefaultProfile(), rule: null };
}

function applyProfileSelection(profile: ProfileDefinition, rule: ProfileRule | null): boolean {
  const ruleId = rule?.id ?? null;
  const ruleName = rule?.name ?? null;
  const rulePattern = rule?.pattern ?? null;
  const ruleType = rule?.matchType ?? null;
  const changed =
    state.appliedProfileId !== profile.id ||
    state.appliedProfileName !== profile.name ||
    state.appliedRuleId !== ruleId ||
    state.appliedRuleName !== ruleName ||
    state.appliedRulePattern !== rulePattern ||
    state.appliedRuleMatchType !== ruleType;
  activeProfileId = profile.id;
  state.appliedProfileId = profile.id;
  state.appliedProfileName = profile.name;
  state.appliedRuleId = ruleId;
  state.appliedRuleName = ruleName;
  state.appliedRulePattern = rulePattern;
  state.appliedRuleMatchType = ruleType;
  return changed;
}

function reapplyActiveProfileForCurrentVideo(): boolean {
  const selection = selectProfileForUrl(state.videoUrl);
  return applyProfileSelection(selection.profile, selection.rule);
}

function getAutostartDesktopEntryPath() {
  const configDir = path.join(app.getPath("home"), ".config", "autostart");
  return path.join(configDir, "universal-subtitle.desktop");
}

function applyAutoLaunch(enabled: boolean) {
  if (process.platform === "win32" || process.platform === "darwin") {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath
      });
    } catch (error) {
      mainLogger.error("Failed to update login item settings", error);
    }
    return;
  }

  if (process.platform === "linux") {
    const desktopFile = getAutostartDesktopEntryPath();
    try {
      if (enabled) {
        fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
        const execPath = process.execPath;
        const entry = [
          "[Desktop Entry]",
          "Type=Application",
          "Version=1.0",
          "Name=Universal Subtitle",
          `Exec="${execPath}"`,
          "Terminal=false",
          "X-GNOME-Autostart-enabled=true"
        ].join("\n");
        fs.writeFileSync(desktopFile, `${entry}\n`, "utf-8");
      } else if (fs.existsSync(desktopFile)) {
        fs.rmSync(desktopFile);
      }
    } catch (error) {
      mainLogger.error("Failed to update autostart entry", error);
    }
  }
}

function ensureTray() {
  if (tray) {
    return;
  }
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip("Universal Subtitle");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Window",
        click: () => showMainWindow()
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          tray?.destroy();
          tray = null;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", () => {
    showMainWindow();
  });
}

function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
}

function toggleMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

function registerGlobalShortcut() {
  // Unregister all existing shortcuts first
  globalShortcut.unregisterAll();
  
  const shortcut = appSettings.global.toggleWindowShortcut;
  if (!shortcut || !shortcut.trim()) {
    mainLogger.warn("No global shortcut configured");
    return;
  }
  
  try {
    const success = globalShortcut.register(shortcut, () => {
      mainLogger.info(`Global shortcut triggered: ${shortcut}`);
      toggleMainWindow();
    });
    
    if (success) {
      mainLogger.info(`Global shortcut registered: ${shortcut}`);
    } else {
      mainLogger.error(`Failed to register global shortcut: ${shortcut}`);
    }
  } catch (error) {
    mainLogger.error(`Error registering global shortcut: ${shortcut}`, error);
  }
}

function pushSettings() {
  if (!mainWindow) return;
  mainWindow.webContents.send("usp:settings", appSettings);
}

function updateAppSettings(partial: Partial<AppSettings>) {
  if (!settingsStore) {
    return appSettings;
  }
  const previous = appSettings;
  const previousGlobal = previous.global;
  const previousProfileSettings = getProfileSettingsFrom(previous, activeProfileId);
  const hadTracks = state.subtitleTracks.length > 0;

  appSettings = settingsStore.update(partial);
  ensureActiveProfile();

  if (previousGlobal.autoLaunch !== appSettings.global.autoLaunch) {
    applyAutoLaunch(appSettings.global.autoLaunch);
  }

  if (previousGlobal.toggleWindowShortcut !== appSettings.global.toggleWindowShortcut) {
    registerGlobalShortcut();
  }

  if (previousGlobal.closeBehavior !== appSettings.global.closeBehavior && mainWindow) {
    if (appSettings.global.closeBehavior === "quit") {
      mainWindow.setSkipTaskbar(false);
    } else if (!mainWindow.isVisible()) {
      mainWindow.setSkipTaskbar(true);
    }
  }

  const activeProfileChanged = reapplyActiveProfileForCurrentVideo();
  const nextProfileSettings = getActiveProfileSettings();
  const primaryPriorityChanged = !areStringArraysEqual(
    previousProfileSettings.primarySubtitlePriority,
    nextProfileSettings.primarySubtitlePriority
  );
  const secondaryPriorityChanged = !areStringArraysEqual(
    previousProfileSettings.secondarySubtitlePriority,
    nextProfileSettings.secondarySubtitlePriority
  );

  let shouldPushState = activeProfileChanged;

  if (hadTracks && (primaryPriorityChanged || secondaryPriorityChanged || activeProfileChanged)) {
    applyPreferredTracksFromSettings(state.subtitleTracks);
    shouldPushState = true;
  }

  if (shouldPushState) {
    pushState();
  }

  pushSettings();
  jellyfinService.refresh();
  return appSettings;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 640,
    frame: false,
    transparent: false,
    resizable: true,
    fullscreenable: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(false);
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.on("close", (event) => {
    if (!isQuitting && appSettings.global.closeBehavior === "tray") {
      event.preventDefault();
      mainWindow?.hide();
      mainWindow?.setSkipTaskbar(true);
    }
  });

  mainWindow.on("show", () => {
    mainWindow?.setSkipTaskbar(false);
  });

  mainWindow.on("hide", () => {
    if (appSettings.global.closeBehavior === "tray") {
      mainWindow?.setSkipTaskbar(true);
    }
  });

  // Auto-open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.once("did-finish-load", () => {
    pushSettings();
    pushState();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function pushState() {
  if (!mainWindow) return;
  mainWindow.webContents.send("usp:state", state);
}

function sendPlaybackUpdate(playback: PlaybackState) {
  if (!mainWindow) return;
  mainWindow.webContents.send("usp:time", playback);
}

function log(message: string, ...rest: unknown[]) {
  mainLogger.info(message, ...rest);
}

function updateConnectionCount(delta: number) {
  state.connectionCount = Math.max(0, state.connectionCount + delta);
  if (state.connectionCount === 0 && state.activeSource !== "jellyfin") {
    state.status = "idle";
    state.activeTabId = null;
    resetSubtitleState();
    applyProfileSelection(getDefaultProfile(), null);
  } else if (state.connectionCount > 0 && state.status === "idle" && state.activeSource !== "jellyfin") {
    state.status = "awaiting-video";
  }
  pushState();
}

const PAGE_URL_SITES = new Set(["youtube", "bilibili", "douyin"]);

function createTrackSignature(track: SubtitleTrack): string {
  return `${track.language}|${track.label}|${track.sourceFile}`.toLowerCase();
}

function normalizePriorityEntries(entries: string[]): string[] {
  return entries.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
}

function pickTrackByPriority(
  tracks: SubtitleTrack[],
  priorities: string[],
  excludeIds: Set<string> = new Set()
): SubtitleTrack | null {
  if (!tracks.length || !priorities.length) {
    return null;
  }
  const normalized = normalizePriorityEntries(priorities);
  if (!normalized.length) {
    return null;
  }
  for (const priority of normalized) {
    const matched = tracks.find((track) => {
      if (excludeIds.has(track.id)) {
        return false;
      }
      return createTrackSignature(track).includes(priority);
    });
    if (matched) {
      return matched;
    }
  }
  return null;
}

function applyPreferredTracksFromSettings(
  tracks: SubtitleTrack[],
  profileSettings: ProfileSettings = getActiveProfileSettings()
) {
  if (!tracks.length) {
    state.primarySubtitles = null;
    state.secondarySubtitles = null;
    state.selectedPrimarySubtitleId = null;
    state.selectedSecondarySubtitleId = null;
    return;
  }

  let primary = pickTrackByPriority(tracks, profileSettings.primarySubtitlePriority);
  if (!primary) {
    primary = pickBestTrack(tracks);
  }

  state.primarySubtitles = primary ?? null;
  state.selectedPrimarySubtitleId = primary?.id ?? null;

  const exclude = new Set<string>();
  if (primary) {
    exclude.add(primary.id);
  }

  const secondary = pickTrackByPriority(tracks, profileSettings.secondarySubtitlePriority, exclude);
  state.secondarySubtitles = secondary ?? null;
  state.selectedSecondarySubtitleId = secondary?.id ?? null;
}

function resetSubtitleState() {
  state.subtitleTracks = [];
  state.selectedPrimarySubtitleId = null;
  state.selectedSecondarySubtitleId = null;
  state.primarySubtitles = null;
  state.secondarySubtitles = null;
}

function getJellyfinBaseUrl(): string | null {
  const activeConfigId = appSettings.jellyfin.activeConfigId;
  if (!activeConfigId) {
    return null;
  }
  const activeConfig = appSettings.jellyfin.configs.find(c => c.id === activeConfigId);
  if (!activeConfig) {
    return null;
  }
  const base = normalizeServerUrl(activeConfig.serverUrl ?? "");
  return base.length ? base : null;
}

function buildJellyfinItemUrl(session: JellyfinSessionSummary | null): string | null {
  if (!session?.nowPlayingItemId) {
    return null;
  }
  const base = getJellyfinBaseUrl();
  if (!base) {
    return `jellyfin://${session.nowPlayingItemId}`;
  }
  return `${base}/Items/${session.nowPlayingItemId}`;
}

function buildJellyfinPageUrl(session: JellyfinSessionSummary | null): string | null {
  if (!session?.nowPlayingItemId) {
    return getJellyfinBaseUrl();
  }
  const base = getJellyfinBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}/web/index.html#!/details?id=${session.nowPlayingItemId}`;
}

function selectJellyfinSession(sessionId: string | null) {
  if (!appSettings.jellyfin.enabled) {
    state.jellyfin.selectedSessionId = null;
    state.activeSource = state.connectionCount > 0 ? "extension" : null;
    resetSubtitleState();
    pushState();
    return;
  }

  if (!sessionId) {
    state.jellyfin.selectedSessionId = null;
    state.activeSource = state.connectionCount > 0 ? "extension" : null;
    jellyfinService.setActiveSession(null);
    if (state.activeSource !== "extension") {
      state.title = null;
      state.pageUrl = null;
      state.videoUrl = null;
      state.site = null;
      state.status = state.connectionCount > 0 ? state.status : "idle";
      resetSubtitleState();
    }
    pushState();
    return;
  }

  const session = state.jellyfin.sessions.find((item) => item.id === sessionId) ?? null;
  state.jellyfin.selectedSessionId = sessionId;
  
  // Unified Jellyfin mode: always use "jellyfin" as activeSource
  // Extension will provide timestamps if available, otherwise fallback to WebSocket
  state.activeSource = "jellyfin";
  state.site = "jellyfin";
  state.title = session?.nowPlayingItemName ?? "Jellyfin Session";
  state.pageUrl = buildJellyfinPageUrl(session);
  state.videoUrl = buildJellyfinItemUrl(session) ?? getJellyfinBaseUrl();
  
  // Initialize playback state from WebSocket (will be overridden by extension if available)
  if (session) {
    const currentTimeMilliseconds = ticksToMilliseconds(session.positionTicks) ?? 0;
    state.playback = {
      currentTime: currentTimeMilliseconds,
      playbackRate: session.isPaused ? 0 : session.playbackRate || 1,
      lastUpdate: Date.now()
    };
  }
  
  const jellyfinUrl = state.videoUrl ?? getJellyfinBaseUrl();
  const selection = selectProfileForUrl(jellyfinUrl);
  applyProfileSelection(selection.profile, selection.rule);
  state.status = "loading-subtitles";
  state.error = null;
  resetSubtitleState();
  
  pushState();
  jellyfinService.setActiveSession(sessionId);
}

function handleJellyfinSessionsUpdate(sessions: JellyfinSessionSummary[]) {
  state.jellyfin.sessions = sessions;
  state.jellyfin.lastUpdated = Date.now();
  
  mainLogger.debug(`[JELLYFIN-SESSIONS] Update received`, {
    sessionsCount: sessions.length,
    activeTabId: state.activeTabId,
    activeTabItemId: state.activeTabId ? tabJellyfinItems.get(state.activeTabId) : null,
    currentSelectedSession: state.jellyfin.selectedSessionId,
    sessions: sessions.map(s => ({ id: s.id, itemId: s.nowPlayingItemId, isPaused: s.isPaused }))
  });
  
  // Handle pending Jellyfin item ID (race condition resolution)
  if (state.pendingJellyfinItemId && state.activeSource === "jellyfin") {
    const matchingSession = sessions.find(
      session => session.nowPlayingItemId === state.pendingJellyfinItemId
    );
    
    if (matchingSession && matchingSession.id !== state.jellyfin.selectedSessionId) {
      mainLogger.info(`[JELLYFIN-SESSIONS] Found matching session for pending itemId ${state.pendingJellyfinItemId}: ${matchingSession.id}`);
      state.jellyfin.selectedSessionId = matchingSession.id;
      jellyfinService.setActiveSession(matchingSession.id);
      state.pendingJellyfinItemId = null; // Clear pending after matching
    }
  }
  
  if (state.jellyfin.selectedSessionId) {
    const selected = sessions.find((item) => item.id === state.jellyfin.selectedSessionId) ?? null;
    if (!selected) {
      // Previously selected session is gone
      state.jellyfin.selectedSessionId = null;
      
      // Auto-select first available session if in Jellyfin mode
      if (state.activeSource === "jellyfin" && sessions.length > 0) {
        mainLogger.info("[JELLYFIN-SESSIONS] Previously selected session disappeared, auto-selecting first session");
        state.jellyfin.selectedSessionId = sessions[0].id;
        jellyfinService.setActiveSession(sessions[0].id);
      } else if (state.activeSource === "jellyfin") {
        // No sessions available, fallback to extension if available
        state.activeSource = state.connectionCount > 0 ? "extension" : null;
        state.status = state.connectionCount > 0 ? "awaiting-video" : "idle";
        state.title = null;
        state.pageUrl = null;
        state.videoUrl = null;
        state.site = null;
        resetSubtitleState();
        jellyfinService.setActiveSession(null);
      }
    } else if (state.activeSource === "jellyfin") {
      // Check if the session's itemId matches the active tab's itemId
      const activeTabItemId = state.activeTabId ? tabJellyfinItems.get(state.activeTabId) : null;
      const sessionItemId = selected.nowPlayingItemId;
      
      if (activeTabItemId && sessionItemId && activeTabItemId !== sessionItemId) {
        // WebSocket session switched to a different video than what the active tab is playing
        // This happens when you have multiple tabs with different Jellyfin videos
        mainLogger.warn(`[JELLYFIN-SESSIONS] Session itemId mismatch detected!`, {
          activeTabId: state.activeTabId,
          activeTabItemId,
          sessionItemId,
          sessionId: selected.id,
          ignoring: true
        });
        
        // Don't update state with this session's info - it's for a different tab
        // Keep current state but still update the sessions list
        pushState();
        return;
      }
      
      state.title = selected.nowPlayingItemName ?? state.title;
      state.pageUrl = buildJellyfinPageUrl(selected);
      state.videoUrl = buildJellyfinItemUrl(selected) ?? state.videoUrl;
    }
  } else if (state.activeSource === "jellyfin" && sessions.length > 0) {
    // No session selected but in Jellyfin mode, auto-select first session
    // But only if it matches the active tab's itemId (if we have one)
    const activeTabItemId = state.activeTabId ? tabJellyfinItems.get(state.activeTabId) : null;
    
    let sessionToSelect = sessions[0];
    if (activeTabItemId) {
      // Try to find a session matching the active tab's itemId
      const matchingSession = sessions.find(s => s.nowPlayingItemId === activeTabItemId);
      if (matchingSession) {
        sessionToSelect = matchingSession;
        mainLogger.info(`[JELLYFIN-SESSIONS] Auto-selecting session matching active tab itemId ${activeTabItemId}`);
      } else {
        mainLogger.warn(`[JELLYFIN-SESSIONS] No session found matching active tab itemId ${activeTabItemId}, selecting first session`);
      }
    } else {
      mainLogger.info("[JELLYFIN-SESSIONS] Auto-selecting first available session (no active tab itemId)");
    }
    
    state.jellyfin.selectedSessionId = sessionToSelect.id;
    jellyfinService.setActiveSession(sessionToSelect.id);
  }
  
  pushState();
}

function handleJellyfinStatusUpdate(connected: boolean) {
  state.jellyfin.connected = connected;
  if (!connected) {
    state.jellyfin.sessions = [];
    if (state.activeSource === "jellyfin") {
      selectJellyfinSession(null);
    } else {
      pushState();
    }
    return;
  }
  pushState();
}

function handleJellyfinSubtitlesUpdate(payload: JellyfinSubtitlesPayload) {
  // Accept subtitles from JellyfinService only when Jellyfin mode is active
  if (state.activeSource !== "jellyfin" || !payload.sessionId) {
    return;
  }
  if (payload.sessionId !== state.jellyfin.selectedSessionId) {
    return;
  }
  state.subtitleTracks = payload.tracks;
  if (payload.tracks.length) {
    applyPreferredTracksFromSettings(payload.tracks);
    state.status = "ready";
    state.error = null;
  } else {
    resetSubtitleState();
    state.status = "error";
    state.error = "No Jellyfin subtitles available for this session";
  }
  pushState();
}

function handleJellyfinPlaybackUpdate(payload: JellyfinPlaybackPayload) {
  // Only use WebSocket playback updates when in Jellyfin mode
  if (state.activeSource !== "jellyfin") {
    return;
  }
  if (!payload.sessionId || payload.sessionId !== state.jellyfin.selectedSessionId) {
    return;
  }

  const activeTabItemId = state.activeTabId ? tabJellyfinItems.get(state.activeTabId) ?? null : null;
  const selectedSession = state.jellyfin.sessions.find(
    (session) => session.id === payload.sessionId
  ) ?? null;
  const sessionItemId = selectedSession?.nowPlayingItemId ?? null;
  const extensionControlsSession =
    Boolean(activeTabItemId && sessionItemId && activeTabItemId === sessionItemId);

  if (extensionControlsSession) {
    // Browser extension controls the same Jellyfin item, trust its timestamps
    return;
  }

  // Fallback to WebSocket timestamps when extension is not driving this item
  const currentTime = payload.positionMs ?? 0;
  const playbackRate = payload.isPaused ? 0 : payload.playbackRate || 1;
  state.playback = {
    currentTime,
    playbackRate,
    lastUpdate: Date.now()
  };
  sendPlaybackUpdate(state.playback);
}

jellyfinService.on("status", ({ connected }) => handleJellyfinStatusUpdate(connected));
jellyfinService.on("sessions", (sessions) => handleJellyfinSessionsUpdate(sessions));
jellyfinService.on("subtitles", (payload) => handleJellyfinSubtitlesUpdate(payload));
jellyfinService.on("playback", (payload) => handleJellyfinPlaybackUpdate(payload));
jellyfinService.on("error", (error) => {
  mainLogger.error("Jellyfin service error", error);
});

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

/**
 * Normalize URL by removing tracking parameters to avoid duplicate downloads
 * Removes common tracking parameters like spm_id_from, vd_source, utm_*, etc.
 */
function normalizeUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const trackingParams = [
      'spm_id_from',
      'vd_source',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'from',
      'source',
      'share_source',
      'share_medium',
      'share_plat',
      'share_session_id',
      'share_tag',
      'timestamp'
    ];

    // Remove tracking parameters
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    // Return normalized URL
    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    mainLogger.warn(`Failed to normalize URL: ${url}`, error);
    return url;
  }
}

function isJellyfinServerUrl(url: string): boolean {
  if (!appSettings.jellyfin.enabled || !appSettings.jellyfin.configs.length) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const urlOrigin = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    
    return appSettings.jellyfin.configs.some(config => {
      if (!config.serverUrl) return false;
      try {
        const serverUrl = new URL(normalizeServerUrl(config.serverUrl));
        const serverOrigin = `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ':' + serverUrl.port : ''}`;
        return urlOrigin === serverOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function resolveVideoUrl(payload: ExtensionPayload): string | null {
  const pageUrl = typeof payload.pageUrl === "string" ? payload.pageUrl : null;
  const videoSrc = typeof payload.videoSrc === "string" ? payload.videoSrc : null;
  const site = payload.site;

  if (pageUrl && /^https?:\/\//i.test(pageUrl) && site && PAGE_URL_SITES.has(site)) {
    return pageUrl;
  }

  if (videoSrc && /^https?:\/\//i.test(videoSrc)) {
    return videoSrc;
  }

  if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
    return pageUrl;
  }

  return null;
}

async function handleMessage(message: ExtensionMessage) {
  switch (message.type) {
    case "video-context": {
      state.activeTabId = message.tabId;
      state.pageUrl = message.payload.pageUrl ?? null;
      state.site = message.payload.site ?? null;
      state.title = message.payload.title ?? null;

      const url = resolveVideoUrl(message.payload);
      
      if (!url) {
        state.status = "error";
        state.error = "Unable to parse video URL";
        pushState();
        return;
      }

      // ===== TOP-LEVEL ROUTING: Detect Jellyfin URL =====
      const isJellyfin = isJellyfinServerUrl(url);
      
      if (isJellyfin) {
        // ===== JELLYFIN MODE (Method B with Method A timestamps) =====
        
        // Extract Jellyfin item ID from URL
        try {
          const urlObj = new URL(url);
          const itemId = urlObj.searchParams.get("mediaSourceId");
          
          if (itemId && appSettings.jellyfin.enabled) {
            // URL contains item ID - process new video logic
            state.activeSource = "jellyfin";
            state.videoUrl = url;
            state.site = "jellyfin";
            
            // Track this tab's itemId
            tabJellyfinItems.set(message.tabId, itemId);
            
            // Select profile for this URL
            const selection = selectProfileForUrl(url);
            applyProfileSelection(selection.profile, selection.rule);
            
            // Check if same video is already playing
            const currentSession = state.jellyfin.selectedSessionId
              ? state.jellyfin.sessions.find(s => s.id === state.jellyfin.selectedSessionId)
              : null;
            const currentItemId = currentSession?.nowPlayingItemId;
            
            if (currentItemId === itemId && state.subtitleTracks.length > 0) {
              // Same Jellyfin video - just update playback from extension, keep subtitles
              pushState();
              return;
            }
            
            // New video - find matching Jellyfin session
            const matchingSession = state.jellyfin.sessions.find(
              session => session.nowPlayingItemId === itemId
            );
            
            if (matchingSession) {
              state.jellyfin.selectedSessionId = matchingSession.id;
              jellyfinService.setActiveSession(matchingSession.id);
              state.status = "loading-subtitles";
              state.pendingJellyfinItemId = itemId;
              
              // Only clear subtitles when switching to a NEW video
              state.selectedPrimarySubtitleId = null;
              state.selectedSecondarySubtitleId = null;
              state.primarySubtitles = null;
              state.secondarySubtitles = null;
            } else {
              // No matching session yet - save itemId and wait for WebSocket update
              state.pendingJellyfinItemId = itemId;
              state.status = "loading-subtitles";
              
              // Clear subtitles when waiting for new session
              state.selectedPrimarySubtitleId = null;
              state.selectedSecondarySubtitleId = null;
              state.primarySubtitles = null;
              state.secondarySubtitles = null;
            }
          } else {
            // No item ID in URL - this is likely play/pause event on same video
            // Keep current state and just update source/site if needed
            if (state.activeSource !== "jellyfin") {
              state.activeSource = "jellyfin";
            }
            if (state.site !== "jellyfin") {
              state.site = "jellyfin";
            }
            if (state.videoUrl !== url) {
              state.videoUrl = url;
            }
            
            // Update profile if URL changed
            const selection = selectProfileForUrl(url);
            applyProfileSelection(selection.profile, selection.rule);
            
            // DON'T clear subtitles - keep existing state
          }
        } catch (error) {
          mainLogger.error("Failed to parse Jellyfin URL", error);
          // On error, keep current state
        }
        
        pushState();
        return;
      }

      // ===== EXTENSION MODE (Method A only - yt-dlp) =====
      mainLogger.info(`Non-Jellyfin URL detected, switching to extension mode: ${url}`);
      
      // Force disconnect from Jellyfin when not on Jellyfin URL
      if (state.activeSource !== "extension") {
        state.activeSource = "extension";
        if (state.jellyfin.selectedSessionId) {
          mainLogger.info("Disconnecting from Jellyfin session (non-Jellyfin URL)");
          state.jellyfin.selectedSessionId = null;
          jellyfinService.setActiveSession(null);
        }
        state.pendingJellyfinItemId = null;
      }

      // Normalize URL to remove tracking parameters
      const normalizedUrl = normalizeUrl(url);
      const previousVideoUrl = state.videoUrl;
      
      // Store normalized URL for consistency
      state.videoUrl = normalizedUrl;
      
      // Select profile based on normalized URL
      const selection = selectProfileForUrl(normalizedUrl);
      applyProfileSelection(selection.profile, selection.rule);

      // If video URL hasn't changed, it's the same video - no need to reload subtitles
      if (normalizedUrl === previousVideoUrl && (state.subtitleTracks.length > 0 || state.status === "error")) {
        mainLogger.info(`Same video detected (normalized URL matches), skipping subtitle reload: ${normalizedUrl}`);
        pushState();
        return;
      }

      // URL changed, need to reload subtitles
      state.error = null;
      state.primarySubtitles = null;
      state.secondarySubtitles = null;
      state.subtitleTracks = [];
      state.selectedPrimarySubtitleId = null;
      state.selectedSecondarySubtitleId = null;
      state.status = "loading-subtitles";
      pushState();

      const requestId = ++subtitleRequestToken;
      try {
        const result = await subtitleService.getSubtitles(url);
        if (requestId === subtitleRequestToken) {
          state.subtitleTracks = result.tracks;
          if (result.tracks.length) {
            applyPreferredTracksFromSettings(result.tracks);
            state.status = "ready";
            state.error = null;
          } else {
            state.primarySubtitles = null;
            state.secondarySubtitles = null;
            state.selectedPrimarySubtitleId = null;
            state.selectedSecondarySubtitleId = null;
            state.status = "error";
            state.error = "No available subtitles found";
          }
          pushState();
        }
      } catch (error) {
        if (requestId === subtitleRequestToken) {
          state.status = "error";
          state.error =
            error && typeof error === "object" && "message" in error
              ? (error as Error).message
              : "Subtitle download failed";
          state.primarySubtitles = null;
          state.secondarySubtitles = null;
          state.selectedPrimarySubtitleId = null;
          state.selectedSecondarySubtitleId = null;
          pushState();
        }
      }
      break;
    }

    case "time-update":
    case "playback-rate": {
      if (state.activeTabId !== null && state.activeTabId !== message.tabId) {
        return;
      }

      const currentTime = message.payload.currentTime ?? state.playback.currentTime;
      const rawPlaybackRate = message.payload.playbackRate ?? state.playback.playbackRate;
      const playbackRate = message.payload.paused ? 0 : rawPlaybackRate;

      // Update playback state from extension
      // This works for both "extension" (yt-dlp) and "jellyfin" (WebSocket subtitles with extension timestamps)
      state.playback = {
        currentTime,
        playbackRate,
        lastUpdate: Date.now()
      };
      sendPlaybackUpdate(state.playback);
      break;
    }

    case "loop-cleared": {
      // Forward loop-cleared event to renderer to update UI
      if (state.activeTabId === message.tabId && mainWindow) {
        mainWindow.webContents.send("usp:loop-cleared");
        mainLogger.info("Loop cleared by user interaction");
      }
      break;
    }

    case "video-ended": {
      if (state.activeTabId === message.tabId) {
        // Only handle video-ended for non-Jellyfin sources
        // Jellyfin sessions are managed separately
        if (state.activeSource !== "jellyfin") {
          state.status = state.connectionCount > 0 ? "awaiting-video" : "idle";
          state.primarySubtitles = null;
          state.secondarySubtitles = null;
          state.subtitleTracks = [];
          state.selectedPrimarySubtitleId = null;
          state.selectedSecondarySubtitleId = null;
          state.videoUrl = null;
          applyProfileSelection(getDefaultProfile(), null);
        }
        pushState();
      }
      break;
    }

    case "page-url-changed": {
      if (state.activeTabId === message.tabId) {
        state.pageUrl = message.payload.pageUrl ?? state.pageUrl;
        state.title = message.payload.title ?? state.title;
        pushState();
      }
      break;
    }

    default:
      break;
  }
}

function bootstrapWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });
  log(`WebSocket server listening on ws://127.0.0.1:${WS_PORT}`);

  wss.on("connection", (socket: WebSocket) => {
    log("Extension connected");
    updateConnectionCount(+1);

    socket.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        if (!data || typeof data !== "object") return;
        if (data.source !== "usp-extension") return;
        const { tabId, type, payload } = data as {
          tabId: number;
          type: ExtensionMessageType;
          payload: ExtensionPayload;
        };
        rememberTabSocket(tabId, socket);
        handleMessage({ tabId, type, payload }).catch((error) => {
          mainLogger.error("Failed to handle message", error);
        });
      } catch (error) {
        mainLogger.error("Failed to process message", error);
      }
    });

    socket.on("close", () => {
      log("Extension disconnected");
      forgetSocket(socket);
      updateConnectionCount(-1);
    });

    socket.on("error", (error: Error) => {
      mainLogger.error("WebSocket error", error);
      socket.close();
    });
  });

  wss.on("error", (error: Error) => {
    mainLogger.error("WebSocket server error", error);
  });
}

function rememberTabSocket(tabId: number, socket: WebSocket) {
  tabSockets.set(tabId, socket);
  let tabs = socketTabs.get(socket);
  if (!tabs) {
    tabs = new Set();
    socketTabs.set(socket, tabs);
  }
  tabs.add(tabId);
}

function forgetSocket(socket: WebSocket) {
  const tabs = socketTabs.get(socket);
  if (!tabs) return;
  tabs.forEach((tabId) => {
    tabSockets.delete(tabId);
    // Clean up Jellyfin item tracking for this tab
    tabJellyfinItems.delete(tabId);
    mainLogger.debug(`[CLEANUP] Removed tab ${tabId} from tracking`);
  });
  socketTabs.delete(socket);
}

type TrackSelectionPayload = {
  trackId: string | null;
  role?: "primary" | "secondary";
};

function isTrackSelectionPayload(value: unknown): value is TrackSelectionPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      "trackId" in value
  );
}

function setSubtitleTrack(trackId: string | null, role: "primary" | "secondary" = "primary") {
  const track = trackId ? state.subtitleTracks.find((t) => t.id === trackId) || null : null;
  if (role === "primary") {
    state.selectedPrimarySubtitleId = track ? track.id : null;
    state.primarySubtitles = track;
  } else {
    state.selectedSecondarySubtitleId = track ? track.id : null;
    state.secondarySubtitles = track;
  }
  pushState();
}

function sendControlCommand(command: VideoControlCommand): boolean {
  if (state.activeTabId === null) {
    return false;
  }
  const socket = tabSockets.get(state.activeTabId);
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  let payload: Record<string, unknown> | undefined;
  if (command.type === "seek") {
    payload = { time: command.time };
  } else if (command.type === "loop") {
    payload = { start: command.start, end: command.end };
  }

  socket.send(
    JSON.stringify({
      source: "usp-desktop",
      type: "control-command",
      tabId: state.activeTabId,
      action: command.type,
      payload
    })
  );
  return true;
}

ipcMain.handle("usp:get-state", () => {
  return state;
});
ipcMain.handle("usp:select-track", (_event, payload: TrackSelectionPayload | string | null) => {
  if (isTrackSelectionPayload(payload)) {
    const role = payload.role === "secondary" ? "secondary" : "primary";
    setSubtitleTrack(payload.trackId ?? null, role);
  } else {
    setSubtitleTrack((payload as string | null) ?? null, "primary");
  }
});
ipcMain.handle("usp:control", (_event, command) => {
  sendControlCommand(command);
});
ipcMain.handle("usp:get-settings", () => appSettings);
ipcMain.handle("usp:update-settings", (_event, payload: Partial<AppSettings>) => {
  return updateAppSettings(payload);
});

// Cache management IPC handlers
ipcMain.handle("usp:cache-stats", async () => {
  try {
    return await cacheManager.getStats();
  } catch (error) {
    mainLogger.error("Failed to get cache stats", error);
    throw error;
  }
});

ipcMain.handle("usp:cache-clear", async () => {
  try {
    await cacheManager.clear();
    return { success: true };
  } catch (error) {
    mainLogger.error("Failed to clear cache", error);
    throw error;
  }
});

ipcMain.handle("usp:cache-cleanup", async () => {
  try {
    const removedCount = await cacheManager.cleanup();
    return { success: true, removedCount };
  } catch (error) {
    mainLogger.error("Failed to cleanup cache", error);
    throw error;
  }
});

ipcMain.handle("usp:cache-open-folder", async () => {
  try {
    const cachePath = cacheManager.getCachePath();
    // Ensure the directory exists before opening
    await fs.promises.mkdir(cachePath, { recursive: true });
    await shell.openPath(cachePath);
  } catch (error) {
    mainLogger.error("Failed to open cache folder", error);
    throw error;
  }
});

app.whenReady().then(() => {
  settingsStore = new SettingsStore();
  appSettings = settingsStore.get();
  activeProfileId = appSettings.defaultProfileId;
  applyProfileSelection(getDefaultProfile(), null);
  applyAutoLaunch(appSettings.global.autoLaunch);
  registerGlobalShortcut();
  ensureTray();
  bootstrapWebSocketServer();
  jellyfinService.start();
  createWindow();

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  cacheManager.stop();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
