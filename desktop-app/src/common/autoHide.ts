export const AUTO_HIDE_ZONE_MIN = 80;
export const AUTO_HIDE_ZONE_MAX = 600;
export const DEFAULT_AUTO_HIDE_ZONE_HEIGHT = 300;
export const AUTO_HIDE_MOUSE_LEAVE_DELAY_MIN = 0;
export const AUTO_HIDE_MOUSE_LEAVE_DELAY_MAX = 5000;
export const LEGACY_AUTO_HIDE_MOUSE_LEAVE_DELAY_MS = 600;
export const DEFAULT_AUTO_HIDE_MOUSE_LEAVE_DELAY_MS = 1000;

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

export function clampAutoHideMouseLeaveDelay(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_AUTO_HIDE_MOUSE_LEAVE_DELAY_MS;
  }
  if (value < AUTO_HIDE_MOUSE_LEAVE_DELAY_MIN) {
    return AUTO_HIDE_MOUSE_LEAVE_DELAY_MIN;
  }
  if (value > AUTO_HIDE_MOUSE_LEAVE_DELAY_MAX) {
    return AUTO_HIDE_MOUSE_LEAVE_DELAY_MAX;
  }
  return Math.round(value);
}
