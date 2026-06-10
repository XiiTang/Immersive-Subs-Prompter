export const EXTENSION_BUILD_TARGETS = ["chrome", "firefox"] as const;

export type ExtensionBuildTarget = (typeof EXTENSION_BUILD_TARGETS)[number];

interface ExtensionManifestBackground {
  service_worker?: string;
  scripts?: string[];
  type: "module";
}

interface ExtensionManifestContentScript {
  matches: string[];
  js: string[];
  all_frames: boolean;
  run_at: "document_start";
}

interface ExtensionManifest {
  manifest_version: 3;
  name: string;
  default_locale: string;
  description: string;
  author: string;
  version: string;
  permissions: string[];
  host_permissions: string[];
  background: ExtensionManifestBackground;
  content_scripts: ExtensionManifestContentScript[];
  action: {
    default_title: string;
    default_popup: string;
  };
  icons: Record<string, string>;
  browser_specific_settings?: {
    gecko: {
      id: string;
      strict_min_version: string;
    };
  };
  content_security_policy?: {
    extension_pages: string;
  };
}

export function isExtensionBuildTarget(value: string): value is ExtensionBuildTarget {
  return EXTENSION_BUILD_TARGETS.includes(value as ExtensionBuildTarget);
}

function commonManifest(version: string): Omit<ExtensionManifest, "background"> {
  return {
    manifest_version: 3,
    name: "__MSG_extensionName__",
    default_locale: "en",
    description: "__MSG_extensionDescription__",
    author: "sheixunixitang3@gmail.com",
    version,
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["dist/content-script.js"],
        all_frames: true,
        run_at: "document_start"
      }
    ],
    action: {
      default_title: "__MSG_extensionName__",
      default_popup: "popup.html"
    },
    icons: {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  };
}

export function buildExtensionManifest(target: string, version: string): ExtensionManifest {
  if (!isExtensionBuildTarget(target)) {
    throw new Error(`Unknown extension build target "${target}". Use "chrome" or "firefox".`);
  }

  const normalizedVersion = version.trim();
  if (!normalizedVersion) {
    throw new Error("Extension package.json must define a non-empty version.");
  }

  const common = commonManifest(normalizedVersion);

  if (target === "chrome") {
    return {
      ...common,
      background: {
        service_worker: "dist/background.js",
        type: "module"
      }
    };
  }

  return {
    ...common,
    background: {
      scripts: ["dist/background.js"],
      type: "module"
    },
    browser_specific_settings: {
      gecko: {
        id: "sheixunixitang3@gmail.com",
        strict_min_version: "109.0"
      }
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src ws: http: https: data: blob:;"
    }
  };
}
