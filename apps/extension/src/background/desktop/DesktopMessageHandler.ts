import { Logger } from "../../shared/Logger";
import type { ControlMessage } from "../../shared/types";
import type { ToExtensionMessage } from "@immersive-subs/contracts";
import type { TabRegistry } from "../tabs/TabRegistry";

export function createDesktopMessageHandler({
  tabRegistry,
  logger = new Logger("desktop-handler")
}: {
  tabRegistry: TabRegistry;
  logger?: Logger;
}) {
  return function handleDesktopMessage(message: ToExtensionMessage, endpoint: string) {
    if (!message || typeof message !== "object") return;
    if (message.source !== "usp-desktop") return;

    if (message.type !== "control-command" || typeof message.tabId !== "number") {
      return;
    }

    const frameId = tabRegistry.getPreferredFrameId(message.tabId);
    logger.info("ctrl", `Desktop command: ${message.action}`, { tabId: message.tabId, frameId, endpoint });
    const port = tabRegistry.getPort(message.tabId, frameId);
    if (!port) {
      logger.warn("msg", `Tab${message.tabId} No port`, { preferredFrameId: frameId });
      return;
    }

    let controlMessage: ControlMessage;
    switch (message.action) {
      case "seek":
        controlMessage = { type: "control", action: "seek", payload: message.payload };
        break;
      case "loop":
        controlMessage = { type: "control", action: "loop", payload: message.payload };
        break;
      case "pause":
      case "play":
      case "stopLoop":
        controlMessage = { type: "control", action: message.action };
        break;
    }

    try {
      logger.debug("msg", `Tab${message.tabId} ->control`, { frameId });
      port.postMessage(controlMessage);
    } catch (err) {
      logger.error("msg", `Tab${message.tabId} Send failed`, err);
    }
  };
}
