import { validatePluginIdentitySegment, type PluginAuthor } from "./pluginIdentity.js";

export const PLUGIN_PERMISSIONS = [
  "network",
  "readSelectedFile",
  "transcriptionRuntime",
  "settingsSchema",
  "wordLookupProvider",
  "transcriptionProvider",
  "mediaSourceAdapter"
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export interface PluginPackageDescriptor {
  url: string;
  sha256: string;
}

export interface PluginCompatibility {
  minVersion: string;
  maxVersion?: string;
}

export interface PluginSettingsFieldOption {
  value: string;
  label: string;
}

export interface PluginServerSettingsRecord {
  id: string;
  name: string;
  serverUrl: string;
  apiKey: string;
  enabled: boolean;
}

export type PluginSettingsFieldType = "string" | "number" | "boolean" | "select" | "file" | "textarea" | "serverList";
export type PluginSettingsDefaultValue = string | number | boolean | PluginServerSettingsRecord[];

export interface PluginSettingsFieldSchema {
  id: string;
  label: string;
  type: PluginSettingsFieldType;
  defaultValue?: PluginSettingsDefaultValue;
  options?: PluginSettingsFieldOption[];
}

export interface PluginSettingsContribution {
  id: string;
  title: string;
  schema: PluginSettingsFieldSchema[];
}

export interface PluginContributionDeclarations {
  settings?: PluginSettingsContribution[];
  wordLookup?: boolean;
  transcription?: boolean;
  mediaSource?: boolean;
}

export interface PluginNetworkAccess {
  allowedHosts: string[];
}

export interface PluginManifest {
  id: string;
  author: PluginAuthor;
  version: string;
  displayName: string;
  description: string;
  appCompatibility: PluginCompatibility;
  package: PluginPackageDescriptor;
  entry: { main: string };
  permissions: PluginPermission[];
  network?: PluginNetworkAccess;
  contributions?: PluginContributionDeclarations;
}

export type PluginPackageManifest = Omit<PluginManifest, "package">;

export interface PluginManifestValidationOptions {
  appVersion?: string;
}

function requireObject(input: unknown, context: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${context} must use an object shape`);
  }
  return input as Record<string, unknown>;
}

function assertExactKeys(source: Record<string, unknown>, allowedKeys: readonly string[], context: string): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unsupported field: ${key}`);
    }
  }
}

function requireString(source: Record<string, unknown>, key: string, context: string): string {
  const value = source[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} must include string ${key}`);
  }
  return value;
}

function optionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function validatePluginId(id: string): string {
  return validatePluginIdentitySegment(id, "plugin manifest id");
}

function validateAuthor(input: unknown, pluginId: string): PluginAuthor {
  const source = requireObject(input, `${pluginId} manifest author`);
  assertExactKeys(source, ["id", "name", "url"], `${pluginId} manifest author`);
  const author: PluginAuthor = {
    id: validatePluginIdentitySegment(
      requireString(source, "id", `${pluginId} manifest author`),
      `${pluginId} manifest author id`
    ),
    name: requireString(source, "name", `${pluginId} manifest author`)
  };
  const url = optionalString(source, "url");
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      throw new Error(`${pluginId} manifest author url must use https`);
    }
    author.url = url;
  }
  return author;
}

function validatePluginVersion(version: string, pluginId: string): string {
  if (
    !/^[0-9]+(?:\.[0-9]+){0,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version) ||
    version.includes("..")
  ) {
    throw new Error(`${pluginId} manifest version is invalid`);
  }
  return version;
}

function validateEntryMain(entry: string, pluginId: string): string {
  if (entry.startsWith("/") || entry.includes("\\") || entry.split("/").some((part) => part === "..")) {
    throw new Error(`${pluginId} manifest entry main must be a relative package path`);
  }
  return entry;
}

function validatePermissions(input: unknown, pluginId: string): PluginPermission[] {
  if (!Array.isArray(input)) {
    throw new Error(`${pluginId} manifest permissions must be an array`);
  }
  const allowed = new Set<string>(PLUGIN_PERMISSIONS);
  const seen = new Set<string>();
  const permissions: PluginPermission[] = [];
  for (const permission of input) {
    if (typeof permission !== "string" || !allowed.has(permission)) {
      throw new Error(`${pluginId} manifest permission is not supported: ${String(permission)}`);
    }
    if (!seen.has(permission)) {
      permissions.push(permission as PluginPermission);
      seen.add(permission);
    }
  }
  return permissions;
}

function validateSettingsSchema(input: unknown, pluginId: string): PluginSettingsContribution[] | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (!Array.isArray(input)) {
    throw new Error(`${pluginId} manifest settings contributions must be an array`);
  }
  return input.map((section, index) => {
    const source = requireObject(section, `${pluginId} manifest settings contribution ${index}`);
    assertExactKeys(source, ["id", "title", "schema"], `${pluginId} manifest settings contribution ${index}`);
    const schemaInput = source.schema;
    if (!Array.isArray(schemaInput)) {
      throw new Error(`${pluginId} manifest settings contribution ${index} schema must be an array`);
    }
    return {
      id: requireString(source, "id", `${pluginId} manifest settings contribution ${index}`),
      title: requireString(source, "title", `${pluginId} manifest settings contribution ${index}`),
      schema: schemaInput.map((field, fieldIndex) => validateSettingsField(field, pluginId, fieldIndex))
    };
  });
}

function validateSettingsField(input: unknown, pluginId: string, index: number): PluginSettingsFieldSchema {
  const source = requireObject(input, `${pluginId} manifest settings field ${index}`);
  assertExactKeys(source, ["id", "label", "type", "defaultValue", "options"], `${pluginId} manifest settings field ${index}`);
  const type = requireString(source, "type", `${pluginId} manifest settings field ${index}`);
  if (!["string", "number", "boolean", "select", "file", "textarea", "serverList"].includes(type)) {
    throw new Error(`${pluginId} manifest settings field ${index} type is not supported: ${type}`);
  }
  const field: PluginSettingsFieldSchema = {
    id: requireString(source, "id", `${pluginId} manifest settings field ${index}`),
    label: requireString(source, "label", `${pluginId} manifest settings field ${index}`),
    type: type as PluginSettingsFieldSchema["type"]
  };
  if (source.defaultValue !== undefined) {
    field.defaultValue = validateSettingsDefaultValue(source.defaultValue, field.type, pluginId, index);
  }
  if (source.options !== undefined) {
    if (!Array.isArray(source.options)) {
      throw new Error(`${pluginId} manifest settings field ${index} options must be an array`);
    }
    field.options = source.options.map((option, optionIndex) => {
      const optionSource = requireObject(option, `${pluginId} manifest settings field ${index} option ${optionIndex}`);
      assertExactKeys(optionSource, ["value", "label"], `${pluginId} manifest settings field ${index} option ${optionIndex}`);
      return {
        value: requireString(optionSource, "value", `${pluginId} manifest settings field ${index} option ${optionIndex}`),
        label: requireString(optionSource, "label", `${pluginId} manifest settings field ${index} option ${optionIndex}`)
      };
    });
  }
  return field;
}

function validateSettingsDefaultValue(
  value: unknown,
  type: PluginSettingsFieldType,
  pluginId: string,
  index: number
): PluginSettingsDefaultValue {
  if (type === "serverList") {
    if (!Array.isArray(value)) {
      throw new Error(`${pluginId} manifest settings field ${index} defaultValue must be an array`);
    }
    if (value.length > 0) {
      throw new Error(`${pluginId} manifest settings field ${index} serverList defaultValue must be empty`);
    }
    return value.map((server, serverIndex) => {
      const source = requireObject(server, `${pluginId} manifest settings field ${index} server ${serverIndex}`);
      assertExactKeys(source, ["id", "name", "serverUrl", "apiKey", "enabled"], `${pluginId} manifest settings field ${index} server ${serverIndex}`);
      return {
        id: requireServerDefaultString(source, "id", pluginId, index, serverIndex),
        name: requireServerDefaultString(source, "name", pluginId, index, serverIndex),
        serverUrl: requireServerDefaultString(source, "serverUrl", pluginId, index, serverIndex),
        apiKey: requireServerDefaultString(source, "apiKey", pluginId, index, serverIndex),
        enabled: requireServerDefaultBoolean(source, "enabled", pluginId, index, serverIndex)
      };
    });
  }
  if (type === "number" && typeof value === "number") {
    return value;
  }
  if (type === "boolean" && typeof value === "boolean") {
    return value;
  }
  if (
    (type === "string" || type === "select" || type === "file" || type === "textarea") &&
    typeof value === "string"
  ) {
    const trimmed = value.trim();
    if (type === "file" && trimmed) {
      throw new Error(`${pluginId} manifest settings field ${index} file defaultValue must be empty`);
    }
    if ((type === "string" || type === "textarea") && isHttpUrlString(trimmed)) {
      throw new Error(`${pluginId} manifest settings field ${index} ${type} defaultValue must not be a URL`);
    }
    return value;
  }
  throw new Error(`${pluginId} manifest settings field ${index} defaultValue type does not match ${type}`);
}

function isHttpUrlString(value: string): boolean {
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function requireServerDefaultString(
  source: Record<string, unknown>,
  key: string,
  pluginId: string,
  fieldIndex: number,
  serverIndex: number
): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`${pluginId} manifest settings field ${fieldIndex} server ${serverIndex} ${key} must be a string`);
  }
  return value;
}

function requireServerDefaultBoolean(
  source: Record<string, unknown>,
  key: string,
  pluginId: string,
  fieldIndex: number,
  serverIndex: number
): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new Error(`${pluginId} manifest settings field ${fieldIndex} server ${serverIndex} ${key} must be a boolean`);
  }
  return value;
}

function validateContributions(input: unknown, pluginId: string): PluginContributionDeclarations | undefined {
  if (input === undefined) {
    return undefined;
  }
  const source = requireObject(input, `${pluginId} manifest contributions`);
  assertExactKeys(source, ["settings", "wordLookup", "transcription", "mediaSource"], `${pluginId} manifest contributions`);
  const contributions: PluginContributionDeclarations = {};
  const settings = validateSettingsSchema(source.settings, pluginId);
  if (settings) {
    contributions.settings = settings;
  }
  if (source.wordLookup !== undefined) {
    contributions.wordLookup = validateContributionBoolean(source.wordLookup, pluginId, "wordLookup");
  }
  if (source.transcription !== undefined) {
    contributions.transcription = validateContributionBoolean(source.transcription, pluginId, "transcription");
  }
  if (source.mediaSource !== undefined) {
    contributions.mediaSource = validateContributionBoolean(source.mediaSource, pluginId, "mediaSource");
  }
  return contributions;
}

function validateContributionBoolean(input: unknown, pluginId: string, key: string): boolean {
  if (typeof input !== "boolean") {
    throw new Error(`${pluginId} manifest contribution ${key} must be a boolean`);
  }
  return input;
}

function validateNetworkAccess(input: unknown, pluginId: string): PluginNetworkAccess | undefined {
  if (input === undefined) {
    return undefined;
  }
  const source = requireObject(input, `${pluginId} manifest network`);
  assertExactKeys(source, ["allowedHosts"], `${pluginId} manifest network`);
  const allowedHosts = source.allowedHosts;
  if (!Array.isArray(allowedHosts) || allowedHosts.some((host) => typeof host !== "string" || !host.trim())) {
    throw new Error(`${pluginId} manifest network allowedHosts must be a string array`);
  }
  return {
    allowedHosts: Array.from(new Set(allowedHosts.map((host) => host.trim().toLowerCase())))
  };
}

function validateDeclaredPermissionConsistency(manifest: PluginManifest): void {
  const permissions = new Set(manifest.permissions);
  if (manifest.network?.allowedHosts.length && !permissions.has("network")) {
    throw new Error(`${manifest.id} manifest declares network hosts without network permission`);
  }
  if (manifest.contributions?.settings?.length && !permissions.has("settingsSchema")) {
    throw new Error(`${manifest.id} manifest declares settings without settingsSchema permission`);
  }
  if (manifest.contributions?.wordLookup && !permissions.has("wordLookupProvider")) {
    throw new Error(`${manifest.id} manifest declares word lookup without wordLookupProvider permission`);
  }
  if (manifest.contributions?.transcription && !permissions.has("transcriptionProvider")) {
    throw new Error(`${manifest.id} manifest declares transcription without transcriptionProvider permission`);
  }
  if (manifest.contributions?.mediaSource && !permissions.has("mediaSourceAdapter")) {
    throw new Error(`${manifest.id} manifest declares media source without mediaSourceAdapter permission`);
  }
}

function parseVersion(version: string): number[] {
  return version.split(".").map((part) => {
    const value = Number.parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  });
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }
  return 0;
}

function validateAppCompatibility(manifest: PluginManifest, options: PluginManifestValidationOptions): void {
  if (!options.appVersion) {
    return;
  }
  if (compareVersions(options.appVersion, manifest.appCompatibility.minVersion) < 0) {
    throw new Error(`${manifest.id} requires app version ${manifest.appCompatibility.minVersion} or newer`);
  }
  if (manifest.appCompatibility.maxVersion && compareVersions(options.appVersion, manifest.appCompatibility.maxVersion) > 0) {
    throw new Error(`${manifest.id} requires app version ${manifest.appCompatibility.maxVersion} or older`);
  }
}

export function validatePluginManifest(
  input: unknown,
  options: PluginManifestValidationOptions = {}
): PluginManifest {
  const source = requireObject(input, "plugin manifest");
  assertExactKeys(
    source,
    ["id", "author", "version", "displayName", "description", "appCompatibility", "package", "entry", "permissions", "network", "contributions"],
    "plugin manifest"
  );
  const id = validatePluginId(requireString(source, "id", "plugin manifest"));
  const pkg = requireObject(source.package, `${id} manifest package`);
  assertExactKeys(pkg, ["url", "sha256"], `${id} manifest package`);
  const entry = requireObject(source.entry, `${id} manifest entry`);
  assertExactKeys(entry, ["main"], `${id} manifest entry`);
  const appCompatibility = requireObject(source.appCompatibility, `${id} manifest appCompatibility`);
  assertExactKeys(appCompatibility, ["minVersion", "maxVersion"], `${id} manifest appCompatibility`);
  const sha256 = requireString(pkg, "sha256", `${id} manifest package`);
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new Error(`${id} manifest package sha256 must be 64 hex characters`);
  }

  const manifest: PluginManifest = {
    id,
    author: validateAuthor(source.author, id),
    version: validatePluginVersion(requireString(source, "version", `${id} manifest`), id),
    displayName: requireString(source, "displayName", `${id} manifest`),
    description: requireString(source, "description", `${id} manifest`),
    appCompatibility: {
      minVersion: requireString(appCompatibility, "minVersion", `${id} manifest appCompatibility`),
      ...(optionalString(appCompatibility, "maxVersion") ? { maxVersion: optionalString(appCompatibility, "maxVersion") } : {})
    },
    package: {
      url: requireString(pkg, "url", `${id} manifest package`),
      sha256
    },
    entry: { main: validateEntryMain(requireString(entry, "main", `${id} manifest entry`), id) },
    permissions: validatePermissions(source.permissions, id),
    network: validateNetworkAccess(source.network, id),
    contributions: validateContributions(source.contributions, id)
  };
  validateDeclaredPermissionConsistency(manifest);
  validateAppCompatibility(manifest, options);
  return manifest;
}

export function validatePluginPackageManifest(input: unknown, remoteManifest: PluginManifest): PluginPackageManifest {
  const source = requireObject(input, `${remoteManifest.id} package manifest`);
  assertExactKeys(
    source,
    ["id", "author", "version", "displayName", "description", "appCompatibility", "entry", "permissions", "network", "contributions"],
    `${remoteManifest.id} package manifest`
  );
  const manifest = validatePluginManifest({
    ...source,
    package: remoteManifest.package
  });
  const comparableKeys = [
    "id",
    "author",
    "version",
    "displayName",
    "description",
    "appCompatibility",
    "entry",
    "permissions",
    "network",
    "contributions"
  ] as const;
  for (const key of comparableKeys) {
    if (JSON.stringify(manifest[key]) !== JSON.stringify(remoteManifest[key])) {
      throw new Error(`${remoteManifest.id} package manifest does not match remote manifest field: ${key}`);
    }
  }
  return source as unknown as PluginPackageManifest;
}
