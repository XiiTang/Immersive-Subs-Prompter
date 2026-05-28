import { log, state } from "../content/state";
import { connectPort, schedulePortReconnect } from "./PortManager";
import type { ContentToBackgroundMessage } from "../shared/types";

type ContentMessageType = ContentToBackgroundMessage["type"];
type PayloadFor<Type extends ContentMessageType> = Extract<ContentToBackgroundMessage, { type: Type }>["payload"];

export function send<Type extends ContentMessageType>(type: Type, payload: PayloadFor<Type>) {
  postMessage(type, payload);
}

function postMessage<Type extends ContentMessageType>(type: Type, payload: PayloadFor<Type>) {
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
