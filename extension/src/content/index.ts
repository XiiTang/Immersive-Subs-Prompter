import { log, state } from "./state";
import { setPortHandlers, connectPort, disconnectPort } from "../connection/PortManager";
import { send, startKeepAlive, stopKeepAlive } from "../connection/MessageSender";
import { ensureUrlWatcher, stopUrlWatcher } from "../monitoring/URLWatcher";
import { prepareDomMonitoring, setDomCallbacks, startDOMObserver, stopDOMObserver } from "../monitoring/DOMObserver";
import { stopDriftMonitor } from "../monitoring/DriftMonitor";
import { ensurePrototypeHooks, endActiveVideoSession, handleDocumentMediaEvent } from "../video/VideoDetector";
import { applyControl } from "../video/ControlHandler";
import { clearLoopState } from "../video/LoopController";
import { gatherVideoState, handleTimeUpdate, resetPlaybackPrediction } from "../video/VideoStateGatherer";
import { evaluateCurrentUrl, handleStorageChange, loadBlacklistRules, setBlacklistRules } from "../blacklist/BlacklistManager";
import type { BackgroundToContentMessage } from "../shared/types";

function handlePortMessage(message: BackgroundToContentMessage) {
  if (!state.monitoringActive || !message || typeof message !== "object") return;
  log.debug("msg", `<-${message.type}`, message);
  if (message.type === "control") {
    applyControl(message.action, message.payload || {});
  }
}

function handlePortReconnect() {
  if (state.activeVideo) {
    log.info("conn", "Reconnected successfully, syncing video state");
    send("video-context", gatherVideoState(state.activeVideo));
    handleTimeUpdate(state.activeVideo);
  }
}

function startMonitoring() {
  if (state.monitoringActive || state.isPageBlacklisted) {
    return;
  }
  state.monitoringActive = true;

  ensureUrlWatcher(handleUrlChanged);
  ensurePrototypeHooks();
  connectPort();
  prepareDomMonitoring();
  startDOMObserver();
  startKeepAlive();
}

function stopMonitoring() {
  if (!state.monitoringActive) {
    return;
  }
  state.monitoringActive = false;
  clearLoopState();
  stopDriftMonitor();
  resetPlaybackPrediction();
  state.activeVideo = null;

  stopKeepAlive();
  stopUrlWatcher();
  stopDOMObserver();
  disconnectPort();
}

function handleBlacklistStatusChange(result: { blocked: boolean; changed: boolean } | null, context = "change") {
  if (!result || !result.changed) {
    return;
  }
  if (result.blocked) {
    log.info("blacklist", `Page blacklisted (${context}), stopping detection`, { url: location.href });
    stopMonitoring();
  } else {
    log.info("blacklist", `Page unblacklisted (${context}), resuming detection`, { url: location.href });
    startMonitoring();
  }
}

function handleUrlChanged(url: string, title: string) {
  if (state.monitoringActive) {
    send("page-url-changed", { pageUrl: url, title });
  }
  handleBlacklistStatusChange(evaluateCurrentUrl(), "url-change");
}

async function bootstrap() {
  setPortHandlers({ onMessage: handlePortMessage, onReconnect: handlePortReconnect });
  setDomCallbacks({
    onMediaEvent: handleDocumentMediaEvent,
    onVideoRemoved: () => endActiveVideoSession("removed-from-dom")
  });

  try {
    const raw = await loadBlacklistRules();
    setBlacklistRules(raw);
  } catch (error) {
    log.logError("blacklist", "Failed to init blacklist", error);
    setBlacklistRules([]);
  }

  const status = evaluateCurrentUrl();
  if (status.blocked) {
    log.info("blacklist", "Page blacklisted (init), skipping detection", { url: location.href });
  } else {
    startMonitoring();
  }

  ensureUrlWatcher(handleUrlChanged);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  handleBlacklistStatusChange(handleStorageChange(changes, areaName), "storage-change");
});

["beforeunload", "unload"].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    stopDriftMonitor();
  });
});

bootstrap();
