import { JellyfinembyIdentity } from "../jellyfinembyUtils.js";
import { MediaServerSessionSummary } from "../types.js";
import { JellyfinembySessionManager } from "./JellyfinembySessionManager.js";
import { RawSessionRecord } from "./types.js";

export type EffectiveItemResult = {
  shouldSwitch: boolean;
  effectiveItemId: string | null;
};

export class JellyfinembySessionTracker {
  private sessions = new Map<string, MediaServerSessionSummary>();
  private activeSessionId: string | null = null;
  private lastActiveSessionItemId: string | null = null;
  // Track position for each itemId separately to detect real activity
  private itemPositionHistory = new Map<string, number>();

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
   * Clears per-item tracking on change.
   */
  setActive(sessionId: string | null): boolean {
    if (this.activeSessionId === sessionId) {
      return false;
    }
    this.activeSessionId = sessionId;
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();
    return true;
  }

  /**
   * Decide whether we should switch the tracked item to the reported one,
   * applying the "sticky itemId" logic based on position activity.
   * Updates internal tracking as a side effect when a switch occurs, and
   * updates position history when the reported item matches the existing one.
   */
  determineEffectiveItem(summary: MediaServerSessionSummary): EffectiveItemResult {
    const reportedItemId = summary.nowPlayingItemId;
    const reportedPositionTicks = summary.positionTicks;

    let shouldSwitchItem = false;

    if (!this.lastActiveSessionItemId) {
      // No previous item, accept the reported one
      shouldSwitchItem = true;
    } else if (reportedItemId === this.lastActiveSessionItemId) {
      // Same item, no switch needed, just update position
      shouldSwitchItem = false;
      if (reportedItemId && reportedPositionTicks !== null) {
        this.itemPositionHistory.set(reportedItemId, reportedPositionTicks);
      }
    } else if (!reportedItemId) {
      // No item being reported
      shouldSwitchItem = false;
    } else {
      // Different itemId reported - check if it's actually active
      const lastKnownPosition = this.itemPositionHistory.get(reportedItemId) ?? null;
      const positionChanged =
        lastKnownPosition !== null &&
        reportedPositionTicks !== null &&
        reportedPositionTicks !== lastKnownPosition;

      const isPlaying = !summary.isPaused;

      // Only switch if the new item shows signs of activity:
      // 1. Position has changed from its own last known position (indicates playback progress or user seeking)
      // 2. OR the item is actively playing
      if (positionChanged || isPlaying) {
        shouldSwitchItem = true;
      }
    }

    // Use the sticky itemId for playback emission
    const effectiveItemId = shouldSwitchItem ? reportedItemId : this.lastActiveSessionItemId;

    // Update tracking if we switched
    if (shouldSwitchItem && reportedItemId) {
      this.lastActiveSessionItemId = reportedItemId;
      if (reportedPositionTicks !== null) {
        this.itemPositionHistory.set(reportedItemId, reportedPositionTicks);
      }
    }

    return { shouldSwitch: shouldSwitchItem, effectiveItemId };
  }

  /** Called when the active session no longer exists in the latest snapshot. */
  clearActiveItemTracking() {
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();
  }

  reset() {
    this.sessions.clear();
    this.activeSessionId = null;
    this.lastActiveSessionItemId = null;
    this.itemPositionHistory.clear();
  }
}
