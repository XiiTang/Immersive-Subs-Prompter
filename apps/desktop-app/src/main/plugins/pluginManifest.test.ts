import { describe, expect, it } from "vitest";
import { derivePluginKey, splitPluginKey } from "./pluginIdentity.js";
import { validatePluginManifest, validatePluginPackageManifest } from "./pluginManifest.js";

const XIITANG_AUTHOR = {
  id: "xiitang",
  name: "XiiTang",
  url: "https://github.com/XiiTang"
};

describe("validatePluginManifest", () => {
  it("requires author metadata and derives the plugin key from author and short id", () => {
    const manifest = validatePluginManifest({
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Word Lookup",
      description: "Looks up subtitle words.",
      appCompatibility: { minVersion: "1.0.0" },
      package: {
        url: "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository/word-lookup/1.0.0.usp-plugin",
        sha256: "a".repeat(64)
      },
      entry: { main: "main.js" },
      permissions: ["settingsSchema", "wordLookupProvider"],
      contributions: { settings: [], wordLookup: true }
    });

    expect(manifest.id).toBe("word-lookup");
    expect(manifest.author).toEqual(XIITANG_AUTHOR);
    expect(derivePluginKey(manifest)).toBe("xiitang/word-lookup");
    expect(splitPluginKey("xiitang/word-lookup")).toEqual({ authorId: "xiitang", pluginId: "word-lookup" });
  });

  it("rejects manifests without author metadata", () => {
    expect(() =>
      validatePluginManifest({
        id: "word-lookup",
        version: "1.0.0",
        displayName: "Word Lookup",
        description: "Looks up words.",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/word-lookup.usp-plugin", sha256: "b".repeat(64) },
        entry: { main: "main.js" },
        permissions: []
      })
    ).toThrow("word-lookup manifest author must use an object shape");
  });

  it("rejects unsafe author ids and non-HTTPS author URLs", () => {
    expect(() =>
      validatePluginManifest({
        id: "word-lookup",
        author: { id: "../xiitang", name: "XiiTang", url: "https://github.com/XiiTang" },
        version: "1.0.0",
        displayName: "Word Lookup",
        description: "Looks up words.",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/word-lookup.usp-plugin", sha256: "c".repeat(64) },
        entry: { main: "main.js" },
        permissions: []
      })
    ).toThrow("word-lookup manifest author id is invalid: ../xiitang");

    expect(() =>
      validatePluginManifest({
        id: "word-lookup",
        author: { id: "xiitang", name: "XiiTang", url: "http://github.com/XiiTang" },
        version: "1.0.0",
        displayName: "Word Lookup",
        description: "Looks up words.",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/word-lookup.usp-plugin", sha256: "d".repeat(64) },
        entry: { main: "main.js" },
        permissions: []
      })
    ).toThrow("word-lookup manifest author url must use https");
  });

  it("requires package manifests to match author metadata", () => {
    const remoteManifest = validatePluginManifest({
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Word Lookup",
      description: "Looks up words.",
      appCompatibility: { minVersion: "1.0.0" },
      package: { url: "https://plugins.example.test/word-lookup.usp-plugin", sha256: "e".repeat(64) },
      entry: { main: "main.js" },
      permissions: ["wordLookupProvider"],
      contributions: { wordLookup: true }
    });

    expect(() =>
      validatePluginPackageManifest(
        {
          id: "word-lookup",
          author: { id: "other", name: "Other" },
          version: "1.0.0",
          displayName: "Word Lookup",
          description: "Looks up words.",
          appCompatibility: { minVersion: "1.0.0" },
          entry: { main: "main.js" },
          permissions: ["wordLookupProvider"],
          contributions: { wordLookup: true }
        },
        remoteManifest
      )
    ).toThrow("word-lookup package manifest does not match remote manifest field: author");
  });

  it("accepts short plugin ids and concrete permissions", () => {
    const manifest = validatePluginManifest({
      id: "word-lookup",
      author: XIITANG_AUTHOR,
      version: "1.2.3",
      displayName: "Community Word Lookup",
      description: "Looks up subtitle words.",
      appCompatibility: { minVersion: "1.0.0" },
      package: {
        url: "https://plugins.example.test/word-lookup.usp-plugin",
        sha256: "a".repeat(64)
      },
      entry: { main: "main.js" },
      permissions: ["settingsSchema", "wordLookupProvider"],
      contributions: {
        settings: [
          {
            id: "word-lookup.settings",
            title: "Word Lookup",
            schema: [
              {
                id: "wordListPath",
                label: "Word List",
                type: "file",
                defaultValue: ""
              }
            ]
          }
        ],
        wordLookup: true
      }
    });

    expect(manifest.id).toBe("word-lookup");
    expect(manifest.permissions).toEqual(["settingsSchema", "wordLookupProvider"]);
    expect(manifest.contributions?.settings?.[0]?.schema[0]?.type).toBe("file");
  });

  it("rejects globally dotted plugin ids", () => {
    expect(() =>
      validatePluginManifest({
        id: "word.lookup",
        author: XIITANG_AUTHOR,
        version: "1.0.0",
        displayName: "Dotted",
        description: "Uses an old globally dotted id.",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/dotted.usp-plugin", sha256: "b".repeat(64) },
        entry: { main: "main.js" },
        permissions: []
      })
    ).toThrow("plugin manifest id is invalid: word.lookup");
  });

  it("rejects unknown permissions", () => {
    expect(() =>
      validatePluginManifest({
        id: "bad",
        author: XIITANG_AUTHOR,
        version: "1.0.0",
        displayName: "Bad",
        description: "Bad plugin",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/bad.zip", sha256: "b".repeat(64) },
        entry: { main: "main.js" },
        permissions: ["shellAccess"]
      })
    ).toThrow("bad manifest permission is not supported: shellAccess");
  });

  it("rejects unknown manifest fields instead of coercing them", () => {
    expect(() =>
      validatePluginManifest({
        id: "extra",
        author: XIITANG_AUTHOR,
        version: "1.0.0",
        displayName: "Extra",
        description: "Has an extra field.",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/extra.zip", sha256: "a".repeat(64) },
        entry: { main: "main.js" },
        permissions: [],
        legacyKind: "official"
      })
    ).toThrow("plugin manifest contains unsupported field: legacyKind");
  });

  it("rejects versions that cannot be used as an install path segment", () => {
    expect(() =>
      validatePluginManifest({
        id: "bad-version",
        author: XIITANG_AUTHOR,
        version: "../../../../outside",
        displayName: "Bad Version",
        description: "Bad plugin",
        appCompatibility: { minVersion: "1.0.0" },
        package: { url: "https://plugins.example.test/bad.zip", sha256: "b".repeat(64) },
        entry: { main: "main.js" },
        permissions: []
      })
    ).toThrow("bad-version manifest version is invalid");
  });

  it("rejects manifests that require a newer app version", () => {
    expect(() =>
      validatePluginManifest(
        {
          id: "future",
          author: XIITANG_AUTHOR,
          version: "1.0.0",
          displayName: "Future",
          description: "Requires a newer app.",
          appCompatibility: { minVersion: "2.0.0" },
          package: { url: "https://plugins.example.test/future.zip", sha256: "c".repeat(64) },
          entry: { main: "main.js" },
          permissions: []
        },
        { appVersion: "1.9.0" }
      )
    ).toThrow("future requires app version 2.0.0 or newer");
  });

  it("accepts textarea and structured server-list settings fields", () => {
    const manifest = validatePluginManifest({
      id: "media-source",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Media Source",
      description: "Adds media source sessions.",
      appCompatibility: { minVersion: "1.0.0" },
      package: {
        url: "https://plugins.example.test/media-source.usp-plugin",
        sha256: "d".repeat(64)
      },
      entry: { main: "main.js" },
      permissions: ["settingsSchema", "mediaSourceAdapter"],
      contributions: {
        settings: [
          {
            id: "media-source.settings",
            title: "Media Source",
            schema: [
              { id: "notes", label: "Notes", type: "textarea", defaultValue: "" },
              {
                id: "servers",
                label: "Servers",
                type: "serverList",
                defaultValue: [
                  {
                    id: "server-1",
                    name: "Server",
                    serverUrl: "https://media.example.test",
                    apiKey: "",
                    enabled: true
                  }
                ]
              }
            ]
          }
        ],
        mediaSource: true
      }
    });

    expect(manifest.contributions?.settings?.[0]?.schema.map((field) => field.type)).toEqual([
      "textarea",
      "serverList"
    ]);
    expect(manifest.contributions?.settings?.[0]?.schema[1]?.defaultValue).toEqual([
      {
        id: "server-1",
        name: "Server",
        serverUrl: "https://media.example.test",
        apiKey: "",
        enabled: true
      }
    ]);
  });

  it("rejects settings default values that do not match the field type", () => {
    expect(() =>
      validatePluginManifest({
        id: "bad-settings",
        author: XIITANG_AUTHOR,
        version: "1.0.0",
        displayName: "Bad Settings",
        description: "Has invalid defaults.",
        appCompatibility: { minVersion: "1.0.0" },
        package: {
          url: "https://plugins.example.test/bad-settings.usp-plugin",
          sha256: "e".repeat(64)
        },
        entry: { main: "main.js" },
        permissions: ["settingsSchema"],
        contributions: {
          settings: [
            {
              id: "bad-settings.settings",
              title: "Bad Settings",
              schema: [{ id: "threshold", label: "Threshold", type: "number", defaultValue: "10" }]
            }
          ]
        }
      })
    ).toThrow("bad-settings manifest settings field 0 defaultValue type does not match number");
  });

  it("rejects contribution declarations that are not booleans", () => {
    expect(() =>
      validatePluginManifest({
        id: "bad-contribution",
        author: XIITANG_AUTHOR,
        version: "1.0.0",
        displayName: "Bad Contribution",
        description: "Has invalid contributions.",
        appCompatibility: { minVersion: "1.0.0" },
        package: {
          url: "https://plugins.example.test/bad-contribution.usp-plugin",
          sha256: "f".repeat(64)
        },
        entry: { main: "main.js" },
        permissions: ["wordLookupProvider"],
        contributions: {
          wordLookup: "yes"
        }
      })
    ).toThrow("bad-contribution manifest contribution wordLookup must be a boolean");
  });

  it("rejects unknown contribution fields", () => {
    expect(() =>
      validatePluginManifest({
        id: "legacy-contribution",
        author: XIITANG_AUTHOR,
        version: "1.0.0",
        displayName: "Legacy Contribution",
        description: "Has an unsupported contribution.",
        appCompatibility: { minVersion: "1.0.0" },
        package: {
          url: "https://plugins.example.test/legacy-contribution.usp-plugin",
          sha256: "f".repeat(64)
        },
        entry: { main: "main.js" },
        permissions: [],
        contributions: {
          toolbarButton: true
        }
      })
    ).toThrow("legacy-contribution manifest contributions contains unsupported field: toolbarButton");
  });

  it("requires package manifests to match the remote manifest except for the package descriptor", () => {
    const remoteManifest = validatePluginManifest({
      id: "package",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Package",
      description: "Package manifest.",
      appCompatibility: { minVersion: "1.0.0" },
      package: {
        url: "https://plugins.example.test/package.usp-plugin",
        sha256: "f".repeat(64)
      },
      entry: { main: "main.js" },
      permissions: ["wordLookupProvider"],
      contributions: { wordLookup: true }
    });

    expect(validatePluginPackageManifest({
      id: "package",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Package",
      description: "Package manifest.",
      appCompatibility: { minVersion: "1.0.0" },
      entry: { main: "main.js" },
      permissions: ["wordLookupProvider"],
      contributions: { wordLookup: true }
    }, remoteManifest)).toMatchObject({ id: "package" });
    expect(() => validatePluginPackageManifest({
      id: "package",
      author: XIITANG_AUTHOR,
      version: "1.0.0",
      displayName: "Package",
      description: "Package manifest.",
      appCompatibility: { minVersion: "1.0.0" },
      package: remoteManifest.package,
      entry: { main: "main.js" },
      permissions: ["wordLookupProvider"],
      contributions: { wordLookup: true }
    }, remoteManifest)).toThrow("package package manifest contains unsupported field: package");
  });
});
