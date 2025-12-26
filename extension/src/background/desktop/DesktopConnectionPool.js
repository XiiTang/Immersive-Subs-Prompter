import { normalizeEndpointList } from "../../shared/endpoint-utils.js";
import { DesktopConnection } from "./DesktopConnection.js";

export class DesktopConnectionPool {
  constructor(onDesktopMessage, onStatusChange) {
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.connections = new Map();
  }

  setEndpoints(endpoints) {
    const normalized = normalizeEndpointList(endpoints);
    const nextSet = new Set(normalized);

    for (const [endpoint, conn] of this.connections.entries()) {
      if (!nextSet.has(endpoint)) {
        conn.destroy();
        this.connections.delete(endpoint);
      }
    }

    normalized.forEach((endpoint) => {
      if (this.connections.has(endpoint)) {
        return;
      }
      const conn = new DesktopConnection(
        endpoint,
        (message, sourceEndpoint) => this.onDesktopMessage?.(message, sourceEndpoint),
        () => this.onStatusChange?.(this.describe())
      );
      this.connections.set(endpoint, conn);
      conn.connect();
    });

    this.onStatusChange?.(this.describe());
  }

  broadcast(payload) {
    for (const connection of this.connections.values()) {
      connection.send(payload);
    }
  }

  describe() {
    return Array.from(this.connections.values()).map((conn) => conn.getSnapshot());
  }
}
