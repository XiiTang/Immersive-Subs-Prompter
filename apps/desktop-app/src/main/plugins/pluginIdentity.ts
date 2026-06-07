export interface PluginAuthor {
  id: string;
  name: string;
  url?: string;
}

export interface PluginKeyParts {
  authorId: string;
  pluginShortId: string;
}

const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

export function validatePluginIdentitySegment(value: string, context: string): string {
  if (!SAFE_ID_PATTERN.test(value) || value.includes("..")) {
    throw new Error(`${context} is invalid: ${value}`);
  }
  return value;
}

export function derivePluginKey(input: { author: Pick<PluginAuthor, "id">; id: string }): string {
  return `${input.author.id}/${input.id}`;
}

export function splitPluginKey(pluginKey: string): PluginKeyParts {
  const parts = pluginKey.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`plugin key is invalid: ${pluginKey}`);
  }
  return {
    authorId: validatePluginIdentitySegment(parts[0], "plugin key author id"),
    pluginShortId: validatePluginIdentitySegment(parts[1], "plugin key id")
  };
}
