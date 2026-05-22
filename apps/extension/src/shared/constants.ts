export const BLACKLIST_STORAGE_KEY = "uspBlacklistRules";
export const ENDPOINTS_STORAGE_KEY = "uspServerEndpoints";
export const APPEARANCE_STORAGE_KEY = "usp.appearance.theme";
export const CONTENT_PORT = "usp-video-channel";
export const DASHBOARD_PORT = "usp-dashboard";

export type StorageKey =
  | typeof BLACKLIST_STORAGE_KEY
  | typeof ENDPOINTS_STORAGE_KEY
  | typeof APPEARANCE_STORAGE_KEY;
