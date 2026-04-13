import { normalizeEndpointList } from "../../shared/endpoint-utils";
import type { DesktopConnectionSnapshot, DesktopInboundMessage, DesktopOutboundEnvelope } from "../../shared/types";
import { DesktopConnection } from "./DesktopConnection";

export class DesktopConnectionPool {
  onDesktopMessage?: (message: DesktopInboundMessage, sourceEndpoint: string) => void;
  onStatusChange?: (snapshot: DesktopConnectionSnapshot[]) => void;
  connections: Map<string, DesktopConnection>;

  constructor(
    onDesktopMessage?: (message: DesktopInboundMessage, sourceEndpoint: string) => void,
    onStatusChange?: (snapshot: DesktopConnectionSnapshot[]) => void
  ) {
    this.onDesktopMessage = onDesktopMessage;
    this.onStatusChange = onStatusChange;
    this.connections = new Map();
  }

  setEndpoints(endpoints: string[]) {
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

  broadcast(payload: Omit<DesktopOutboundEnvelope, "source" | "sentAt">) {
    for (const connection of this.connections.values()) {
      connection.send(payload);
    }
  }

  describe(): DesktopConnectionSnapshot[] {
    return Array.from(this.connections.values()).map((conn) => conn.getSnapshot());
  }
}
