import { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { MediaServerSessionSummary } from "../types.js";
import { JellyfinembySessionManager } from "./JellyfinembySessionManager.js";
import { RawSessionRecord } from "./types.js";

export class JellyfinembySessionTracker {
  private sessions = new Map<string, MediaServerSessionSummary>();
  private activeSessionId: string | null = null;

  constructor(
    private readonly sessionManager: JellyfinembySessionManager,
    private readonly identity: JellyfinembyIdentity
  ) {}

  /**
   * Rebuild the session map from a raw Sessions payload.
   * Returns the new list of summaries for downstream consumers.
   */
  updateSessions(data: unknown): MediaServerSessionSummary[] | null {
    if (!Array.isArray(data)) {
      return null;
    }

    const nextSessions = new Map<string, MediaServerSessionSummary>();
    for (const record of data as RawSessionRecord[]) {
      // Skip our own session - we don't want to monitor ourselves
      const deviceId = (record as { DeviceId?: unknown } | null)?.DeviceId;
      if (typeof deviceId === "string" && deviceId === this.identity.deviceId) {
        continue;
      }

      const summary = this.sessionManager.toSessionSummary(record);
      if (!summary) {
        continue;
      }

      nextSessions.set(summary.id, summary);
    }
    this.sessions = nextSessions;
    return Array.from(this.sessions.values());
  }

  getActiveSummary(): MediaServerSessionSummary | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  getSessionById(sessionId: string): MediaServerSessionSummary | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getCurrentSessions(): MediaServerSessionSummary[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Set the active session id. Returns true when it actually changed.
   */
  setActive(sessionId: string | null): boolean {
    if (this.activeSessionId === sessionId) {
      return false;
    }
    this.activeSessionId = sessionId;
    return true;
  }

  reset() {
    this.sessions.clear();
    this.activeSessionId = null;
  }
}
