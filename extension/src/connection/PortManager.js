import { CONTENT_PORT } from "../shared/constants.js";
import { RECONNECT_DELAY_MS } from "../content/constants.js";
import { log, state } from "../content/state.js";

let handleMessage = null;
let handleReconnect = null;

export function setPortHandlers({ onMessage, onReconnect } = {}) {
  handleMessage = typeof onMessage === "function" ? onMessage : null;
  handleReconnect = typeof onReconnect === "function" ? onReconnect : null;
}

export function getPort() {
  return state.port;
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

  let nextPort = null;
  try {
    nextPort = chrome.runtime.connect({ name: CONTENT_PORT });
    log.info("conn", "Connected", { url: location.href });
  } catch (err) {
    log.error("conn", "Connection failed", err);
    schedulePortReconnect();
    return null;
  }

  nextPort.onMessage.addListener((message) => {
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
