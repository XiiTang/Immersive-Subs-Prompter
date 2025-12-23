import { log, state } from "../content/state.js";

export function ensureUrlWatcher(onUrlChanged) {
  if (state.urlMonitorTimer !== null) {
    return;
  }
  const tick = () => {
    if (state.lastPageUrl !== location.href) {
      state.lastPageUrl = location.href;
      log.info("page", "URL changed", { url: state.lastPageUrl, title: document.title });
      if (onUrlChanged) {
        onUrlChanged(state.lastPageUrl, document.title);
      }
    }
    state.urlMonitorTimer = window.setTimeout(tick, 1000);
  };
  state.urlMonitorTimer = window.setTimeout(tick, 1000);
}

export function stopUrlWatcher() {
  if (state.urlMonitorTimer !== null) {
    clearTimeout(state.urlMonitorTimer);
    state.urlMonitorTimer = null;
  }
}
