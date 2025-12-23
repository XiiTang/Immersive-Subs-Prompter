import { log, state } from "./state.js";
import { setPortHandlers, connectPort, disconnectPort } from "../connection/PortManager.js";
import { send, startKeepAlive, stopKeepAlive } from "../connection/MessageSender.js";
import { ensureUrlWatcher } from "../monitoring/URLWatcher.js";
import { prepareDomMonitoring, setDomCallbacks, startDOMObserver, stopDOMObserver } from "../monitoring/DOMObserver.js";
import { stopDriftMonitor } from "../monitoring/DriftMonitor.js";
import { ensurePrototypeHooks, endActiveVideoSession, handleDocumentMediaEvent } from "../video/VideoDetector.js";
import { applyControl } from "../video/ControlHandler.js";
import { clearLoopState } from "../video/LoopController.js";
import { gatherVideoState, handleTimeUpdate, resetPlaybackPrediction } from "../video/VideoStateGatherer.js";
import { evaluateCurrentUrl, handleStorageChange, loadBlacklistRules, setBlacklistRules } from "../blacklist/BlacklistManager.js";

function handlePortMessage(message) {
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
  stopDOMObserver();
  disconnectPort();
}

function handleUrlChanged(url, title) {
  if (state.monitoringActive) {
    send("page-url-changed", { pageUrl: url, title });
  }
  const result = evaluateCurrentUrl();
  if (!result.changed) {
    return;
  }
  if (result.blocked) {
    log.info("blacklist", "Current page is blacklisted, stopping detection", { url: location.href });
    stopMonitoring();
  } else {
    log.info("blacklist", "Current page removed from blacklist, resuming detection", { url: location.href });
    startMonitoring();
  }
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
    log.info("blacklist", "Current page is blacklisted, skipping detection", { url: location.href });
  } else {
    startMonitoring();
  }

  ensureUrlWatcher(handleUrlChanged);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  const result = handleStorageChange(changes, areaName);
  if (!result) {
    return;
  }
  if (!result.changed) {
    return;
  }
  if (result.blocked) {
    log.info("blacklist", "Current page is blacklisted, stopping detection", { url: location.href });
    stopMonitoring();
  } else {
    log.info("blacklist", "Current page removed from blacklist, resuming detection", { url: location.href });
    startMonitoring();
  }
});

["beforeunload", "unload"].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    stopDriftMonitor();
  });
});

bootstrap();
