import { describe, expect, it, vi } from "vitest";
import {
  applyDocumentI18n,
  formatMessage,
  getEffectiveLanguage,
  getUiLanguage,
  setLanguagePreference,
  t
} from "./i18n";

describe("extension i18n helper", () => {
  it("falls back when chrome.i18n does not return a message", () => {
    vi.stubGlobal("chrome", {
      i18n: {
        getMessage: vi.fn(() => ""),
        getUILanguage: vi.fn(() => "en-US")
      }
    });

    expect(t("missingKey", "Fallback")).toBe("Fallback");
    expect(formatMessage("missingKey", "Hello {name}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("uses chrome.i18n messages and substitutions", () => {
    const getMessage = vi.fn((key: string, substitutions?: string | string[]) => {
      if (key === "relativeSecondsAgo") {
        return `${Array.isArray(substitutions) ? substitutions[0] : substitutions}s ago`;
      }
      return key === "settingsTitle" ? "Settings" : "";
    });
    vi.stubGlobal("chrome", {
      i18n: {
        getMessage,
        getUILanguage: vi.fn(() => "zh-CN")
      }
    });

    expect(t("settingsTitle", "Fallback")).toBe("Settings");
    expect(formatMessage("relativeSecondsAgo", "{seconds}s ago", { seconds: "8" })).toBe("8s ago");
    expect(getUiLanguage()).toBe("zh");
  });

  it("applies text and attribute translations to popup markup", () => {
    vi.stubGlobal("chrome", {
      i18n: {
        getUILanguage: vi.fn(() => "zh-CN"),
        getMessage: vi.fn((key: string) => {
          const messages: Record<string, string> = {
            settingsTitle: "设置",
            popupSettings: "设置"
          };
          return messages[key] ?? "";
        })
      }
    });
    document.body.innerHTML = `
      <h2 data-i18n="settingsTitle"></h2>
      <button data-i18n-title="popupSettings" data-i18n-aria-label="popupSettings"></button>
    `;

    applyDocumentI18n(document);

    expect(document.documentElement.lang).toBe("zh");
    expect(document.querySelector("h2")?.textContent).toBe("设置");
    expect(document.querySelector("button")?.getAttribute("title")).toBe("设置");
    expect(document.querySelector("button")?.getAttribute("aria-label")).toBe("设置");
  });

  it("uses the manual language preference instead of the browser language", () => {
    vi.stubGlobal("chrome", {
      i18n: {
        getMessage: vi.fn(() => ""),
        getUILanguage: vi.fn(() => "en-US")
      }
    });

    setLanguagePreference("zh");

    expect(getUiLanguage()).toBe("en");
    expect(getEffectiveLanguage()).toBe("zh");
    expect(t("settingsLanguage", "Language")).toBe("语言");

    setLanguagePreference("system");
  });
});
