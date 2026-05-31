import { networkEndpointKey } from "@immersive-subs/contracts";
import type { NetworkSettings } from "./types.js";

export function areNetworkSettingsEqual(a: NetworkSettings, b: NetworkSettings): boolean {
  if (a.authToken !== b.authToken || a.endpoints.length !== b.endpoints.length) {
    return false;
  }
  return a.endpoints.every((endpoint, index) => {
    const other = b.endpoints[index];
    return !!other && endpoint.id === other.id && networkEndpointKey(endpoint) === networkEndpointKey(other);
  });
}
