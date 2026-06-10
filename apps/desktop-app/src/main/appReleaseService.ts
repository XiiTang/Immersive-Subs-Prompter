import type { AppSettings } from "./types.js";
import {
  compareReleaseVersions,
  getDesktopPlatformKey,
  RELEASE_MANIFEST_URL,
  selectDesktopArtifact,
  validateReleaseManifest,
  type ReleaseState
} from "./releases/releaseManifest.js";

const UPDATE_AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type AppReleaseServiceOptions = {
  getCurrentVersion: () => string;
  getSettings: () => AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => AppSettings;
  fetchManifest?: () => Promise<unknown>;
  openExternal: (url: string) => Promise<void>;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  now?: () => number;
  onStateChange?: (state: ReleaseState) => void;
};

export class AppReleaseService {
  private readonly fetchManifest: () => Promise<unknown>;
  private readonly now: () => number;
  private state: ReleaseState;

  constructor(private readonly options: AppReleaseServiceOptions) {
    this.fetchManifest = options.fetchManifest ?? fetchReleaseManifest;
    this.now = options.now ?? Date.now;
    this.state = {
      status: "idle",
      currentVersion: options.getCurrentVersion(),
      latestVersion: null,
      checkedAt: null,
      manifest: null,
      platformKey: getDesktopPlatformKey(options.platform, options.arch),
      platformArtifact: null,
      error: null
    };
  }

  getState(): ReleaseState {
    return this.state;
  }

  async maybeCheckAutomatically(): Promise<ReleaseState> {
    const settings = this.options.getSettings().global;
    if (!settings.autoCheckUpdates) {
      return this.state;
    }
    if (settings.lastUpdateCheckAt !== null && this.now() - settings.lastUpdateCheckAt < UPDATE_AUTO_CHECK_INTERVAL_MS) {
      return this.state;
    }
    return this.checkForUpdates();
  }

  async checkForUpdates(): Promise<ReleaseState> {
    const currentVersion = this.options.getCurrentVersion();
    this.setState({
      status: "checking",
      currentVersion,
      latestVersion: this.state.latestVersion,
      checkedAt: this.state.checkedAt,
      manifest: this.state.manifest,
      platformKey: this.state.platformKey,
      platformArtifact: this.state.platformArtifact,
      error: null
    });
    const checkedAt = this.now();
    const updatedSettings = this.options.updateSettings({
      global: {
        ...this.options.getSettings().global,
        lastUpdateCheckAt: checkedAt
      }
    });
    this.setState({
      ...this.state,
      checkedAt: updatedSettings.global.lastUpdateCheckAt
    });

    let payload;
    try {
      payload = await this.fetchManifest();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setState({
        ...this.state,
        status: "error",
        error: {
          code: "network-error",
          message
        }
      });
      return this.state;
    }

    let manifest;
    try {
      manifest = validateReleaseManifest(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setState({
        ...this.state,
        status: "error",
        error: {
          code: message.includes("Unsupported release manifest schema") ? "unsupported-schema" : "invalid-manifest",
          message
        }
      });
      return this.state;
    }

    const platformArtifact = selectDesktopArtifact(manifest, this.state.platformKey);
    const newer = compareReleaseVersions(manifest.version, currentVersion) > 0;

    this.setState({
      status: newer ? "available" : "unavailable",
      currentVersion,
      latestVersion: manifest.version,
      checkedAt: updatedSettings.global.lastUpdateCheckAt,
      manifest,
      platformKey: this.state.platformKey,
      platformArtifact,
      error: newer && !platformArtifact
        ? {
            code: "platform-artifact-missing",
            message: `No desktop artifact is published for ${this.state.platformKey}`
          }
        : null
    });
    return this.state;
  }

  async openDownload(url?: string): Promise<{ ok: boolean; error?: string }> {
    const targetUrl = url ?? this.state.platformArtifact?.url ?? this.state.manifest?.releaseUrl;
    if (!targetUrl) {
      return this.recordOpenFailure("No release download URL is available");
    }
    if (!targetUrl.startsWith("https://")) {
      return this.recordOpenFailure("Release download URL must use HTTPS");
    }
    try {
      await this.options.openExternal(targetUrl);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.recordOpenFailure(message);
    }
  }

  private recordOpenFailure(message: string): { ok: false; error: string } {
    this.setState({
      ...this.state,
      status: "error",
      error: {
        code: "open-url-failed",
        message
      }
    });
    return { ok: false, error: message };
  }

  private setState(state: ReleaseState): void {
    this.state = state;
    this.options.onStateChange?.(this.state);
  }
}

async function fetchReleaseManifest(): Promise<unknown> {
  const { net } = await import("electron");
  const response = await net.fetch(RELEASE_MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Release manifest request failed with HTTP ${response.status}`);
  }
  return response.json();
}
