import { KEEPALIVE_INTERVAL_MS } from "../content/constants.js";
import { log, state } from "../content/state.js";
import { connectPort, schedulePortReconnect } from "./PortManager.js";

export function send(type, payload = {}) {
  if (!state.monitoringActive) {
    return;
  }
  const channel = state.port || connectPort();
  if (!channel) {
    log.warn("msg", `Send failed: ${type} (no connection)`);
    return;
  }
  try {
    log.debug("msg", `->${type}`, payload);
    channel.postMessage({ type, payload });
  } catch (err) {
    log.error("msg", `Send failed: ${type}`, err);
    if (state.port === channel) {
      state.port = null;
    }
    schedulePortReconnect();
  }
}

export function startKeepAlive() {
  if (state.keepAliveTimer !== null || !state.monitoringActive) {
    return;
  }
  const tick = () => {
    if (!state.monitoringActive) {
      stopKeepAlive();
      return;
    }
    send("keepalive", {
      pageUrl: location.href,
      title: document.title,
      timestamp: Date.now()
    });
    state.keepAliveTimer = window.setTimeout(tick, KEEPALIVE_INTERVAL_MS);
  };
  state.keepAliveTimer = window.setTimeout(tick, KEEPALIVE_INTERVAL_MS);
}

export function stopKeepAlive() {
  if (state.keepAliveTimer !== null) {
    clearTimeout(state.keepAliveTimer);
    state.keepAliveTimer = null;
  }
}
