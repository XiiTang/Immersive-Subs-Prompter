import { Logger } from "../../shared/Logger.js";

export class DashboardBridge {
  constructor({ snapshotBuilder, endpointManager, logger = new Logger("dashboard") }) {
    this.snapshotBuilder = snapshotBuilder;
    this.endpointManager = endpointManager;
    this.logger = logger;
    this.dashboardPorts = new Set();
  }

  handlePort(port) {
    this.logger.info("conn", `Dashboard Connected (total: ${this.dashboardPorts.size + 1})`);
    this.dashboardPorts.add(port);
    this.sendSnapshotToPort(port);
    port.onMessage.addListener((message) => this.handleMessage(port, message));
    port.onDisconnect.addListener(() => this.handleDisconnect(port));
  }

  handleMessage(port, message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "server-endpoints:get") {
      this.sendSnapshotToPort(port);
    } else if (message.type === "server-endpoints:add" && typeof message.endpoint === "string") {
      this.endpointManager.add(message.endpoint);
    } else if (message.type === "server-endpoints:remove" && typeof message.endpoint === "string") {
      this.endpointManager.remove(message.endpoint);
    } else if (message.type === "server-endpoints:set" && Array.isArray(message.endpoints)) {
      this.endpointManager.set(message.endpoints);
    }
  }

  handleDisconnect(port) {
    this.logger.info("conn", `Dashboard Disconnected (total: ${this.dashboardPorts.size - 1})`);
    this.dashboardPorts.delete(port);
  }

  sendSnapshotToPort(port) {
    try {
      port.postMessage({
        type: "media-state-snapshot",
        payload: this.snapshotBuilder.buildSnapshot()
      });
    } catch (err) {
      this.logger.error("dashboard", "Failed to send dashboard snapshot", err);
    }
  }

  broadcastSnapshot() {
    if (!this.dashboardPorts.size) return;
    const snapshot = {
      type: "media-state-snapshot",
      payload: this.snapshotBuilder.buildSnapshot()
    };
    this.dashboardPorts.forEach((port) => {
      try {
        port.postMessage(snapshot);
      } catch (err) {
        this.logger.warn("dashboard", "Failed to reach dashboard port", err);
        this.dashboardPorts.delete(port);
      }
    });
  }
}
