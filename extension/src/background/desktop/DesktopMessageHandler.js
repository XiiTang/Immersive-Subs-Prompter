import { Logger } from "../../shared/Logger.js";

export function createDesktopMessageHandler({ tabRegistry, logger = new Logger("desktop-handler") }) {
  return function handleDesktopMessage(message, endpoint) {
    if (!message || typeof message !== "object") return;
    if (message.source !== "usp-desktop") return;

    if (message.type === "control-command" && typeof message.tabId === "number") {
      const frameId = tabRegistry.getPreferredFrameId(message.tabId);
      logger.info("ctrl", `Desktop command: ${message.action}`, { tabId: message.tabId, frameId, endpoint });
      const port = tabRegistry.getPort(message.tabId, frameId);
      if (!port) {
        logger.warn("msg", `Tab${message.tabId} No port`, { preferredFrameId: frameId });
        return;
      }
      try {
        logger.debug("msg", `Tab${message.tabId} ->control`, { frameId });
        port.postMessage({
          type: "control",
          action: message.action,
          payload: message.payload || {}
        });
      } catch (err) {
        logger.error("msg", `Tab${message.tabId} Send failed`, err);
      }
    }
  };
}
