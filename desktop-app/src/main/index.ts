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
  JellyfinConfig,
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

type TabJellyfinContext = {
  itemId: string | null;
  sessionId: string | null;
  serverConfigId: string | null;
};

// Track Jellyfin metadata per tab to support multi-server toggling
const tabJellyfinContexts = new Map<number, TabJellyfinContext>();
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
    lastUpdate: null,
    isLooping: false,
    loopCueIndex: null
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

function getTabJellyfinContext(tabId: number | null): TabJellyfinContext | null {
  if (tabId === null) {
    return null;
  }
  return tabJellyfinContexts.get(tabId) ?? null;
}

function updateTabJellyfinContext(
  tabId: number,
  updates: Partial<TabJellyfinContext>
): TabJellyfinContext {
  const previous = tabJellyfinContexts.get(tabId) ?? {
    itemId: null,
    sessionId: null,
    serverConfigId: null
  };
  const next: TabJellyfinContext = {
    ...previous,
    ...updates
  };
  tabJellyfinContexts.set(tabId, next);
  return next;
}

function clearTabJellyfinContext(tabId: number) {
  tabJellyfinContexts.delete(tabId);
}

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
  return path.join(configDir, "immersive-subs-prompter.desktop");
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
          "Name=Immersive Subs Prompter",
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
  tray.setToolTip("Immersive Subs Prompter");
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

/**
 * Update playback state while preserving loop state
 */
function updatePlaybackState(updates: Partial<PlaybackState>) {
  state.playback = {
    ...state.playback,
    ...updates,
    lastUpdate: Date.now()
  };
  sendPlaybackUpdate(state.playback);
}

function log(message: string, ...rest: unknown[]) {
  mainLogger.info(message, ...rest);
}

function updateConnectionCount(delta: number) {
  state.connectionCount = Math.max(0, state.connectionCount + delta);
  const shouldUseContinuousPolling = state.connectionCount === 0;
  jellyfinService.setContinuousSessionPolling(shouldUseContinuousPolling);

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

function resolveJellyfinConfig(configId?: string | null): JellyfinConfig | null {
  if (configId) {
    return appSettings.jellyfin.configs.find((config) => config.id === configId) ?? null;
  }
  const enabled = appSettings.jellyfin.configs.find((config) => config.enabled);
  if (enabled) {
    return enabled;
  }
  return appSettings.jellyfin.configs[0] ?? null;
}

function getJellyfinBaseUrl(configId?: string | null): string | null {
  const config = resolveJellyfinConfig(configId);
  if (!config) {
    return null;
  }
  const base = normalizeServerUrl(config.serverUrl ?? "");
  return base.length ? base : null;
}

function buildJellyfinItemUrl(session: JellyfinSessionSummary | null): string | null {
  if (!session?.nowPlayingItemId) {
    return null;
  }
  const base = getJellyfinBaseUrl(session.serverConfigId);
  if (!base) {
    return `jellyfin://${session.nowPlayingItemId}`;
  }
  return `${base}/Items/${session.nowPlayingItemId}`;
}

function buildJellyfinPageUrl(session: JellyfinSessionSummary | null): string | null {
  if (!session) {
    return getJellyfinBaseUrl();
  }
  if (!session.nowPlayingItemId) {
    return getJellyfinBaseUrl(session.serverConfigId);
  }
  const base = getJellyfinBaseUrl(session.serverConfigId);
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

  mainLogger.debug("Selecting Jellyfin session", {
    requested: sessionId,
    current: state.jellyfin.selectedSessionId
  });

  if (!sessionId) {
    state.jellyfin.selectedSessionId = null;
    state.activeSource = state.connectionCount > 0 ? "extension" : null;
    jellyfinService.setActiveSession(null);
    mainLogger.debug("Clearing Jellyfin selection (null requested)", {
      connectionCount: state.connectionCount,
      activeSource: state.activeSource
    });
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
  mainLogger.debug("Jellyfin session lookup", {
    sessionId,
    session,
    serverName: session?.serverName,
    serverConfigId: session?.serverConfigId,
    nowPlayingItemId: session?.nowPlayingItemId
  });
  if (!session) {
    mainLogger.warn("Requested Jellyfin session missing in latest update", {
      sessionId,
      knownSessions: state.jellyfin.sessions.map((item) => ({
        id: item.id,
        serverConfigId: item.serverConfigId,
        serverName: item.serverName,
        nowPlayingItemId: item.nowPlayingItemId
      }))
    });
  }
  
  // Unified Jellyfin mode: always use "jellyfin" as activeSource
  // Extension will provide timestamps if available, otherwise fallback to WebSocket
  state.activeSource = "jellyfin";
  state.site = "jellyfin";
  state.title = session?.nowPlayingItemName ?? "Jellyfin Session";
  state.pageUrl = buildJellyfinPageUrl(session);
  state.videoUrl = buildJellyfinItemUrl(session) ?? getJellyfinBaseUrl(session?.serverConfigId);
  
  // Initialize playback state from WebSocket (will be overridden by extension if available)
  if (session) {
    const currentTimeMilliseconds = ticksToMilliseconds(session.positionTicks) ?? 0;
    updatePlaybackState({
      currentTime: currentTimeMilliseconds,
      playbackRate: session.isPaused ? 0 : session.playbackRate || 1,
      isLooping: false,
      loopCueIndex: null
    });
  }
  
  const jellyfinUrl = state.videoUrl ?? getJellyfinBaseUrl(session?.serverConfigId);
  const selection = selectProfileForUrl(jellyfinUrl);
  applyProfileSelection(selection.profile, selection.rule);
  state.status = "loading-subtitles";
  state.error = null;
  resetSubtitleState();
  
  pushState();
  jellyfinService.setActiveSession(sessionId);
}

function handleJellyfinSessionsUpdate(sessions: JellyfinSessionSummary[]) {
  mainLogger.debug("Received Jellyfin sessions update", {
    count: sessions.length,
    sessions: sessions.map((session) => ({
      id: session.id,
      serverConfigId: session.serverConfigId,
      serverName: session.serverName,
      nowPlayingItemId: session.nowPlayingItemId
    })),
    previousSelected: state.jellyfin.selectedSessionId
  });
  state.jellyfin.sessions = sessions;
  state.jellyfin.lastUpdated = Date.now();

  for (const [tabId, context] of tabJellyfinContexts.entries()) {
    const sessionById =
      context.sessionId && sessions.find((session) => session.id === context.sessionId);
    if (sessionById) {
      updateTabJellyfinContext(tabId, {
        sessionId: sessionById.id,
        serverConfigId: sessionById.serverConfigId,
        itemId: sessionById.nowPlayingItemId ?? context.itemId
      });
      continue;
    }
    if (!context.itemId) {
      continue;
    }
    const matchingByItem = sessions.find(
      (session) =>
        session.nowPlayingItemId === context.itemId &&
        (!context.serverConfigId || session.serverConfigId === context.serverConfigId)
    );
    if (matchingByItem) {
      updateTabJellyfinContext(tabId, {
        sessionId: matchingByItem.id,
        serverConfigId: matchingByItem.serverConfigId,
        itemId: matchingByItem.nowPlayingItemId ?? context.itemId
      });
    }
  }
  
  // Handle pending Jellyfin item ID (race condition resolution)
  if (state.pendingJellyfinItemId && state.activeSource === "jellyfin") {
    const matchingSession = sessions.find(
      (session) => session.nowPlayingItemId === state.pendingJellyfinItemId
    );

    if (matchingSession) {
      if (matchingSession.id !== state.jellyfin.selectedSessionId) {
        mainLogger.debug("Matching Jellyfin session found for pending item", {
          pendingItemId: state.pendingJellyfinItemId,
          sessionId: matchingSession.id,
          serverConfigId: matchingSession.serverConfigId,
          serverName: matchingSession.serverName
        });
        state.jellyfin.selectedSessionId = matchingSession.id;
        jellyfinService.setActiveSession(matchingSession.id);
      }
      if (state.activeTabId !== null) {
        updateTabJellyfinContext(state.activeTabId, {
          sessionId: matchingSession.id,
          serverConfigId: matchingSession.serverConfigId,
          ...(matchingSession.nowPlayingItemId ? { itemId: matchingSession.nowPlayingItemId } : {})
        });
      }
      state.pendingJellyfinItemId = null;
    }
  }

  if (state.jellyfin.selectedSessionId) {
    const selected =
      sessions.find((item) => item.id === state.jellyfin.selectedSessionId) ?? null;
    if (!selected) {
      mainLogger.warn("Previously selected Jellyfin session vanished", {
        previousSessionId: state.jellyfin.selectedSessionId,
        activeSource: state.activeSource,
        connectionCount: state.connectionCount
      });
      // Previously selected session is gone
      state.jellyfin.selectedSessionId = null;

      // Auto-select first available session if in Jellyfin mode
      if (state.activeSource === "jellyfin" && sessions.length > 0) {
        state.jellyfin.selectedSessionId = sessions[0].id;
        jellyfinService.setActiveSession(sessions[0].id);
      } else if (state.activeSource === "jellyfin") {
        // No sessions available, fallback to extension if available
        state.activeSource = state.connectionCount > 0 ? "extension" : null;
        mainLogger.debug("Falling back to extension because no Jellyfin sessions remain", {
          connectionCount: state.connectionCount,
          activeSource: state.activeSource
        });
        state.status = state.connectionCount > 0 ? "awaiting-video" : "idle";
        state.title = null;
        state.pageUrl = null;
        state.videoUrl = null;
        state.site = null;
        resetSubtitleState();
        jellyfinService.setActiveSession(null);
      }
    } else if (state.activeSource === "jellyfin") {
      const activeTabContext = getTabJellyfinContext(state.activeTabId);
      const activeTabItemId = activeTabContext?.itemId ?? null;
      const sessionItemId = selected.nowPlayingItemId;
      
      if (state.activeTabId) {
        updateTabJellyfinContext(state.activeTabId, {
          sessionId: selected.id,
          serverConfigId: selected.serverConfigId,
          ...(sessionItemId ? { itemId: sessionItemId } : {})
        });
      }
      
      if (activeTabItemId && sessionItemId && activeTabItemId !== sessionItemId) {
        // WebSocket session switched to a different video than what the active tab is playing
        // This happens when you have multiple tabs with different Jellyfin videos
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
    const activeTabContext = getTabJellyfinContext(state.activeTabId);
    const activeTabItemId = activeTabContext?.itemId ?? null;
    const activeTabSessionId = activeTabContext?.sessionId ?? null;
    const activeServerId = activeTabContext?.serverConfigId ?? null;
    
    let sessionToSelect = sessions[0];
    if (activeTabSessionId) {
      const matchingBySession = sessions.find((session) => session.id === activeTabSessionId);
      if (matchingBySession) {
        sessionToSelect = matchingBySession;
      }
    } else if (activeTabItemId) {
      const matchingSession = sessions.find(
        (session) =>
          session.nowPlayingItemId === activeTabItemId &&
          (!activeServerId || session.serverConfigId === activeServerId)
      );
      if (matchingSession) {
        sessionToSelect = matchingSession;
      }
    } else if (activeServerId) {
      const matchingByServer = sessions.find((session) => session.serverConfigId === activeServerId);
      if (matchingByServer) {
        sessionToSelect = matchingByServer;
      }
    }
    
    if (state.activeTabId) {
      updateTabJellyfinContext(state.activeTabId, {
        sessionId: sessionToSelect.id,
        serverConfigId: sessionToSelect.serverConfigId,
        ...(sessionToSelect.nowPlayingItemId ? { itemId: sessionToSelect.nowPlayingItemId } : {})
      });
    }

    mainLogger.debug("Auto-selecting Jellyfin session", {
      sessionId: sessionToSelect.id,
      serverConfigId: sessionToSelect.serverConfigId,
      serverName: sessionToSelect.serverName,
      nowPlayingItemId: sessionToSelect.nowPlayingItemId,
      activeTabItemId
    });
    state.jellyfin.selectedSessionId = sessionToSelect.id;
    jellyfinService.setActiveSession(sessionToSelect.id);
  }
  
  pushState();
}

function handleJellyfinStatusUpdate(connected: boolean) {
  mainLogger.debug("Jellyfin status changed", { connected });
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
  jellyfinService.requestSessionsBurst("ws-status-connected");
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

  const activeTabContext = getTabJellyfinContext(state.activeTabId);
  const activeTabItemId = activeTabContext?.itemId ?? null;
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
  updatePlaybackState({
    currentTime,
    playbackRate
  });
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

function extractOrigin(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  let candidate = url.trim();
  if (!candidate) {
    return null;
  }
  if (candidate.startsWith("blob:")) {
    candidate = candidate.slice(5);
  }
  try {
    const parsed = new URL(candidate);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ":" + parsed.port : ""}`;
  } catch {
    return null;
  }
}

function resolveJellyfinConfigIdFromUrls(urls: Array<string | null | undefined>): string | null {
  if (!appSettings.jellyfin.enabled || !appSettings.jellyfin.configs.length) {
    return null;
  }
  for (const candidate of urls) {
    const origin = extractOrigin(candidate);
    if (!origin) {
      continue;
    }
    for (const config of appSettings.jellyfin.configs) {
      if (!config.serverUrl) {
        continue;
      }
      try {
        const serverUrl = new URL(normalizeServerUrl(config.serverUrl));
        const serverOrigin = `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ":" + serverUrl.port : ""}`;
        if (serverOrigin === origin) {
          return config.id;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function isJellyfinServerUrl(url: string): boolean {
  return Boolean(resolveJellyfinConfigIdFromUrls([url]));
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
      const resolvedConfigId = resolveJellyfinConfigIdFromUrls([
        url,
        message.payload.pageUrl ?? null,
        message.payload.videoSrc ?? null
      ]);
      const existingTabContext = getTabJellyfinContext(message.tabId);
      const jellyfinConfigId = resolvedConfigId ?? existingTabContext?.serverConfigId ?? null;
      const isJellyfin = Boolean(jellyfinConfigId);
      
      if (isJellyfin) {
        // ===== JELLYFIN MODE (Method B with Method A timestamps) =====
        if (jellyfinConfigId) {
          updateTabJellyfinContext(message.tabId, { serverConfigId: jellyfinConfigId });
        }
        
        // Extract Jellyfin item ID from URL
        // Try videoSrc first (has mediaSourceId), then fall back to pageUrl
        let itemId: string | null = null;
        try {
          // First, try to extract from videoSrc (the actual media URL)
          const videoSrc = message.payload.videoSrc;
          if (videoSrc && typeof videoSrc === "string") {
            const videoUrlObj = new URL(videoSrc);
            itemId = videoUrlObj.searchParams.get("mediaSourceId");
          }
          
          // If not found in videoSrc, try the resolved URL
          if (!itemId) {
            const urlObj = new URL(url);
            itemId = urlObj.searchParams.get("mediaSourceId");
          }
        } catch (error) {
          mainLogger.error(`Failed to parse Jellyfin URL for itemId`, error);
        }

        if (itemId) {
          updateTabJellyfinContext(message.tabId, { itemId });
        }

        const tabContext = getTabJellyfinContext(message.tabId);
        const storedSession =
          tabContext?.sessionId
            ? state.jellyfin.sessions.find((session) => session.id === tabContext.sessionId) ?? null
            : null;
          
        if (itemId && appSettings.jellyfin.enabled) {
          // URL contains item ID - process new video logic
          state.activeSource = "jellyfin";
          state.videoUrl = url;
          state.site = "jellyfin";
          
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

          const trackedItemId = state.pendingJellyfinItemId ?? currentItemId ?? null;
          if (trackedItemId !== itemId) {
            jellyfinService.requestSessionsBurst(`jellyfin-video-change:${itemId}`);
          }

          let matchingSession: JellyfinSessionSummary | null = null;
          if (storedSession && storedSession.nowPlayingItemId === itemId) {
            matchingSession = storedSession;
          }
          if (!matchingSession) {
            matchingSession =
              state.jellyfin.sessions.find(
                (session) =>
                  session.nowPlayingItemId === itemId &&
                  (!tabContext?.serverConfigId || session.serverConfigId === tabContext.serverConfigId)
              ) ?? null;
          }
          
          if (matchingSession) {
            state.jellyfin.selectedSessionId = matchingSession.id;
            jellyfinService.setActiveSession(matchingSession.id);
            state.status = "loading-subtitles";
            state.pendingJellyfinItemId = itemId;
            updateTabJellyfinContext(message.tabId, {
              sessionId: matchingSession.id,
              serverConfigId: matchingSession.serverConfigId,
              itemId: matchingSession.nowPlayingItemId ?? itemId
            });
            
            // Only clear subtitles when switching to a NEW video
            state.selectedPrimarySubtitleId = null;
            state.selectedSecondarySubtitleId = null;
            state.primarySubtitles = null;
            state.secondarySubtitles = null;
          } else {
            // No matching session yet - save itemId and wait for WebSocket update
            state.pendingJellyfinItemId = itemId;
            state.status = "loading-subtitles";
            updateTabJellyfinContext(message.tabId, {
              itemId
            });
            
            // Clear subtitles when waiting for new session
            state.selectedPrimarySubtitleId = null;
            state.selectedSecondarySubtitleId = null;
            state.primarySubtitles = null;
            state.secondarySubtitles = null;
          }
        } else {
          // No item ID in URL - this is likely Blob URL or play/pause event on same video
          // Mark this tab as playing Jellyfin, but we'll get the itemId from Sessions message
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

          if (storedSession) {
            if (state.jellyfin.selectedSessionId !== storedSession.id) {
              state.jellyfin.selectedSessionId = storedSession.id;
              jellyfinService.setActiveSession(storedSession.id);
            }
            updateTabJellyfinContext(message.tabId, {
              sessionId: storedSession.id,
              serverConfigId: storedSession.serverConfigId,
              ...(storedSession.nowPlayingItemId ? { itemId: storedSession.nowPlayingItemId } : {})
            });
            if (!state.pendingJellyfinItemId && storedSession.nowPlayingItemId) {
              state.pendingJellyfinItemId = storedSession.nowPlayingItemId;
            }
          }

          // Request a burst to get current session info
          jellyfinService.requestSessionsBurst("jellyfin-video-context-no-itemid");

          // DON'T clear subtitles - keep existing state
        }
        
        pushState();
        return;
      }

      // ===== EXTENSION MODE (Method A only - yt-dlp) =====
      // Force disconnect from Jellyfin when not on Jellyfin URL
      clearTabJellyfinContext(message.tabId);
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

      // Update playback state from extension - use actual time
      updatePlaybackState({
        currentTime,
        playbackRate
      });
      break;
    }

    case "loop-started": {
      // Extension confirms that loop has started
      if (state.activeTabId !== null && state.activeTabId !== message.tabId) {
        return;
      }
      
      state.playback.isLooping = true;
      state.playback.lastUpdate = Date.now();
      sendPlaybackUpdate(state.playback);
      break;
    }

    case "loop-cleared": {
      // Forward loop-cleared event to renderer to update UI
      if (state.activeTabId === message.tabId && mainWindow) {
        // Clear loop state
        state.playback.isLooping = false;
        state.playback.loopCueIndex = null;
        
        mainWindow.webContents.send("usp:loop-cleared");
        sendPlaybackUpdate(state.playback);
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
    clearTabJellyfinContext(tabId);
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
    mainLogger.warn("Cannot send control command: no active tab");
    return false;
  }
  const socket = tabSockets.get(state.activeTabId);
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    mainLogger.warn("Cannot send control command: socket not ready", { 
      hasSocket: !!socket, 
      readyState: socket?.readyState 
    });
    return false;
  }

  let payload: Record<string, unknown> | undefined;
  if (command.type === "seek") {
    payload = { time: command.time };
  } else if (command.type === "loop") {
    // Store cueIndex for when loop-started is received
    state.playback.loopCueIndex = command.cueIndex;
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
