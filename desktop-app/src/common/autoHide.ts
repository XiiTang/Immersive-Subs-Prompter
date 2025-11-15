export const AUTO_HIDE_ZONE_MIN = 80;
export const AUTO_HIDE_ZONE_MAX = 600;
export const DEFAULT_AUTO_HIDE_ZONE_HEIGHT = 300;

export function clampAutoHideZoneHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_AUTO_HIDE_ZONE_HEIGHT;
  }
  if (value < AUTO_HIDE_ZONE_MIN) {
    return AUTO_HIDE_ZONE_MIN;
  }
  if (value > AUTO_HIDE_ZONE_MAX) {
    return AUTO_HIDE_ZONE_MAX;
  }
  return Math.round(value);
}
