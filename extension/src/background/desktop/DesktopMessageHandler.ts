import { Logger } from "../../shared/Logger";
import type { ControlMessage, DesktopControlCommandMessage } from "../../shared/types";
import type { TabRegistry } from "../tabs/TabRegistry";

export function createDesktopMessageHandler({
  tabRegistry,
  logger = new Logger("desktop-handler")
}: {
  tabRegistry: TabRegistry;
  logger?: Logger;
}) {
  return function handleDesktopMessage(message: DesktopControlCommandMessage, endpoint: string) {
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
        const controlMessage: ControlMessage = {
          type: "control",
          action: message.action,
          payload: message.payload || {}
        };
        port.postMessage(controlMessage);
      } catch (err) {
        logger.error("msg", `Tab${message.tabId} Send failed`, err);
      }
    }
  };
}
