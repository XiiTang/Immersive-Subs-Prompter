import { SESSION_BURST_DURATION_MS, SESSION_POLL_CONFIG } from "./constants.js";
import { JellyfinembyWebSocketTransport } from "./JellyfinembyWebSocketTransport.js";
import { SessionSubscriptionMode } from "./types.js";

type Logger = {
  info: (message: string, ...details: unknown[]) => void;
  warn: (message: string, ...details: unknown[]) => void;
  error: (message: string, ...details: unknown[]) => void;
  debug: (message: string, ...details: unknown[]) => void;
};

export class JellyfinembySessionSubscription {
  private sessionSubscriptionMode: SessionSubscriptionMode = "idle";
  private sessionStreamActive = false;
  private sessionBurstTimer: NodeJS.Timeout | null = null;
  private pendingBurstDuration: number | null = null;

  constructor(
    private readonly transport: JellyfinembyWebSocketTransport,
    private readonly log: Logger,
    private readonly getConfigName: () => string,
    private readonly ensureConnected: () => void
  ) {}

  getMode(): SessionSubscriptionMode {
    return this.sessionSubscriptionMode;
  }

  setMode(mode: SessionSubscriptionMode) {
    if (this.sessionSubscriptionMode === mode) {
      return;
    }

    this.sessionSubscriptionMode = mode;
    if (mode !== "burst") {
      this.pendingBurstDuration = null;
    }
    if (mode === "idle") {
      this.clearBurstTimer();
      this.stopSessionStream();
      return;
    }

    if (mode === "continuous") {
      this.clearBurstTimer();
    }

    this.startSessionStream();
  }

  requestBurst(reason = "manual", durationMs = SESSION_BURST_DURATION_MS) {
    if (this.sessionSubscriptionMode === "continuous") {
      this.log.debug(
        `[${this.getConfigName()}] Skipping session burst request (${reason}): continuous polling active`
      );
      return;
    }

    this.log.debug(
      `[${this.getConfigName()}] Requesting Jellyfinemby session burst (${reason}) for ${durationMs}ms`
    );
    this.setMode("burst");
    this.scheduleBurstStop(durationMs);
  }

  setContinuous(enabled: boolean) {
    if (enabled) {
      if (this.sessionSubscriptionMode === "continuous") {
        return;
      }
      this.log.info(`[${this.getConfigName()}] Enabling continuous Jellyfinemby session polling`);
      this.clearBurstTimer();
      this.setMode("continuous");
      return;
    }

    if (this.sessionSubscriptionMode === "continuous") {
      this.log.info(`[${this.getConfigName()}] Disabling continuous Jellyfinemby session polling`);
      this.setMode("idle");
    }
  }

  /**
   * Called when the transport becomes ready/disconnected so the subscription
   * state can resync (start/stop the session stream as needed).
   */
  syncWithTransport() {
    if (this.sessionSubscriptionMode === "idle") {
      this.stopSessionStream();
    } else {
      this.startSessionStream();
    }
  }

  /** Transport closed - reset active-stream flag. */
  markTransportClosed() {
    this.sessionStreamActive = false;
  }

  dispose() {
    this.setMode("idle");
    this.clearBurstTimer();
  }

  private scheduleBurstStop(durationMs: number) {
    if (!this.sessionStreamActive) {
      this.pendingBurstDuration = durationMs;
      return;
    }

    this.pendingBurstDuration = null;
    this.clearBurstTimer();
    this.sessionBurstTimer = setTimeout(() => {
      this.sessionBurstTimer = null;
      if (this.sessionSubscriptionMode === "burst") {
        this.log.debug("Jellyfinemby session burst window elapsed, stopping session polling");
        this.setMode("idle");
      }
    }, durationMs);
  }

  private clearBurstTimer() {
    if (this.sessionBurstTimer) {
      clearTimeout(this.sessionBurstTimer);
      this.sessionBurstTimer = null;
    }
  }

  private startSessionStream() {
    if (this.sessionStreamActive) {
      return;
    }

    this.ensureConnected();
    if (!this.transport.isOpen()) {
      this.log.debug("Deferring Jellyfinemby SessionsStart until WebSocket is ready");
      return;
    }

    this.log.debug("Starting Jellyfinemby session polling");
    this.transport.sendMessage({
      MessageType: "SessionsStart",
      Data: SESSION_POLL_CONFIG
    });
    this.sessionStreamActive = true;

    if (this.sessionSubscriptionMode === "burst" && this.pendingBurstDuration !== null) {
      const duration = this.pendingBurstDuration;
      // scheduleBurstStop will clear pendingBurstDuration when the timer starts
      this.scheduleBurstStop(duration);
    }
  }

  private stopSessionStream() {
    if (!this.sessionStreamActive) {
      return;
    }

    if (this.transport.isOpen()) {
      this.log.debug("Stopping Jellyfinemby session polling");
      this.transport.sendMessage({ MessageType: "SessionsStop" });
    }
    this.sessionStreamActive = false;
  }
}
