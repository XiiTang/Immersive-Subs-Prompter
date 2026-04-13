import { CONTENT_PORT } from "../shared/constants";
import { RECONNECT_DELAY_MS } from "../content/constants";
import { log, state } from "../content/state";
import type { BackgroundToContentMessage } from "../shared/types";

let handleMessage: ((message: BackgroundToContentMessage) => void) | null = null;
let handleReconnect: (() => void) | null = null;

export function setPortHandlers({
  onMessage,
  onReconnect
}: {
  onMessage?: (message: BackgroundToContentMessage) => void;
  onReconnect?: () => void;
} = {}) {
  handleMessage = typeof onMessage === "function" ? onMessage : null;
  handleReconnect = typeof onReconnect === "function" ? onReconnect : null;
}

export function schedulePortReconnect() {
  if (!state.monitoringActive) {
    return;
  }
  if (state.reconnectTimer) return;
  log.info("conn", `Reconnecting... ${RECONNECT_DELAY_MS}ms`);
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    connectPort();
  }, RECONNECT_DELAY_MS);
}

export function connectPort() {
  if (!state.monitoringActive) {
    return null;
  }
  if (state.port) return state.port;

  let nextPort: chrome.runtime.Port;
  try {
    nextPort = chrome.runtime.connect({ name: CONTENT_PORT });
    log.info("conn", "Connected", { url: location.href });
  } catch (err) {
    log.error("conn", "Connection failed", err);
    schedulePortReconnect();
    return null;
  }

  nextPort.onMessage.addListener((message: BackgroundToContentMessage) => {
    if (state.monitoringActive && handleMessage) {
      handleMessage(message);
    }
  });

  nextPort.onDisconnect.addListener(() => {
    if (state.port === nextPort) {
      state.port = null;
      log.info("conn", "Disconnected");
    }
    if (state.monitoringActive) {
      schedulePortReconnect();
    }
  });

  state.port = nextPort;
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  if (handleReconnect) {
    handleReconnect();
  }

  return nextPort;
}

export function disconnectPort() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.port) {
    try {
      state.port.disconnect();
    } catch (err) {
      log.warn("conn", "Failed to disconnect port", err);
    }
    state.port = null;
  }
}
