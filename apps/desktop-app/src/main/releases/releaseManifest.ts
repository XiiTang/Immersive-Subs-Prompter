export const RELEASE_MANIFEST_SCHEMA_VERSION = 1;
export const RELEASE_MANIFEST_URL =
  "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/releases/latest.json";

export type DesktopPlatformKey =
  | "darwin-arm64"
  | "darwin-x64"
  | "win32-arm64"
  | "win32-x64"
  | "linux-arm64"
  | "linux-x64";

export type ExtensionStoreStatus = "not-submitted" | "manual-review" | "published" | "rejected";

export interface DesktopReleaseArtifact {
  fileName: string;
  url: string;
  sha256: string;
  signed: boolean;
}

export interface ExtensionReleaseArtifact {
  version: string;
  artifactUrl: string;
  sha256: string;
  storeStatus: ExtensionStoreStatus;
}

export interface ReleaseManifest {
  schemaVersion: 1;
  version: string;
  releasedAt: string;
  releaseUrl: string;
  minimumSupportedVersion: string;
  notes: {
    en: string;
    zh: string;
  };
  desktop: Partial<Record<DesktopPlatformKey, DesktopReleaseArtifact>>;
  extension: {
    chrome: ExtensionReleaseArtifact;
    firefox: ExtensionReleaseArtifact;
  };
}

export interface ReleaseState {
  status: "idle" | "checking" | "available" | "unavailable" | "error";
  currentVersion: string;
  latestVersion: string | null;
  checkedAt: number | null;
  manifest: ReleaseManifest | null;
  platformKey: DesktopPlatformKey;
  platformArtifact: DesktopReleaseArtifact | null;
  error: {
    code:
      | "network-error"
      | "invalid-manifest"
      | "unsupported-schema"
      | "not-newer"
      | "platform-artifact-missing"
      | "open-url-failed";
    message: string;
  } | null;
}

const DESKTOP_PLATFORM_KEYS = [
  "darwin-arm64",
  "darwin-x64",
  "win32-arm64",
  "win32-x64",
  "linux-arm64",
  "linux-x64"
] as const;
const EXTENSION_STORE_STATUSES = ["not-submitted", "manual-review", "published", "rejected"] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HTTPS_PATTERN = /^https:\/\//;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertNoUnknownKeys(source: Record<string, unknown>, allowedKeys: readonly string[], context: string): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unknown key: ${key}`);
    }
  }
}

function assertRecord(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function assertString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function assertHttpsUrl(value: unknown, name: string): string {
  const url = assertString(value, name);
  if (!HTTPS_PATTERN.test(url)) {
    throw new Error(`${name} must be an HTTPS URL`);
  }
  return url;
}

function assertSha256(value: unknown, name: string): string {
  const hash = assertString(value, name);
  if (!SHA256_PATTERN.test(hash)) {
    throw new Error(`${name} must be a lowercase SHA-256 hash`);
  }
  return hash;
}

function assertBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean`);
  }
  return value;
}

function parseReleaseVersion(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid release version "${version}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isDesktopPlatformKey(value: string): value is DesktopPlatformKey {
  return (DESKTOP_PLATFORM_KEYS as readonly string[]).includes(value);
}

function isExtensionStoreStatus(value: string): value is ExtensionStoreStatus {
  return (EXTENSION_STORE_STATUSES as readonly string[]).includes(value);
}

export function compareReleaseVersions(left: string, right: string): number {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}

export function getDesktopPlatformKey(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch
): DesktopPlatformKey {
  const key = `${platform}-${arch}`;
  if (!isDesktopPlatformKey(key)) {
    throw new Error(`Unsupported desktop platform: ${key}`);
  }
  return key;
}

export function selectDesktopArtifact(
  manifest: ReleaseManifest,
  platformKey: DesktopPlatformKey
): DesktopReleaseArtifact | null {
  return manifest.desktop[platformKey] ?? null;
}

export function validateReleaseManifest(value: unknown): ReleaseManifest {
  const manifest = assertRecord(value, "release manifest");
  assertNoUnknownKeys(
    manifest,
    [
      "schemaVersion",
      "version",
      "releasedAt",
      "releaseUrl",
      "minimumSupportedVersion",
      "notes",
      "desktop",
      "extension"
    ],
    "release manifest"
  );

  if (manifest.schemaVersion !== RELEASE_MANIFEST_SCHEMA_VERSION) {
    throw new Error("Unsupported release manifest schema");
  }

  const version = assertString(manifest.version, "release manifest version");
  parseReleaseVersion(version);
  const releasedAt = assertString(manifest.releasedAt, "release manifest releasedAt");
  if (Number.isNaN(Date.parse(releasedAt))) {
    throw new Error("release manifest releasedAt must be an ISO date string");
  }
  const minimumSupportedVersion = assertString(
    manifest.minimumSupportedVersion,
    "release manifest minimumSupportedVersion"
  );
  parseReleaseVersion(minimumSupportedVersion);

  return {
    schemaVersion: RELEASE_MANIFEST_SCHEMA_VERSION,
    version,
    releasedAt,
    releaseUrl: assertHttpsUrl(manifest.releaseUrl, "release manifest releaseUrl"),
    minimumSupportedVersion,
    notes: validateNotes(manifest.notes),
    desktop: validateDesktopArtifacts(manifest.desktop),
    extension: validateExtensionArtifacts(manifest.extension)
  };
}

function validateNotes(value: unknown): ReleaseManifest["notes"] {
  const notes = assertRecord(value, "release manifest notes");
  assertNoUnknownKeys(notes, ["en", "zh"], "release manifest notes");
  return {
    en: assertString(notes.en, "release manifest notes.en"),
    zh: assertString(notes.zh, "release manifest notes.zh")
  };
}

function validateDesktopArtifacts(value: unknown): ReleaseManifest["desktop"] {
  const desktop = assertRecord(value, "release manifest desktop");
  const parsed: ReleaseManifest["desktop"] = {};
  for (const [key, artifact] of Object.entries(desktop)) {
    if (!isDesktopPlatformKey(key)) {
      throw new Error(`Unsupported desktop platform key: ${key}`);
    }
    parsed[key] = validateDesktopArtifact(artifact, `release manifest desktop.${key}`);
  }
  return parsed;
}

function validateDesktopArtifact(value: unknown, context: string): DesktopReleaseArtifact {
  const artifact = assertRecord(value, context);
  assertNoUnknownKeys(artifact, ["fileName", "url", "sha256", "signed"], context);
  return {
    fileName: assertString(artifact.fileName, `${context}.fileName`),
    url: assertHttpsUrl(artifact.url, `${context}.url`),
    sha256: assertSha256(artifact.sha256, `${context}.sha256`),
    signed: assertBoolean(artifact.signed, `${context}.signed`)
  };
}

function validateExtensionArtifacts(value: unknown): ReleaseManifest["extension"] {
  const extension = assertRecord(value, "release manifest extension");
  assertNoUnknownKeys(extension, ["chrome", "firefox"], "release manifest extension");
  return {
    chrome: validateExtensionArtifact(extension.chrome, "release manifest extension.chrome"),
    firefox: validateExtensionArtifact(extension.firefox, "release manifest extension.firefox")
  };
}

function validateExtensionArtifact(value: unknown, context: string): ExtensionReleaseArtifact {
  const artifact = assertRecord(value, context);
  assertNoUnknownKeys(artifact, ["version", "artifactUrl", "sha256", "storeStatus"], context);
  const version = assertString(artifact.version, `${context}.version`);
  parseReleaseVersion(version);
  const storeStatus = assertString(artifact.storeStatus, `${context}.storeStatus`);
  if (!isExtensionStoreStatus(storeStatus)) {
    throw new Error(`${context}.storeStatus must use a current store status`);
  }
  return {
    version,
    artifactUrl: assertHttpsUrl(artifact.artifactUrl, `${context}.artifactUrl`),
    sha256: assertSha256(artifact.sha256, `${context}.sha256`),
    storeStatus
  };
}
