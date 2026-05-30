import { MEDIA_EVENTS } from "../content/constants";
import { log, state } from "../content/state";
import { swallow } from "../shared/reportError";

let mediaEventHandler: EventListener | null = null;
let videoRemovedHandler: (() => void) | null = null;

export function setDomCallbacks({
  onMediaEvent,
  onVideoRemoved
}: {
  onMediaEvent?: EventListener;
  onVideoRemoved?: () => void;
} = {}) {
  mediaEventHandler = typeof onMediaEvent === "function" ? onMediaEvent : null;
  videoRemovedHandler = typeof onVideoRemoved === "function" ? onVideoRemoved : null;
}

function ensureDocListeners(target: Document | ShadowRoot | null) {
  if (!target || typeof target.addEventListener !== "function" || state.observedDocs.has(target)) return;
  if (!mediaEventHandler) return;
  state.observedDocs.add(target);
  MEDIA_EVENTS.forEach((eventName) => {
    target.addEventListener(eventName, mediaEventHandler as EventListener, { capture: true, passive: true });
  });
}

function getShadowRoot(element: Element | null): ShadowRoot | null {
  if (!element) return null;
  if (typeof chrome !== "undefined" && chrome.dom && chrome.dom.openOrClosedShadowRoot) {
    try {
      return chrome.dom.openOrClosedShadowRoot(element as HTMLElement);
    } catch (err) {
      swallow(err, "dom.shadowRoot", "chrome.dom unavailable; falling back to element.shadowRoot");
    }
  }
  return element.shadowRoot;
}

function scanForShadowRoots(root: ParentNode | null = document.body) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const elements = root.querySelectorAll("*");
  elements.forEach((element) => {
    const shadowRoot = getShadowRoot(element);
    if (shadowRoot && !state.observedDocs.has(shadowRoot)) {
      log.info("shadow", "Found Shadow DOM", { host: element.tagName });
      ensureDocListeners(shadowRoot);
      scanForShadowRoots(shadowRoot);
    }
  });
}

export function observeShadowRoot(shadowRoot: ShadowRoot) {
  ensureDocListeners(shadowRoot);
  scanForShadowRoots(shadowRoot);
}

function findVideosInNode(node: Node | null): HTMLVideoElement[] {
  const videos: HTMLVideoElement[] = [];
  if (!node) return videos;
  if (node instanceof HTMLVideoElement) {
    videos.push(node);
  }
  if (node instanceof Element || node instanceof DocumentFragment) {
    node.querySelectorAll("video").forEach((video) => videos.push(video));
  }
  if (node instanceof Element) {
    const shadowRoot = getShadowRoot(node);
    if (shadowRoot && typeof shadowRoot.querySelectorAll === "function") {
      shadowRoot.querySelectorAll("video").forEach((video) => videos.push(video));
    }
  }
  return videos;
}

function handleRemovedNode(node: Node) {
  if (!(node instanceof Element) && !(node instanceof DocumentFragment)) {
    return;
  }

  const videos = findVideosInNode(node);
  videos.forEach((video) => {
    const schedule = typeof requestAnimationFrame === "function"
      ? (fn: FrameRequestCallback) => requestAnimationFrame(fn)
      : (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0);
    schedule(() => {
      if (videoRemovedHandler && video === state.activeVideo && !video.isConnected) {
        videoRemovedHandler();
      }
    });
  });
}

export function startDOMObserver() {
  if (state.domObserver) {
    return state.domObserver;
  }

  const observer = new MutationObserver((mutations) => {
    if (!state.monitoringActive) return;

    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => handleRemovedNode(node));

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const shadowRoot = getShadowRoot(element);
          if (shadowRoot && !state.observedDocs.has(shadowRoot)) {
            log.info("shadow", "New Shadow DOM detected via mutation", { host: element.tagName });
            observeShadowRoot(shadowRoot);
          }
          scanForShadowRoots(element);
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  state.domObserver = observer;
  return observer;
}

export function stopDOMObserver() {
  if (state.domObserver) {
    state.domObserver.disconnect();
    state.domObserver = null;
  }
}

export function prepareDomMonitoring() {
  ensureDocListeners(document);
  log.info("shadow", "Scanning for existing Shadow DOMs...");
  scanForShadowRoots();
}
