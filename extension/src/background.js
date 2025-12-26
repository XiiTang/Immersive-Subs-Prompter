import { Logger } from "./shared/Logger.js";
import { CONTENT_PORT, DASHBOARD_PORT, ENDPOINTS_STORAGE_KEY } from "./shared/constants.js";

import { DesktopConnectionPool } from "./background/desktop/DesktopConnectionPool.js";
import { createDesktopMessageHandler } from "./background/desktop/DesktopMessageHandler.js";
import { TabRegistry } from "./background/tabs/TabRegistry.js";
import { MediaStateStore } from "./background/tabs/MediaStateStore.js";
import { EndpointManager } from "./background/endpoints/EndpointManager.js";
import { SnapshotBuilder } from "./background/messaging/SnapshotBuilder.js";
import { ContentMessageRouter } from "./background/messaging/ContentMessageRouter.js";
import { DashboardBridge } from "./background/dashboard/DashboardBridge.js";

const DEFAULT_ENDPOINTS = ["ws://127.0.0.1:44501"];

const logger = new Logger("background");
const tabRegistry = new TabRegistry({ logger });
const mediaStateStore = new MediaStateStore({
  logger,
  onChange: () => broadcastMediaSnapshot()
});
let dashboardBridge = null;

function broadcastMediaSnapshot() {
  dashboardBridge?.broadcastSnapshot();
}

const desktopMessageHandler = createDesktopMessageHandler({ tabRegistry, logger });

const connectionPool = new DesktopConnectionPool(
  (message, sourceEndpoint) => desktopMessageHandler(message, sourceEndpoint),
  () => broadcastMediaSnapshot()
);

const endpointManager = new EndpointManager({
  logger,
  storageKey: ENDPOINTS_STORAGE_KEY,
  defaultEndpoints: DEFAULT_ENDPOINTS,
  onChange: (endpoints) => {
    connectionPool.setEndpoints(endpoints);
    broadcastMediaSnapshot();
  }
});

const snapshotBuilder = new SnapshotBuilder({
  mediaStateStore,
  connectionPool,
  getEndpoints: () => endpointManager.getEndpoints(),
  logger
});

dashboardBridge = new DashboardBridge({
  logger,
  snapshotBuilder,
  endpointManager
});

const contentMessageRouter = new ContentMessageRouter({
  logger,
  tabRegistry,
  mediaStateStore,
  connectionPool,
  snapshotBuilder
});

endpointManager.load().then((endpoints) => {
  endpointManager.set(endpoints, { persist: false, fallbackToDefault: true });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === CONTENT_PORT) {
    contentMessageRouter.handlePort(port);
  } else if (port.name === DASHBOARD_PORT) {
    dashboardBridge.handlePort(port);
  }
});
