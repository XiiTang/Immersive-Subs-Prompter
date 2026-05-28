import { KEEPALIVE_INTERVAL_MS } from "../content/constants";
import { log, state } from "../content/state";
import { connectPort, schedulePortReconnect } from "./PortManager";
import type { ContentToBackgroundMessage } from "../shared/types";

type ContentMessageType = ContentToBackgroundMessage["type"];
type PayloadFor<Type extends ContentMessageType> = Extract<ContentToBackgroundMessage, { type: Type }>["payload"];
type KeepalivePayload = {
  pageUrl: string;
  title: string;
  timestamp: number;
};

export function send<Type extends ContentMessageType>(type: Type, payload: PayloadFor<Type>) {
  postMessage(type, payload);
}

function sendKeepalive(payload: KeepalivePayload) {
  postMessage("keepalive", payload);
}

function postMessage(type: ContentMessageType | "keepalive", payload: unknown) {
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
    sendKeepalive({
      pageUrl: location.href,
      title: document.title,
      timestamp: Date.now()
    });
    state.keepAliveTimer = setTimeout(tick, KEEPALIVE_INTERVAL_MS);
  };
  state.keepAliveTimer = setTimeout(tick, KEEPALIVE_INTERVAL_MS);
}

export function stopKeepAlive() {
  if (state.keepAliveTimer !== null) {
    clearTimeout(state.keepAliveTimer);
    state.keepAliveTimer = null;
  }
}
