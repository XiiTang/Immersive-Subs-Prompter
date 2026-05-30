import { createLogger } from "../logger.js";
import { SubtitleCacheManager } from "../subtitleCacheManager.js";
import {
  JellyfinembyServerConfig,
  MediaServerSessionSummary,
  MediaServerStatusPayload
} from "../types.js";
import { createJellyfinembyIdentity } from "./identity.js";
import { JellyfinembyConnection } from "./JellyfinembyConnection.js";
import { SESSION_BURST_DURATION_MS } from "./constants.js";
import {
  ConnectionHooks,
  JellyfinembyEventMap,
  JellyfinembyEventName,
  JellyfinembyListener,
  JellyfinembyRuntimeSettings,
  SettingsProvider
} from "./types.js";

function createListenerMap(): { [K in JellyfinembyEventName]: Set<JellyfinembyListener<K>> } {
  return {
    status: new Set(),
    sessions: new Set(),
    playback: new Set(),
    subtitles: new Set(),
    error: new Set()
  };
}

export class JellyfinembySubtitleService {
  private readonly log = createLogger("jellyfinemby");
  private readonly listeners = createListenerMap();
  private readonly identity = createJellyfinembyIdentity();
  private settings: JellyfinembyRuntimeSettings;
  private connections = new Map<string, JellyfinembyConnection>();
  private connectionStatuses = new Map<string, boolean>();
  private sessionsByConfig = new Map<string, MediaServerSessionSummary[]>();
  private sessions = new Map<string, MediaServerSessionSummary>();
  private activeSessionId: string | null = null;
  private continuousSessionPolling = false;

  constructor(
    private readonly settingsProvider: SettingsProvider,
    private readonly cacheManager?: SubtitleCacheManager
  ) {
    this.settings = this.settingsProvider();
  }

  on<K extends JellyfinembyEventName>(event: K, listener: JellyfinembyListener<K>) {
    this.listeners[event].add(listener as JellyfinembyListener<any>);
    return () => this.listeners[event].delete(listener as JellyfinembyListener<any>);
  }

  start() {
    this.applySettings(this.settingsProvider());
    if (this.settings.enabled) {
      this.requestSessionsBurst("startup");
    }
  }

  stop() {
    this.applySettings({ enabled: false, servers: [] });
  }

  refresh() {
    this.applySettings(this.settingsProvider());
    if (this.settings.enabled) {
      this.requestSessionsBurst("settings-refresh");
    }
  }

  requestSessionsBurst(reason = "manual", durationMs = SESSION_BURST_DURATION_MS) {
    if (!this.settings.enabled) {
      return;
    }
    if (!this.connections.size) {
      this.log.debug(`Skipping Jellyfinemby session burst (${reason}): no active connections`);
      return;
    }
    for (const connection of this.connections.values()) {
      connection.requestSessionsBurst(reason, durationMs);
    }
  }

  setContinuousSessionPolling(enabled: boolean) {
    if (!this.settings.enabled && enabled) {
      this.log.debug("Ignoring continuous polling request: Jellyfinemby disabled");
      return;
    }
    this.continuousSessionPolling = enabled;
    for (const connection of this.connections.values()) {
      connection.setContinuousSessionPolling(enabled);
    }
  }

  setActiveSession(sessionId: string | null) {
    if (!this.settings.enabled) {
      sessionId = null;
    }
    this.log.debug("setActiveSession requested", {
      requested: sessionId,
      current: this.activeSessionId
    });
    if (!sessionId) {
      this.activeSessionId = null;
      for (const connection of this.connections.values()) {
        connection.setActiveSession(null);
      }
      return;
    }
    const configId = this.extractConfigId(sessionId);
    if (!configId) {
      this.log.warn(`Invalid Jellyfinemby session identifier ${sessionId}, clearing selection`);
      this.setActiveSession(null);
      return;
    }
    const target = this.connections.get(configId);
    if (!target) {
      this.log.warn(`No Jellyfinemby connection for session ${sessionId}, clearing selection`);
      this.setActiveSession(null);
      return;
    }
    this.log.debug("Routing active session to connection", {
      sessionId,
      configId,
      hasConnection: Boolean(target)
    });
    this.activeSessionId = sessionId;
    for (const [id, connection] of this.connections.entries()) {
      connection.setActiveSession(id === configId ? sessionId : null);
    }
  }

  getCurrentSessions(): MediaServerSessionSummary[] {
    return Array.from(this.sessions.values());
  }

  private applySettings(next: JellyfinembyRuntimeSettings) {
    this.settings = next;
    if (!next.enabled) {
      this.teardownAllConnections();
      this.emit("status", { connected: false, serverType: "jellyfinemby" });
      this.emit("sessions", []);
      this.activeSessionId = null;
      return;
    }
    this.syncConnections();
  }

  private syncConnections() {
    const enabledConfigs = new Map(
      this.settings.servers
        .filter((config) => config.enabled)
        .map((config) => [config.id, config])
    );

    for (const [configId, connection] of Array.from(this.connections.entries())) {
      const nextConfig = enabledConfigs.get(configId);
      if (!nextConfig) {
        this.disposeConnection(configId, connection);
        continue;
      }
      const currentConfig = connection.getConfigSnapshot();
      const requiresRestart =
        currentConfig.serverUrl !== nextConfig.serverUrl ||
        currentConfig.apiKey !== nextConfig.apiKey ||
        currentConfig.webSocketPath !== nextConfig.webSocketPath;
      if (requiresRestart) {
        this.disposeConnection(configId, connection);
        this.createConnection(nextConfig);
      } else {
        connection.updateConfig(nextConfig);
      }
      enabledConfigs.delete(configId);
    }

    for (const config of enabledConfigs.values()) {
      this.createConnection(config);
    }
  }

  private createConnection(config: JellyfinembyServerConfig) {
    const hooks: ConnectionHooks = {
      onStatus: (payload) => {
        this.log.debug("Connection status update", {
          configId: config.id,
          configName: config.name,
          connected: payload.connected
        });
        this.handleConnectionStatus(config.id, payload);
      },
      onSessions: (sessions) => this.handleConnectionSessions(config.id, sessions),
      onPlayback: (payload) => {
        this.log.debug("Forwarding Jellyfinemby playback payload", {
          configId: config.id,
          sessionId: payload.sessionId,
          itemName: payload.itemName,
          isPaused: payload.isPaused
        });
        this.emit("playback", payload);
      },
      onSubtitles: (payload) => {
        this.log.debug("Forwarding Jellyfinemby subtitles payload", {
          configId: config.id,
          sessionId: payload.sessionId,
          trackCount: payload.tracks.length
        });
        this.emit("subtitles", payload);
      },
      onError: (error) => this.emit("error", error)
    };
    const connection = new JellyfinembyConnection(config, this.identity, hooks, this.cacheManager);
    this.connections.set(config.id, connection);
    connection.start();
    connection.setContinuousSessionPolling(this.continuousSessionPolling);
    if (this.activeSessionId && this.extractConfigId(this.activeSessionId) === config.id) {
      connection.setActiveSession(this.activeSessionId);
    }
  }

  private disposeConnection(configId: string, connection: JellyfinembyConnection) {
    connection.setActiveSession(null);
    connection.dispose();
    this.connections.delete(configId);
    this.connectionStatuses.delete(configId);
    if (this.activeSessionId && this.extractConfigId(this.activeSessionId) === configId) {
      this.activeSessionId = null;
    }
    this.handleConnectionSessions(configId, []);
    this.emitAggregatedStatus();
  }

  private teardownAllConnections() {
    for (const [configId, connection] of this.connections.entries()) {
      connection.setActiveSession(null);
      connection.dispose();
      this.handleConnectionSessions(configId, []);
    }
    this.connections.clear();
    this.connectionStatuses.clear();
    this.sessionsByConfig.clear();
    this.sessions.clear();
    this.activeSessionId = null;
  }

  private handleConnectionStatus(configId: string, payload: MediaServerStatusPayload) {
    this.connectionStatuses.set(configId, payload.connected);
    this.emitAggregatedStatus();
  }

  private emitAggregatedStatus() {
    const anyConnected =
      this.settings.enabled && Array.from(this.connectionStatuses.values()).some(Boolean);
    this.emit("status", { connected: anyConnected, serverType: "jellyfinemby" });
  }

  private handleConnectionSessions(configId: string, sessions: MediaServerSessionSummary[]) {
    this.log.debug("Connection sessions update", {
      configId,
      count: sessions.length,
      sessionIds: sessions.map((session) => session.id)
    });
    const previous = this.sessionsByConfig.get(configId) ?? [];
    for (const summary of previous) {
      this.sessions.delete(summary.id);
    }
    this.sessionsByConfig.set(configId, sessions);
    for (const summary of sessions) {
      this.sessions.set(summary.id, summary);
    }
    this.emit("sessions", Array.from(this.sessions.values()));
  }

  private extractConfigId(globalSessionId: string): string | null {
    const separator = globalSessionId.indexOf(":");
    if (separator === -1) {
      return null;
    }
    return globalSessionId.slice(0, separator);
  }

  private emit<K extends JellyfinembyEventName>(event: K, payload: JellyfinembyEventMap[K]) {
    for (const listener of this.listeners[event]) {
      try {
        listener(payload);
      } catch (error) {
        this.log.error(`Error in Jellyfinemby listener for ${String(event)}`, error);
      }
    }
  }
}
