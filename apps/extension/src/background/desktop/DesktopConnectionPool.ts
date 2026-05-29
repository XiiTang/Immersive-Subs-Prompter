import { normalizeEndpointList } from "@immersive-subs/contracts";
import type { DesktopConnectionSnapshot } from "../../shared/types";
import type { FromExtensionBroadcastMessage, ToExtensionMessage } from "@immersive-subs/contracts";
import { DesktopConnection } from "./DesktopConnection";

type WithoutTransportEnvelope<T> = T extends unknown ? Omit<T, "source" | "sentAt"> : never;
type DesktopBroadcastPayload = WithoutTransportEnvelope<FromExtensionBroadcastMessage>;

export class DesktopConnectionPool {
  onDesktopMessage?: (message: ToExtensionMessage, sourceEndpoint: string) => void;
  onStatusChange?: (snapshot: DesktopConnectionSnapshot[]) => void;
  connections: Map<string, DesktopConnection>;

  constructor(
    onDesktopMessage?: (message: ToExtensionMessage, sourceEndpoint: string) => void,
    onStatusChange?: (snapshot: DesktopConnectionSnapshot[]) => void,
    private readonly onConnectionOpen?: (connection: DesktopConnection) => void
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
        () => this.onStatusChange?.(this.describe()),
        (connection) => this.onConnectionOpen?.(connection)
      );
      this.connections.set(endpoint, conn);
      conn.connect();
    });

    this.onStatusChange?.(this.describe());
  }

  broadcast(payload: DesktopBroadcastPayload) {
    for (const connection of this.connections.values()) {
      connection.send(payload);
    }
  }

  describe(): DesktopConnectionSnapshot[] {
    return Array.from(this.connections.values()).map((conn) => conn.getSnapshot());
  }
}
