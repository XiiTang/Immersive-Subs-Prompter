import { Logger } from "./shared/Logger";
import { CONTENT_PORT, DASHBOARD_PORT, ENDPOINTS_STORAGE_KEY } from "./shared/constants";

import { DesktopConnectionPool } from "./background/desktop/DesktopConnectionPool";
import { createDesktopMessageHandler } from "./background/desktop/DesktopMessageHandler";
import { sendCurrentMediaContext } from "./background/desktop/reconnectMediaSync";
import { TabRegistry } from "./background/tabs/TabRegistry";
import { MediaStateStore } from "./background/tabs/MediaStateStore";
import { EndpointManager } from "./background/endpoints/EndpointManager";
import { SnapshotBuilder } from "./background/messaging/SnapshotBuilder";
import { ContentMessageRouter } from "./background/messaging/ContentMessageRouter";
import { DashboardBridge } from "./background/dashboard/DashboardBridge";

const DEFAULT_ENDPOINTS = ["ws://127.0.0.1:44501"];

const logger = new Logger("background");
const tabRegistry = new TabRegistry({ logger: undefined });
const mediaStateStore = new MediaStateStore({
  logger,
  onChange: () => broadcastMediaSnapshot()
});
let dashboardBridge: DashboardBridge | null = null;

function broadcastMediaSnapshot() {
  dashboardBridge?.broadcastSnapshot();
}

const desktopMessageHandler = createDesktopMessageHandler({ tabRegistry, logger });

const connectionPool = new DesktopConnectionPool(
  (message, sourceEndpoint) => {
    if (message.type === "control-command") {
      desktopMessageHandler(message, sourceEndpoint);
    }
  },
  () => broadcastMediaSnapshot(),
  (connection) => sendCurrentMediaContext(connection, mediaStateStore)
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
  endpointManager.set(endpoints, { persist: false });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === CONTENT_PORT) {
    contentMessageRouter.handlePort(port);
  } else if (port.name === DASHBOARD_PORT) {
    dashboardBridge.handlePort(port);
  }
});
