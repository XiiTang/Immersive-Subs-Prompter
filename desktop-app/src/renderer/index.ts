import type {
  AppSettings,
  DesktopState,
  JellyfinConfig,
  JellyfinSessionSummary,
  JellyfinSettings,
  PlaybackState,
  ProfileDefinition,
  ProfileRule,
  ProfileSettings,
  SubtitleCue,
  SubtitleTrack,
  UrlMatchType
} from "../main/types.js";
import {
  AUTO_HIDE_ZONE_MAX,
  AUTO_HIDE_ZONE_MIN,
  DEFAULT_AUTO_HIDE_ZONE_HEIGHT,
  clampAutoHideZoneHeight
} from "../common/autoHide.js";

const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";

const connectionIndicator = document.getElementById("connection-indicator") as HTMLElement;
const videoTitle = document.getElementById("video-title") as HTMLElement;
const videoUrl = document.getElementById("video-url") as HTMLElement;
const activeProfileLabel = document.getElementById("active-profile-label") as HTMLElement;
const statusBanner = document.getElementById("status-banner") as HTMLElement;
const statusBannerText = document.getElementById("status-banner-text") as HTMLElement;
const autoHideToggle = document.getElementById("auto-hide-toggle") as HTMLButtonElement;
const subtitleList = document.getElementById("subtitle-list") as HTMLElement;
const controlPanel = document.getElementById("control-panel") as HTMLElement;

const primaryTrackSelector = document.getElementById("primary-track-selector") as HTMLSelectElement;
const secondaryTrackSelector = document.getElementById("secondary-track-selector") as HTMLSelectElement;
const playButton = document.getElementById("play-btn") as HTMLButtonElement;
const pauseButton = document.getElementById("pause-btn") as HTMLButtonElement;
const closeBehaviorSelect = document.getElementById("close-behavior") as HTMLSelectElement;
const autostartToggle = document.getElementById("autostart-toggle") as HTMLInputElement;
const toggleWindowShortcutInput = document.getElementById("toggle-window-shortcut") as HTMLInputElement;
const gameProcessInput = document.getElementById("game-process-input") as HTMLInputElement;
const gameProcessAddButton = document.getElementById("game-process-add") as HTMLButtonElement;
const gameProcessListElement = document.getElementById("game-process-list") as HTMLElement;
const subtitleFontInput = document.getElementById("subtitle-font") as HTMLInputElement;
const subtitleFontSizeInput = document.getElementById("subtitle-font-size") as HTMLInputElement;
const subtitleAutoScrollTimeoutInput = document.getElementById("subtitle-auto-scroll-timeout") as HTMLInputElement;
const subtitleScrollPositionInput = document.getElementById("subtitle-scroll-position") as HTMLInputElement;
const subtitleScrollPositionValue = document.getElementById("subtitle-scroll-position-value") as HTMLElement;
const subtitleLineSpacingInput = document.getElementById("subtitle-line-spacing") as HTMLInputElement;
const subtitleLineSpacingValue = document.getElementById("subtitle-line-spacing-value") as HTMLElement;
const subtitleTimeTextGapInput = document.getElementById("subtitle-time-text-gap") as HTMLInputElement;
const subtitleTimeTextGapValue = document.getElementById("subtitle-time-text-gap-value") as HTMLElement;
const subtitlePrimarySecondaryGapInput = document.getElementById("subtitle-primary-secondary-gap") as HTMLInputElement;
const subtitlePrimarySecondaryGapValue = document.getElementById("subtitle-primary-secondary-gap-value") as HTMLElement;
const subtitleLineHeightInput = document.getElementById("subtitle-line-height") as HTMLInputElement;
const subtitleLineHeightValue = document.getElementById("subtitle-line-height-value") as HTMLElement;
const subtitlePrimaryColorInput = document.getElementById("subtitle-primary-color") as HTMLInputElement;
const subtitleSecondaryColorInput = document.getElementById("subtitle-secondary-color") as HTMLInputElement;
const subtitleActivePrimaryColorInput = document.getElementById("subtitle-active-primary-color") as HTMLInputElement;
const subtitleActiveSecondaryColorInput = document.getElementById("subtitle-active-secondary-color") as HTMLInputElement;
const ytDlpArgsInput = document.getElementById("yt-dlp-args") as HTMLTextAreaElement;
const jellyfinEnabledToggle = document.getElementById("jellyfin-enabled") as HTMLInputElement | null;
const jellyfinConfigListElement = document.getElementById("jellyfin-config-list") as HTMLElement;
const jellyfinConfigAddButton = document.getElementById("jellyfin-config-add") as HTMLButtonElement;
const jellyfinConfigDeleteButton = document.getElementById("jellyfin-config-delete") as HTMLButtonElement;
const jellyfinConfigNameInput = document.getElementById("jellyfin-config-name") as HTMLInputElement | null;
const jellyfinServerInput = document.getElementById("jellyfin-server-url") as HTMLInputElement | null;
const jellyfinApiKeyInput = document.getElementById("jellyfin-api-key") as HTMLInputElement | null;
const jellyfinWsPathInput = document.getElementById("jellyfin-ws-path") as HTMLInputElement | null;
const primaryPriorityList = document.getElementById("primary-priority-list") as HTMLElement;
const secondaryPriorityList = document.getElementById("secondary-priority-list") as HTMLElement;
const primaryPriorityInput = document.getElementById("primary-priority-input") as HTMLInputElement;
const secondaryPriorityInput = document.getElementById("secondary-priority-input") as HTMLInputElement;
const primaryPriorityAddButton = document.getElementById("primary-priority-add") as HTMLButtonElement;
const secondaryPriorityAddButton = document.getElementById("secondary-priority-add") as HTMLButtonElement;
const settingsButton = document.getElementById("settings-btn") as HTMLButtonElement;
const pinButton = document.getElementById("pin-btn") as HTMLButtonElement | null;
const pinIconElement = document.getElementById("pin-icon") as HTMLElement | null;
const fullscreenButton = document.getElementById("fullscreen-btn") as HTMLButtonElement | null;
const fullscreenIconElement = document.getElementById("fullscreen-icon") as HTMLElement | null;
const transparencyButton = document.getElementById("transparency-btn") as HTMLButtonElement | null;
const transparencyPopover = document.getElementById("transparency-popover") as HTMLElement | null;
const transparencyControl = document.getElementById("transparency-control") as HTMLElement | null;
const panelOpacitySlider = document.getElementById("panel-opacity-slider") as HTMLInputElement | null;
const panelOpacityValue = document.getElementById("panel-opacity-value") as HTMLElement | null;
const autoHideZoneSlider = document.getElementById("auto-hide-zone-height") as HTMLInputElement | null;
const autoHideZoneValue = document.getElementById("auto-hide-zone-height-value") as HTMLElement | null;
const languageSelect = document.getElementById("language-select") as HTMLSelectElement | null;
const autoHidePreviewElement = document.getElementById("auto-hide-preview") as HTMLElement | null;
const settingsBackButton = document.getElementById("settings-back") as HTMLButtonElement;
const settingsPanelElement = document.getElementById("settings-panel") as HTMLElement;
const windowContainer = document.querySelector(".window") as HTMLElement;
const profileListElement = document.getElementById("profile-list") as HTMLElement;
const profileAddButton = document.getElementById("profile-add") as HTMLButtonElement;
const profileNameInput = document.getElementById("profile-name") as HTMLInputElement;
const profileDeleteButton = document.getElementById("profile-delete") as HTMLButtonElement;
const profileDuplicateButton = document.getElementById("profile-duplicate") as HTMLButtonElement;
const profileSetDefaultButton = document.getElementById("profile-set-default") as HTMLButtonElement;
const ruleListElement = document.getElementById("rule-list") as HTMLElement;
const ruleNameInput = document.getElementById("rule-name") as HTMLInputElement;
const rulePatternInput = document.getElementById("rule-pattern") as HTMLInputElement;
const ruleMatchTypeSelect = document.getElementById("rule-match-type") as HTMLSelectElement;
const ruleProfileSelect = document.getElementById("rule-profile") as HTMLSelectElement;
const ruleFormTitle = document.getElementById("rule-form-title") as HTMLElement;
const ruleSaveButton = document.getElementById("rule-save") as HTMLButtonElement;
const ruleCancelButton = document.getElementById("rule-cancel") as HTMLButtonElement;
const cacheEnabledCheckbox = document.getElementById("cache-enabled") as HTMLInputElement;
const cachePathInput = document.getElementById("cache-path") as HTMLInputElement;
const cacheRetentionDaysInput = document.getElementById("cache-retention-days") as HTMLInputElement;
const cacheTotalEntriesElement = document.getElementById("cache-total-entries") as HTMLElement;
const cacheTotalSizeElement = document.getElementById("cache-total-size") as HTMLElement;
const cacheOldestEntryElement = document.getElementById("cache-oldest-entry") as HTMLElement;
const cacheOpenFolderButton = document.getElementById("cache-open-folder") as HTMLButtonElement;
const cacheRefreshStatsButton = document.getElementById("cache-refresh-stats") as HTMLButtonElement;
const cacheCleanupButton = document.getElementById("cache-cleanup") as HTMLButtonElement;
const cacheClearButton = document.getElementById("cache-clear") as HTMLButtonElement;
const rootElement = document.documentElement;
const computedStyles = window.getComputedStyle(rootElement);
const DEFAULT_SUBTITLE_FONT_FAMILY =
  computedStyles.getPropertyValue("--subtitle-font-family").trim() ||
  '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_SUBTITLE_FONT_SIZE =
  parseInt(computedStyles.getPropertyValue("--subtitle-font-size"), 10) || 14;
const DEFAULT_SUBTITLE_PRIMARY_COLOR =
  computedStyles.getPropertyValue("--subtitle-primary-text-color").trim() || "#f5f5f5";
const DEFAULT_SUBTITLE_SECONDARY_COLOR =
  computedStyles.getPropertyValue("--subtitle-secondary-text-color").trim() || "#c7d2fe";
const DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR =
  computedStyles.getPropertyValue("--subtitle-active-primary-text-color").trim() || "#fff8dc";
const DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR =
  computedStyles.getPropertyValue("--subtitle-active-secondary-text-color").trim() || "#fff9c4";
const DEFAULT_PROFILE_TEMPLATE: ProfileSettings = {
  subtitleFontFamily: "",
  subtitleFontSize: DEFAULT_SUBTITLE_FONT_SIZE,
  subtitleLineSpacing: 0,
  subtitleTimeTextGap: 2,
  subtitlePrimarySecondaryGap: 3,
  subtitleLineHeight: 1.45,
  subtitlePrimaryColor: DEFAULT_SUBTITLE_PRIMARY_COLOR,
  subtitleSecondaryColor: DEFAULT_SUBTITLE_SECONDARY_COLOR,
  subtitleActivePrimaryColor: DEFAULT_SUBTITLE_ACTIVE_PRIMARY_COLOR,
  subtitleActiveSecondaryColor: DEFAULT_SUBTITLE_ACTIVE_SECONDARY_COLOR,
  ytDlpArgs: "",
  subtitleAutoScrollTimeout: 3,
  subtitleScrollPosition: 33,
  primarySubtitlePriority: [],
  secondarySubtitlePriority: []
};
const MATCH_TYPE_LABELS: Record<UrlMatchType, string> = {
  contains: "Contains",
  exact: "Exact Match",
  regex: "Regex"
};

const SUPPORTED_LANGUAGES = ["en", "zh"];
const DEFAULT_LANGUAGE = "en";
let currentLanguage = DEFAULT_LANGUAGE;

type I18nEntry = {
  element: HTMLElement;
  key: string;
  attr: string;
  defaultValue: string;
};

const translationEntries: I18nEntry[] = [];

const CHINESE_TRANSLATIONS: Record<string, string> = {
  "settings-back": "← 返回",
  "settings-title": "设置",
  "section-global-settings": "全局设置",
  "close-behavior-label": "关闭行为",
  "close-behavior-tray": "关闭时最小化到托盘",
  "close-behavior-quit": "退出应用",
  "auto-start-label": "开机启动",
  "toggle-enable": "启用",
  "toggle-shortcut-label": "切换窗口快捷键",
  "toggle-shortcut-hint": "使用 CommandOrControl、Alt、Shift 等修饰键与按键组合。按 Enter 保存。",
  "process-blacklist-label": "进程黑名单",
  "process-blacklist-hint": "当指定进程处于前台时，快捷键将自动禁用（请输入可执行文件名）。",
  "button-add": "添加",
  "auto-hide-label": "自动隐藏触发区高度",
  "auto-hide-hint": "距离顶部的距离，可保持自动隐藏时面板展开",
  "language-label": "语言",
  "language-option-en": "English",
  "language-option-zh": "中文",
  "language-hint": "选择界面语言。",
  "section-jellyfin": "Jellyfin 集成",
  "jellyfin-enable-label": "启用 Jellyfin",
  "server-list-label": "服务器列表",
  "button-delete": "删除",
  "server-name-label": "服务器名称",
  "server-url-label": "服务器 URL",
  "api-key-label": "API 密钥",
  "ws-path-label": "WebSocket 路径",
  "section-profiles": "配置文件",
  "profile-list-label": "配置文件列表",
  "button-duplicate": "复制",
  "button-set-default": "设为默认",
  "profile-name-label": "配置文件名称",
  "subtitle-font-label": "字幕字体",
  "subtitle-font-size-label": "字幕字体大小",
  "subtitle-autoscroll-label": "自动滚动恢复时间（秒）",
  "subtitle-autoscroll-hint": "手动滚动后多长时间恢复自动跟随",
  "subtitle-scroll-position-label": "字幕滚动位置",
  "subtitle-scroll-position-hint": "活动字幕在面板中的位置（0%=顶部，50%=中间，100%=底部）",
  "subtitle-line-spacing-label": "字幕行间距",
  "subtitle-line-spacing-hint": "调整字幕行之间的垂直间距",
  "subtitle-time-gap-label": "时间戳与文字间距",
  "subtitle-time-gap-hint": "控制时间戳与字幕文本之间的距离",
  "subtitle-primary-secondary-gap-label": "主副字幕间距",
  "subtitle-primary-secondary-gap-hint": "调整主字幕与副字幕之间的垂直距离",
  "subtitle-line-height-label": "字幕行高",
  "subtitle-line-height-hint": "控制字幕行高以提高可读性",
  "subtitle-primary-color-label": "主字幕颜色",
  "subtitle-primary-color-hint": "设置字幕列表中主字幕的默认文本颜色",
  "subtitle-secondary-color-label": "副字幕颜色",
  "subtitle-secondary-color-hint": "设置字幕列表中副字幕的默认文本颜色",
  "subtitle-active-primary-color-label": "高亮主字幕颜色",
  "subtitle-active-primary-color-hint": "调整高亮时主字幕的文字颜色",
  "subtitle-active-secondary-color-label": "高亮副字幕颜色",
  "subtitle-active-secondary-color-hint": "调整高亮时副字幕的文字颜色",
  "primary-priority-label": "主字幕优先级",
  "primary-priority-hint": "匹配语言/标签关键词，可拖拽调整顺序",
  "primary-priority-placeholder": "例如：en",
  "secondary-priority-label": "副字幕优先级",
  "secondary-priority-hint": "通常是你的母语关键词",
  "secondary-priority-placeholder": "例如：zh, zh-Hans",
  "yt-dlp-args-label": "yt-dlp 参数",
  "yt-dlp-args-hint": "留空则使用默认参数",
  "section-cache": "字幕缓存",
  "enable-cache-label": "启用缓存",
  "cache-path-label": "缓存路径",
  "cache-path-hint": "留空则使用默认位置",
  "cache-retention-label": "保留天数",
  "cache-retention-hint": "缓存字幕保留的天数（1-365）",
  "cache-stats-entries": "条目总数：",
  "cache-stats-size": "总大小：",
  "cache-stats-oldest": "最早条目：",
  "button-open-cache": "打开缓存文件夹",
  "button-refresh-stats": "刷新统计",
  "button-cleanup": "清理过期项",
  "button-clear-cache": "清除所有缓存",
  "section-rules": "URL 规则",
  "rule-form-title": "添加规则",
  "rule-form-title-edit": "编辑规则",
  "rule-cancel": "取消编辑",
  "rule-name-label": "规则名称",
  "rule-match-label": "匹配模式",
  "rule-match-contains": "包含",
  "rule-match-exact": "完全匹配",
  "rule-match-regex": "正则表达式",
  "rule-pattern-label": "匹配内容",
  "rule-apply-profile-label": "应用配置文件",
  "rule-form-submit-add": "添加规则",
  "rule-form-submit-save": "保存规则",
  "priority-empty": "暂无优先级",
  "profile-empty": "暂无配置文件",
  "default-badge": "默认",
  "jellyfin-no-servers": "尚未配置服务器",
  "jellyfin-config-enabled": "已启用",
  "jellyfin-config-disabled": "已禁用",
  "rule-empty": "暂无规则",
  "rule-apply-prefix": "应用配置文件：",
  "rule-action-disable": "禁用",
  "rule-action-enable": "启用",
  "rule-action-edit": "编辑",
  "rule-action-delete": "删除",
  "rule-action-move-up": "上移",
  "rule-action-move-down": "下移",
  "game-blacklist-none": "尚未配置任何进程。",
  "game-blacklist-remove": "删除",
  "alert-delete-last-server": "无法删除最后一个服务器。在启用 Jellyfin 时请先禁用 Jellyfin 或添加其他服务器。",
  "alert-delete-default-profile": "无法删除默认配置文件。请先更改默认配置文件。",
  "alert-delete-last-profile": "至少要保留一个配置文件。",
  "alert-profile-referenced": "该配置文件仍被规则引用，请先修改或删除相关规则。",
  "cache-open-error": "无法打开缓存文件夹：{error}",
  "cache-cleanup-success": "清理完成！已移除 {count} 个过期条目。",
  "cache-cleanup-failure": "清理缓存失败：{error}",
  "cache-cleanup-progress": "正在清理...",
  "cache-clear-confirm": "确定要清除所有缓存的字幕吗？该操作无法撤销。",
  "cache-clear-success": "缓存已成功清除！",
  "cache-clear-failure": "清除缓存失败：{error}",
  "cache-clear-progress": "正在清除...",
  "connection-extension": "扩展",
  "connection-jellyfin": "Jellyfin",
  "active-profile-prefix": "配置文件",
  "status-waiting-video": "等待视频...",
  "status-initializing": "初始化中...",
  "status-failed-init": "获取初始状态失败：{error}",
  "status-idle": "等待扩展连接...",
  "status-awaiting-video": "请在浏览器中打开受支持的视频",
  "status-loading-subtitles": "正在下载字幕...",
  "status-ready": "字幕加载完成",
  "status-error": "字幕加载失败",
  "status-unknown": "未知状态",
  "play-button": "播放",
  "pause-button": "暂停",
  "pin-label-unpinned": "未置顶",
  "pin-label-floating": "置顶（普通）",
  "pin-label-screensaver": "置顶（屏保）",
  "primary-track-placeholder": "主字幕",
  "secondary-track-placeholder": "副字幕",
  "secondary-track-none": "无",
  "priority-remove": "移除优先级"
};

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {},
  zh: CHINESE_TRANSLATIONS
};

function normalizeLanguageCode(value: string | null | undefined): string {
  const candidate = (value ?? "").trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(candidate) ? candidate : DEFAULT_LANGUAGE;
}

function collectTranslationEntries() {
  document.querySelectorAll<HTMLElement>("[data-i18n-key]").forEach((element) => {
    const key = element.getAttribute("data-i18n-key");
    if (!key) {
      return;
    }
    const attr = element.getAttribute("data-i18n-attr") ?? "text";
    const defaultValue = attr === "text" ? element.textContent ?? "" : element.getAttribute(attr) ?? "";
    translationEntries.push({ element, key, attr, defaultValue });
  });
}

function applyTranslationEntries(language: string) {
  const dictionary = TRANSLATIONS[language] ?? TRANSLATIONS[DEFAULT_LANGUAGE] ?? {};
  for (const entry of translationEntries) {
    const value = dictionary[entry.key] ?? entry.defaultValue;
    if (entry.attr === "text") {
      entry.element.textContent = value;
    } else {
      entry.element.setAttribute(entry.attr, value);
    }
  }
}

function translate(key: string, fallback: string): string {
  const dictionary = TRANSLATIONS[currentLanguage] ?? TRANSLATIONS[DEFAULT_LANGUAGE] ?? {};
  return dictionary[key] ?? fallback;
}

function formatTranslation(key: string, fallback: string, replacements: Record<string, string> = {}): string {
  let text = translate(key, fallback);
  for (const [placeholder, replacement] of Object.entries(replacements)) {
    text = text.split(`{${placeholder}}`).join(replacement);
  }
  return text;
}

function syncLanguageFromSettings(language?: string | null) {
  currentLanguage = normalizeLanguageCode(language);
  applyTranslationEntries(currentLanguage);
}

function setTranslatedElementText(element: HTMLElement, key: string, fallback: string, attr: string = "text") {
  const dictionary = TRANSLATIONS[currentLanguage] ?? TRANSLATIONS[DEFAULT_LANGUAGE] ?? {};
  const value = dictionary[key] ?? fallback;
  if (attr === "text") {
    element.textContent = value;
  } else {
    element.setAttribute(attr, value);
  }
}

function handleLanguageSelectionChange() {
  if (!languageSelect) {
    return;
  }
  const selected = normalizeLanguageCode(languageSelect.value);
  currentLanguage = selected;
  applyTranslationEntries(selected);
  if (currentStateSnapshot) {
    renderState(currentStateSnapshot);
  }
  if (currentSettings && currentSettings.global.language !== selected) {
    updateSettings({
      global: {
        ...currentSettings.global,
        language: selected
      }
    });
  }
}

collectTranslationEntries();
applyTranslationEntries(currentLanguage);

type CombinedCue = {
  start: number;
  end: number;
  primaryText: string;
  secondaryText: string | null;
};

type PriorityRole = "primary" | "secondary";

type PriorityEditorElements = {
  list: HTMLElement;
  input: HTMLInputElement;
  addButton: HTMLButtonElement;
};

const priorityEditors: Record<PriorityRole, PriorityEditorElements> = {
  primary: {
    list: primaryPriorityList,
    input: primaryPriorityInput,
    addButton: primaryPriorityAddButton
  },
  secondary: {
    list: secondaryPriorityList,
    input: secondaryPriorityInput,
    addButton: secondaryPriorityAddButton
  }
};

// Pin icons for three states
const PIN_ICON_OFF = "📍";           // Unpinned
const PIN_ICON_FLOATING = "📌";      // Pinned (floating)
const PIN_ICON_SCREEN_SAVER = "🔒";  // Locked (screen-saver, highest level)
const FULLSCREEN_ICON_DEFAULT = "⛶";
const FULLSCREEN_ICON_ACTIVE = "🗗";

const PANEL_OPACITY_MIN = 0;
const PANEL_OPACITY_MAX = 100;
const DEFAULT_PANEL_OPACITY = 100;
const DEFAULT_AUTO_HIDE_ACTIVE_ZONE_HEIGHT = DEFAULT_AUTO_HIDE_ZONE_HEIGHT;

let autoHideEnabled = false;
let collapseTimer: number | null = null;
let isCollapsed = false;
let isMouseInActiveZone = false;
let autoHideActiveZoneHeight = DEFAULT_AUTO_HIDE_ACTIVE_ZONE_HEIGHT;

let lastKnownPlaybackState: PlaybackState | null = null;
let playbackPredictionFrame: number | null = null;
let currentSettings: AppSettings | null = null;
let currentStateSnapshot: DesktopState | null = null;
let cueElements: HTMLElement[] = [];
let combinedCues: CombinedCue[] = [];
let activeCueIndex: number | null = null;
let lastTrackSignature = "";
let isSettingsOpen = false;
let autoScrollEnabled = true;
let autoScrollTimer: number | null = null;
let isSubtitlePointerDown = false;
let hasSubtitleTextSelection = false;
let activePriorityDrag: { role: PriorityRole; index: number } | null = null;
let editingProfileId: string | null = null;
let editingRuleId: string | null = null;
let editingJellyfinConfigId: string | null = null;
let playbackProfileSettings: ProfileSettings | null = null;
type SubtitleColorField =
  | "subtitlePrimaryColor"
  | "subtitleSecondaryColor"
  | "subtitleActivePrimaryColor"
  | "subtitleActiveSecondaryColor";

function getActiveProfileId(): string | null {
  if (!currentSettings) {
    return null;
  }
  return currentStateSnapshot?.appliedProfileId ?? currentSettings.defaultProfileId ?? null;
}
let ruleFormInitialized = false;
let loopingCueIndex: number | null = null;
let isTransparencyPopoverOpen = false;
let currentPanelOpacity = DEFAULT_PANEL_OPACITY;
let isAutoHidePreviewVisible = false;
const logPrefixUI = "[Renderer][UI]";
const logPrefixAnim = "[Renderer][Anim]";

function getPredictedPlaybackTime(now = Date.now()): number | null {
  if (!lastKnownPlaybackState) {
    return null;
  }
  const { currentTime, playbackRate, lastUpdate } = lastKnownPlaybackState;
  
  if (typeof lastUpdate !== "number") {
    return currentTime;
  }
  return currentTime + playbackRate * (now - lastUpdate);
}

function ensurePlaybackPredictionLoop() {
  if (playbackPredictionFrame !== null) {
    return;
  }
  const step = () => {
    if (lastKnownPlaybackState) {
      const predictedTime = getPredictedPlaybackTime();
      if (predictedTime !== null) {
        highlightActiveCue(predictedTime);
      }
    }
    playbackPredictionFrame = window.requestAnimationFrame(step);
  };
  playbackPredictionFrame = window.requestAnimationFrame(step);
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    const value = (crypto as Crypto).randomUUID();
    return `${prefix}-${value}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function cloneProfileSettings(settings: ProfileSettings): ProfileSettings {
  return {
    subtitleFontFamily: settings.subtitleFontFamily,
    subtitleFontSize: settings.subtitleFontSize,
    subtitleLineSpacing: settings.subtitleLineSpacing,
    subtitleTimeTextGap: settings.subtitleTimeTextGap,
    subtitlePrimarySecondaryGap: settings.subtitlePrimarySecondaryGap,
    subtitleLineHeight: settings.subtitleLineHeight,
    subtitlePrimaryColor: settings.subtitlePrimaryColor,
    subtitleSecondaryColor: settings.subtitleSecondaryColor,
    subtitleActivePrimaryColor: settings.subtitleActivePrimaryColor,
    subtitleActiveSecondaryColor: settings.subtitleActiveSecondaryColor,
    ytDlpArgs: settings.ytDlpArgs,
    subtitleAutoScrollTimeout: settings.subtitleAutoScrollTimeout,
    subtitleScrollPosition: settings.subtitleScrollPosition,
    primarySubtitlePriority: [...settings.primarySubtitlePriority],
    secondarySubtitlePriority: [...settings.secondarySubtitlePriority]
  };
}

function getProfileById(profileId: string | null): ProfileDefinition | null {
  if (!currentSettings || !profileId) {
    return null;
  }
  return currentSettings.profiles.find((profile) => profile.id === profileId) ?? null;
}

function ensureEditingProfile(): ProfileDefinition | null {
  if (!currentSettings || !currentSettings.profiles.length) {
    return null;
  }
  const existing = editingProfileId ? getProfileById(editingProfileId) : null;
  if (existing) {
    return existing;
  }
  const fallbackId = currentSettings.defaultProfileId ?? currentSettings.profiles[0].id;
  editingProfileId = fallbackId;
  return getProfileById(fallbackId) ?? currentSettings.profiles[0];
}

function getPlaybackProfile(): ProfileDefinition | null {
  if (!currentSettings || !currentSettings.profiles.length) {
    return null;
  }
  const activeId = currentStateSnapshot?.appliedProfileId ?? currentSettings.defaultProfileId;
  return getProfileById(activeId) ?? currentSettings.profiles[0];
}

function syncPlaybackProfileSettings() {
  const profile = getPlaybackProfile();
  playbackProfileSettings = profile?.settings ?? null;
  applySubtitleStyles(playbackProfileSettings);
}

function updateJellyfinSettings(patch: Partial<JellyfinSettings>) {
  if (!currentSettings) {
    return;
  }
  updateSettings({
    jellyfin: {
      ...currentSettings.jellyfin,
      ...patch
    }
  });
}

function getJellyfinConfigById(configId: string): JellyfinConfig | null {
  if (!currentSettings) {
    return null;
  }
  return currentSettings.jellyfin.configs.find((config) => config.id === configId) ?? null;
}

function ensureEditingJellyfinConfig(): JellyfinConfig | null {
  if (!currentSettings) {
    return null;
  }
  if (!editingJellyfinConfigId) {
    const configs = currentSettings.jellyfin.configs;
    if (configs.length > 0) {
      editingJellyfinConfigId = configs[0].id;
      return configs[0];
    }
    return null;
  }
  const config = getJellyfinConfigById(editingJellyfinConfigId);
  if (config) {
    return config;
  }
  const configs = currentSettings.jellyfin.configs;
  if (configs.length > 0) {
    editingJellyfinConfigId = configs[0].id;
    return configs[0];
  }
  editingJellyfinConfigId = null;
  return null;
}

function commitJellyfinConfigs(nextConfigs: JellyfinConfig[]) {
  updateJellyfinSettings({ configs: nextConfigs });
}

function updateJellyfinConfig(configId: string, mutator: (config: JellyfinConfig) => JellyfinConfig) {
  if (!currentSettings) {
    return;
  }
  const configs = currentSettings.jellyfin.configs.map((config) =>
    config.id === configId ? mutator(config) : config
  );
  commitJellyfinConfigs(configs);
}

function updateEditingJellyfinConfig(mutator: (config: JellyfinConfig) => JellyfinConfig) {
  if (!editingJellyfinConfigId) {
    return;
  }
  updateJellyfinConfig(editingJellyfinConfigId, mutator);
}

function commitProfiles(nextProfiles: ProfileDefinition[]) {
  updateSettings({ profiles: nextProfiles });
}

function updateProfile(profileId: string, mutator: (profile: ProfileDefinition) => ProfileDefinition) {
  if (!currentSettings) {
    return;
  }
  const profiles = currentSettings.profiles.map((profile) =>
    profile.id === profileId ? mutator(profile) : profile
  );
  commitProfiles(profiles);
}

function updateEditingProfileSettings(mutator: (settings: ProfileSettings) => ProfileSettings) {
  if (!editingProfileId) {
    return;
  }
  updateProfile(editingProfileId, (profile) => ({
    ...profile,
    settings: mutator(profile.settings)
  }));
}

function formatUrl(url: string | null): string {
  if (!url) return "";
  return url.length > 60 ? `${url.slice(0, 57)}...` : url;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatStatus(state: DesktopState): { text: string; modifier: string } {
  switch (state.status) {
    case "idle":
      return {
        text: translate("status-idle", "Waiting for extension connection..."),
        modifier: ""
      };
    case "awaiting-video":
      return {
        text: translate("status-awaiting-video", "Please open a supported video in your browser"),
        modifier: ""
      };
    case "loading-subtitles":
      return {
        text: translate("status-loading-subtitles", "Downloading subtitles..."),
        modifier: ""
      };
    case "ready":
      return {
        text: translate("status-ready", "Subtitles loaded"),
        modifier: "status-banner--ready"
      };
    case "error":
      return {
        text: state.error ?? translate("status-error", "Subtitle loading failed"),
        modifier: "status-banner--error"
      };
    default:
      return { text: translate("status-unknown", "Unknown status"), modifier: "" };
  }
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor((milliseconds ?? 0) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function mergeSubtitleCues(primary: SubtitleCue[], secondary: SubtitleCue[]): CombinedCue[] {
  if (!primary.length) {
    return [];
  }

  if (!secondary.length) {
    return primary.map((cue) => ({
      start: cue.start,
      end: cue.end,
      primaryText: cue.text,
      secondaryText: null
    }));
  }

  const merged: CombinedCue[] = [];
  let secondaryIndex = 0;

  for (const primaryCue of primary) {
    while (secondaryIndex < secondary.length && secondary[secondaryIndex].end < primaryCue.start) {
      secondaryIndex += 1;
    }

    let bestMatch: SubtitleCue | null = null;
    let bestOverlap = -1;

    for (let i = secondaryIndex; i < secondary.length; i += 1) {
      const candidate = secondary[i];
      if (candidate.start > primaryCue.end) {
        break;
      }
      const overlap = Math.min(primaryCue.end, candidate.end) - Math.max(primaryCue.start, candidate.start);
      if (overlap >= 0 && overlap >= bestOverlap) {
        bestOverlap = overlap;
        bestMatch = candidate;
      }
    }

    merged.push({
      start: primaryCue.start,
      end: primaryCue.end,
      primaryText: primaryCue.text,
      secondaryText: bestMatch ? bestMatch.text : null
    });
  }

  return merged;
}

function getPriorityValues(role: PriorityRole): string[] {
  const profile = ensureEditingProfile();
  if (!profile) {
    return [];
  }
  return role === "primary"
    ? profile.settings.primarySubtitlePriority
    : profile.settings.secondarySubtitlePriority;
}

function requestPriorityUpdate(role: PriorityRole, values: string[]) {
  const key = role === "primary" ? "primarySubtitlePriority" : "secondarySubtitlePriority";
  updateEditingProfileSettings((settings) => ({
    ...settings,
    [key]: values
  }));
}

function renderPriorityEditor(role: PriorityRole, values: string[]) {
  const container = priorityEditors[role].list;
  container.innerHTML = "";

  if (!values.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "priority-editor__empty";
    setTranslatedElementText(placeholder, "priority-empty", "No priorities");
    container.appendChild(placeholder);
    return;
  }

  values.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "priority-editor__item";
    item.draggable = true;
    item.dataset.index = String(index);

    const textNode = document.createElement("span");
    textNode.className = "priority-editor__item-text";
    textNode.textContent = value;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "priority-editor__item-remove";
    setTranslatedElementText(removeButton, "priority-remove", "Remove priority", "aria-label");
    removeButton.textContent = "×";

    item.appendChild(textNode);
    item.appendChild(removeButton);
    container.appendChild(item);
  });
}

function renderProfileList(settings: AppSettings) {
  profileListElement.innerHTML = "";
  if (!settings.profiles.length) {
    const empty = document.createElement("div");
    empty.className = "profile-list__empty";
    setTranslatedElementText(empty, "profile-empty", "No profiles");
    profileListElement.appendChild(empty);
    return;
  }

  settings.profiles.forEach((profile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-list__item";
    button.dataset.id = profile.id;
    if (profile.id === editingProfileId) {
      button.classList.add("is-selected");
    }
    const name = document.createElement("span");
    name.className = "profile-list__name";
    name.textContent = profile.name;
    button.appendChild(name);

    if (profile.id === settings.defaultProfileId) {
      const badge = document.createElement("span");
      badge.className = "profile-list__badge";
      setTranslatedElementText(badge, "default-badge", "Default");
      button.appendChild(badge);
    }

    button.addEventListener("click", () => {
      editingProfileId = profile.id;
      renderProfileList(settings);
      renderProfileEditor();
    });

    profileListElement.appendChild(button);
  });
}

function renderProfileEditor() {
  if (!currentSettings) {
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile) {
    return;
  }
  const settings = profile.settings;
  profileNameInput.value = profile.name;
  subtitleFontInput.value = settings.subtitleFontFamily;
  subtitleFontSizeInput.value = String(settings.subtitleFontSize);
  subtitleAutoScrollTimeoutInput.value = String(settings.subtitleAutoScrollTimeout);
  subtitleScrollPositionInput.value = String(settings.subtitleScrollPosition);
  subtitleScrollPositionValue.textContent = `${settings.subtitleScrollPosition}%`;
  const lineSpacing = settings.subtitleLineSpacing ?? DEFAULT_PROFILE_TEMPLATE.subtitleLineSpacing;
  subtitleLineSpacingInput.value = String(lineSpacing);
  subtitleLineSpacingValue.textContent = `${lineSpacing}px`;
  const timeTextGap = settings.subtitleTimeTextGap ?? DEFAULT_PROFILE_TEMPLATE.subtitleTimeTextGap;
  subtitleTimeTextGapInput.value = String(timeTextGap);
  subtitleTimeTextGapValue.textContent = `${timeTextGap}px`;
  const primarySecondaryGap =
    settings.subtitlePrimarySecondaryGap ?? DEFAULT_PROFILE_TEMPLATE.subtitlePrimarySecondaryGap;
  subtitlePrimarySecondaryGapInput.value = String(primarySecondaryGap);
  subtitlePrimarySecondaryGapValue.textContent = `${primarySecondaryGap}px`;
  const lineHeight =
    settings.subtitleLineHeight ?? DEFAULT_PROFILE_TEMPLATE.subtitleLineHeight;
  const formattedLineHeight = Number(lineHeight).toFixed(2);
  subtitleLineHeightInput.value = formattedLineHeight;
  subtitleLineHeightValue.textContent = formattedLineHeight;
  subtitlePrimaryColorInput.value =
    settings.subtitlePrimaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitlePrimaryColor;
  subtitleSecondaryColorInput.value =
    settings.subtitleSecondaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitleSecondaryColor;
  subtitleActivePrimaryColorInput.value =
    settings.subtitleActivePrimaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitleActivePrimaryColor;
  subtitleActiveSecondaryColorInput.value =
    settings.subtitleActiveSecondaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitleActiveSecondaryColor;
  ytDlpArgsInput.placeholder = DEFAULT_YTDLP_ARGS;
  if (ytDlpArgsInput.value !== settings.ytDlpArgs) {
    ytDlpArgsInput.value = settings.ytDlpArgs;
  }
  renderPriorityEditor("primary", settings.primarySubtitlePriority);
  renderPriorityEditor("secondary", settings.secondarySubtitlePriority);

  const isDefault = currentSettings.defaultProfileId === profile.id;
  profileDeleteButton.disabled = isDefault || currentSettings.profiles.length <= 1;
  profileSetDefaultButton.disabled = isDefault;
}

function renderJellyfinConfigList(settings: AppSettings) {
  jellyfinConfigListElement.innerHTML = "";
  const configs = settings.jellyfin.configs;

  if (configs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "jellyfin-config-list__empty";
    setTranslatedElementText(empty, "jellyfin-no-servers", "No servers configured");
    jellyfinConfigListElement.appendChild(empty);
    return;
  }

  for (const config of configs) {
    const button = document.createElement("button");
    button.className = "jellyfin-config-list__item";
    button.type = "button";

    if (config.id === editingJellyfinConfigId) {
      button.classList.add("is-selected");
    }
    if (!config.enabled) {
      button.classList.add("is-disabled");
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "jellyfin-config-list__name";
    nameSpan.textContent = config.name;
    button.appendChild(nameSpan);

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "toggle jellyfin-config-list__toggle";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = Boolean(config.enabled);
    toggleInput.addEventListener("click", (event) => event.stopPropagation());
    const toggleText = document.createElement("span");
    toggleText.className = "toggle__text";
    setTranslatedElementText(
      toggleText,
      config.enabled ? "jellyfin-config-enabled" : "jellyfin-config-disabled",
      config.enabled ? "Enabled" : "Disabled"
    );
    toggleInput.addEventListener("change", () => {
      const nextEnabled = toggleInput.checked;
      setTranslatedElementText(
        toggleText,
        nextEnabled ? "jellyfin-config-enabled" : "jellyfin-config-disabled",
        nextEnabled ? "Enabled" : "Disabled"
      );
      updateJellyfinConfig(config.id, (cfg) => ({
        ...cfg,
        enabled: nextEnabled
      }));
    });
    toggleLabel.append(toggleInput, toggleText);
    button.appendChild(toggleLabel);

    button.addEventListener("click", () => {
      editingJellyfinConfigId = config.id;
      renderJellyfinConfigList(settings);
      renderJellyfinConfigEditor();
    });

    jellyfinConfigListElement.appendChild(button);
  }
}

function renderJellyfinConfigEditor() {
  if (!currentSettings) {
    return;
  }
  const config = ensureEditingJellyfinConfig();
  if (!config) {
    if (jellyfinConfigNameInput) jellyfinConfigNameInput.value = "";
    if (jellyfinServerInput) jellyfinServerInput.value = "";
    if (jellyfinApiKeyInput) jellyfinApiKeyInput.value = "";
    if (jellyfinWsPathInput) jellyfinWsPathInput.value = "";
    jellyfinConfigDeleteButton.disabled = true;
    return;
  }
  
  if (jellyfinConfigNameInput) {
    jellyfinConfigNameInput.value = config.name;
  }
  if (jellyfinServerInput) {
    jellyfinServerInput.value = config.serverUrl;
  }
  if (jellyfinApiKeyInput) {
    jellyfinApiKeyInput.value = config.apiKey;
  }
  if (jellyfinWsPathInput) {
    jellyfinWsPathInput.value = config.webSocketPath;
  }
  
  jellyfinConfigDeleteButton.disabled = false;
}

function handleJellyfinConfigAdd() {
  if (!currentSettings) {
    return;
  }
  const newConfig: JellyfinConfig = {
    id: createId("jellyfin-config"),
    name: `Server ${currentSettings.jellyfin.configs.length + 1}`,
    serverUrl: "",
    apiKey: "",
    webSocketPath: "/socket",
    enabled: true
  };
  editingJellyfinConfigId = newConfig.id;
  const newConfigs = [...currentSettings.jellyfin.configs, newConfig];
  updateJellyfinSettings({ 
    configs: newConfigs
  });
}

function handleJellyfinConfigDelete() {
  const config = ensureEditingJellyfinConfig();
  if (!config || !currentSettings) {
    return;
  }
  
  if (currentSettings.jellyfin.configs.length <= 1 && currentSettings.jellyfin.enabled) {
    window.alert(translate(
      "alert-delete-last-server",
      "Cannot delete the last server while Jellyfin is enabled. Disable Jellyfin first or add another server."
    ));
    return;
  }
  
  const nextConfigs = currentSettings.jellyfin.configs.filter((item) => item.id !== config.id);
  
  editingJellyfinConfigId = nextConfigs.length > 0 ? nextConfigs[0].id : null;
  updateJellyfinSettings({
    configs: nextConfigs
  });
}

function handleProfileAdd() {
  if (!currentSettings) {
    return;
  }
  const newProfile: ProfileDefinition = {
    id: createId("profile"),
    name: `Profile ${currentSettings.profiles.length + 1}`,
    description: null,
    settings: cloneProfileSettings(DEFAULT_PROFILE_TEMPLATE)
  };
  editingProfileId = newProfile.id;
  updateSettings({ profiles: [...currentSettings.profiles, newProfile] });
}

function handleProfileDuplicate() {
  const profile = ensureEditingProfile();
  if (!profile || !currentSettings) {
    return;
  }
  const copy: ProfileDefinition = {
    id: createId("profile"),
    name: `${profile.name} Copy`,
    description: profile.description ?? null,
    settings: cloneProfileSettings(profile.settings)
  };
  editingProfileId = copy.id;
  updateSettings({ profiles: [...currentSettings.profiles, copy] });
}

function handleProfileDelete() {
  const profile = ensureEditingProfile();
  if (!profile || !currentSettings) {
    return;
  }
  if (profile.id === currentSettings.defaultProfileId) {
    window.alert(
      translate(
        "alert-delete-default-profile",
        "Cannot delete the default profile. Please change the default profile first."
      )
    );
    return;
  }
  if (currentSettings.profiles.length <= 1) {
    window.alert(translate("alert-delete-last-profile", "At least one profile must remain."));
    return;
  }
  if (currentSettings.rules.some((rule) => rule.profileId === profile.id)) {
    window.alert(
      translate(
        "alert-profile-referenced",
        "This profile is still referenced by rules. Please modify or delete the related rules first."
      )
    );
    return;
  }
  const profiles = currentSettings.profiles.filter((item) => item.id !== profile.id);
  editingProfileId = profiles[0]?.id ?? currentSettings.defaultProfileId ?? null;
  updateSettings({ profiles });
}

function handleSetDefaultProfile() {
  const profile = ensureEditingProfile();
  if (!profile || !currentSettings) {
    return;
  }
  if (profile.id === currentSettings.defaultProfileId) {
    return;
  }
  updateSettings({ defaultProfileId: profile.id });
}

function getProfileDisplayName(profileId: string): string {
  if (!currentSettings) {
    return profileId;
  }
  return currentSettings.profiles.find((profile) => profile.id === profileId)?.name ?? "Unknown Profile";
}

function createRuleActionButton(label: string, handler: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rule-item__action";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", handler);
  return button;
}

function renderRuleList() {
  const settings = currentSettings;
  if (!settings) {
    return;
  }

  ruleListElement.innerHTML = "";
  if (!settings.rules.length) {
    const empty = document.createElement("div");
    empty.className = "rule-list__empty";
    setTranslatedElementText(empty, "rule-empty", "No rules");
    ruleListElement.appendChild(empty);
    return;
  }

  settings.rules.forEach((rule, index) => {
    const item = document.createElement("div");
    item.className = "rule-item";
    if (!rule.isEnabled) {
      item.classList.add("is-disabled");
    }
    item.dataset.id = rule.id;

    const header = document.createElement("div");
    header.className = "rule-item__header";

    const title = document.createElement("div");
    title.className = "rule-item__title";
    title.textContent = rule.name;

    const meta = document.createElement("div");
    meta.className = "rule-item__meta";
    const fallbackMatch = MATCH_TYPE_LABELS[rule.matchType] ?? rule.matchType;
    const matchLabel = translate(`rule-match-${rule.matchType}`, fallbackMatch ?? rule.matchType);
    meta.textContent = `${matchLabel}：${rule.pattern}`;

    header.appendChild(title);
    header.appendChild(meta);
    item.appendChild(header);

    const target = document.createElement("div");
    target.className = "rule-item__profile";
    const applyPrefix = translate("rule-apply-prefix", "Apply Profile: ");
    target.textContent = `${applyPrefix}${getProfileDisplayName(rule.profileId)}`;
    item.appendChild(target);

    const actions = document.createElement("div");
    actions.className = "rule-item__actions";
    const toggleLabel = rule.isEnabled ? "rule-action-disable" : "rule-action-enable";
    const toggleButton = createRuleActionButton(
      translate(toggleLabel, rule.isEnabled ? "Disable" : "Enable"),
      () => handleRuleToggle(rule.id)
    );
    const editButton = createRuleActionButton(translate("rule-action-edit", "Edit"), () => handleRuleEdit(rule.id));
    const deleteButton = createRuleActionButton(translate("rule-action-delete", "Delete"), () => handleRuleDelete(rule.id));
    const upButton = createRuleActionButton(
      translate("rule-action-move-up", "Move Up"),
      () => handleRuleMove(rule.id, -1),
      index === 0
    );
    const downButton = createRuleActionButton(
      translate("rule-action-move-down", "Move Down"),
      () => handleRuleMove(rule.id, +1),
      index === settings.rules.length - 1
    );
    actions.append(upButton, downButton, toggleButton, editButton, deleteButton);
    item.appendChild(actions);

    ruleListElement.appendChild(item);
  });
}

function updateRuleProfileOptions() {
  if (!currentSettings) {
    return;
  }
  const previousValue = ruleProfileSelect.value;
  ruleProfileSelect.innerHTML = "";
  currentSettings.profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    ruleProfileSelect.appendChild(option);
  });
  if (previousValue && getProfileById(previousValue)) {
    ruleProfileSelect.value = previousValue;
  } else {
    const fallbackProfile = ensureEditingProfile();
    if (fallbackProfile) {
      ruleProfileSelect.value = fallbackProfile.id;
    }
  }
}

function resetRuleForm() {
  editingRuleId = null;
  ruleFormInitialized = true;
  setTranslatedElementText(ruleFormTitle, "rule-form-title", "Add Rule");
  setTranslatedElementText(ruleSaveButton, "rule-form-submit-add", "Add Rule");
  ruleCancelButton.classList.add("is-hidden");
  ruleNameInput.value = "";
  rulePatternInput.value = "";
  ruleMatchTypeSelect.value = "contains";
  const fallback = ensureEditingProfile();
  if (fallback) {
    ruleProfileSelect.value = fallback.id;
  }
}

function populateRuleForm(rule: ProfileRule) {
  editingRuleId = rule.id;
  setTranslatedElementText(ruleFormTitle, "rule-form-title-edit", "Edit Rule");
  setTranslatedElementText(ruleSaveButton, "rule-form-submit-save", "Save Rule");
  ruleCancelButton.classList.remove("is-hidden");
  ruleNameInput.value = rule.name;
  rulePatternInput.value = rule.pattern;
  ruleMatchTypeSelect.value = rule.matchType;
  if (getProfileById(rule.profileId)) {
    ruleProfileSelect.value = rule.profileId;
  }
}

function collectRuleFormData(): { name: string; pattern: string; matchType: UrlMatchType; profileId: string } | null {
  if (!currentSettings) {
    return null;
  }
  const pattern = rulePatternInput.value.trim();
  if (!pattern.length) {
    rulePatternInput.focus();
    return null;
  }
  const name = ruleNameInput.value.trim() || pattern;
  const matchType = (ruleMatchTypeSelect.value as UrlMatchType) ?? "contains";
  let profileId = ruleProfileSelect.value;
  if (!getProfileById(profileId)) {
    profileId = currentSettings.defaultProfileId;
  }
  return { name, pattern, matchType, profileId };
}

function handleRuleSave() {
  if (!currentSettings) {
    return;
  }
  const data = collectRuleFormData();
  if (!data) {
    return;
  }

  if (editingRuleId) {
    const rules = currentSettings.rules.map((rule) =>
      rule.id === editingRuleId
        ? {
            ...rule,
            ...data
          }
        : rule
    );
    updateSettings({ rules });
  } else {
    const newRule: ProfileRule = {
      id: createId("rule"),
      isEnabled: true,
      ...data
    };
    updateSettings({ rules: [...currentSettings.rules, newRule] });
  }

  resetRuleForm();
}

function handleRuleEdit(ruleId: string) {
  if (!currentSettings) {
    return;
  }
  const rule = currentSettings.rules.find((item) => item.id === ruleId);
  if (!rule) {
    return;
  }
  populateRuleForm(rule);
}

function handleRuleDelete(ruleId: string) {
  if (!currentSettings) {
    return;
  }
  const rules = currentSettings.rules.filter((rule) => rule.id !== ruleId);
  updateSettings({ rules });
  if (editingRuleId === ruleId) {
    resetRuleForm();
  }
}

function handleRuleMove(ruleId: string, delta: number) {
  if (!currentSettings) {
    return;
  }
  const rules = [...currentSettings.rules];
  const index = rules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) {
    return;
  }
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= rules.length) {
    return;
  }
  const [rule] = rules.splice(index, 1);
  rules.splice(targetIndex, 0, rule);
  updateSettings({ rules });
}

function handleRuleToggle(ruleId: string) {
  if (!currentSettings) {
    return;
  }
  const rules = currentSettings.rules.map((rule) =>
    rule.id === ruleId ? { ...rule, isEnabled: !rule.isEnabled } : rule
  );
  updateSettings({ rules });
}

function handlePriorityAdd(role: PriorityRole) {
  const editor = priorityEditors[role];
  const rawValue = editor.input.value.trim();
  if (!rawValue) {
    return;
  }
  const normalized = rawValue.toLowerCase();
  const existing = getPriorityValues(role).map((value) => value.toLowerCase());
  if (existing.includes(normalized)) {
    editor.input.value = "";
    return;
  }
  const nextValues = [...getPriorityValues(role), rawValue];
  requestPriorityUpdate(role, nextValues);
  editor.input.value = "";
}

function handlePriorityRemove(role: PriorityRole, index: number) {
  const values = [...getPriorityValues(role)];
  if (index < 0 || index >= values.length) {
    return;
  }
  values.splice(index, 1);
  requestPriorityUpdate(role, values);
}

function reorderPriorityValue(role: PriorityRole, fromIndex: number, toIndex: number) {
  const values = [...getPriorityValues(role)];
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= values.length ||
    toIndex >= values.length
  ) {
    return;
  }
  const [moved] = values.splice(fromIndex, 1);
  values.splice(toIndex, 0, moved);
  requestPriorityUpdate(role, values);
}

function clearPriorityDragClasses(role: PriorityRole) {
  priorityEditors[role].list
    .querySelectorAll(".priority-editor__item--dragover")
    .forEach((el) => el.classList.remove("priority-editor__item--dragover"));
}

function setupPriorityEditorInteractions(role: PriorityRole) {
  const editor = priorityEditors[role];

  editor.addButton.addEventListener("click", () => {
    handlePriorityAdd(role);
  });

  editor.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handlePriorityAdd(role);
    }
  });

  editor.list.addEventListener("click", (event) => {
    const removeButton = (event.target as HTMLElement).closest(".priority-editor__item-remove");
    if (!removeButton) {
      return;
    }
    const parent = removeButton.closest(".priority-editor__item") as HTMLElement | null;
    if (!parent) {
      return;
    }
    const index = Number(parent.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    handlePriorityRemove(role, index);
  });

  editor.list.addEventListener("dragstart", (event) => {
    const target = (event.target as HTMLElement).closest(".priority-editor__item") as HTMLElement | null;
    if (!target) {
      return;
    }
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    activePriorityDrag = { role, index };
    event.dataTransfer?.setData("text/plain", String(index));
    event.dataTransfer?.setDragImage(target, 0, 0);
  });

  editor.list.addEventListener("dragover", (event) => {
    if (!activePriorityDrag || activePriorityDrag.role !== role) {
      return;
    }
    const target = (event.target as HTMLElement).closest(".priority-editor__item") as HTMLElement | null;
    if (!target) {
      return;
    }
    event.preventDefault();
    clearPriorityDragClasses(role);
    target.classList.add("priority-editor__item--dragover");
  });

  editor.list.addEventListener("dragleave", () => {
    clearPriorityDragClasses(role);
  });

  editor.list.addEventListener("drop", (event) => {
    if (!activePriorityDrag || activePriorityDrag.role !== role) {
      return;
    }
    const target = (event.target as HTMLElement).closest(".priority-editor__item") as HTMLElement | null;
    if (!target) {
      return;
    }
    event.preventDefault();
    const targetIndex = Number(target.dataset.index);
    if (Number.isNaN(targetIndex)) {
      return;
    }
    const sourceIndex = activePriorityDrag.index;
    clearPriorityDragClasses(role);
    activePriorityDrag = null;
    reorderPriorityValue(role, sourceIndex, targetIndex);
  });

  editor.list.addEventListener("dragend", () => {
    clearPriorityDragClasses(role);
    activePriorityDrag = null;
  });
}

function getGameProcessBlacklistValues(): string[] {
  if (!currentSettings) {
    return [];
  }
  return currentSettings.global.gameProcessBlacklist ?? [];
}

function requestGameProcessBlacklistUpdate(nextValues: string[]) {
  if (!currentSettings) {
    return;
  }
  updateSettings({
    global: {
      ...currentSettings.global,
      gameProcessBlacklist: nextValues
    }
  });
}

function handleGameProcessBlacklistAdd() {
  if (!gameProcessInput) {
    return;
  }
  const rawValue = gameProcessInput.value.trim();
  if (!rawValue || !currentSettings) {
    return;
  }
  const normalized = rawValue.toLowerCase();
  const existing = getGameProcessBlacklistValues().map((item) => item.toLowerCase());
  if (existing.includes(normalized)) {
    gameProcessInput.value = "";
    return;
  }
  const nextValues = [...getGameProcessBlacklistValues(), rawValue];
  requestGameProcessBlacklistUpdate(nextValues);
  gameProcessInput.value = "";
}

function handleGameProcessBlacklistRemove(index: number) {
  const values = [...getGameProcessBlacklistValues()];
  if (index < 0 || index >= values.length) {
    return;
  }
  values.splice(index, 1);
  requestGameProcessBlacklistUpdate(values);
}

function renderGameProcessBlacklist(values: string[]) {
  if (!gameProcessListElement) {
    return;
  }
  gameProcessListElement.innerHTML = "";
  if (!values.length) {
    const empty = document.createElement("div");
    empty.className = "game-blacklist-editor__empty";
    setTranslatedElementText(empty, "game-blacklist-none", "None configured.");
    gameProcessListElement.appendChild(empty);
    return;
  }

  values.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "game-blacklist-editor__item";
    item.dataset.index = String(index);

    const name = document.createElement("span");
    name.textContent = value;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "text-button game-blacklist-editor__item-remove";
    setTranslatedElementText(removeButton, "game-blacklist-remove", "Remove");
    setTranslatedElementText(removeButton, "game-blacklist-remove", "Remove", "aria-label");
    removeButton.addEventListener("click", () => handleGameProcessBlacklistRemove(index));

    item.append(name, removeButton);
    gameProcessListElement.appendChild(item);
  });
}

function renderSubtitles(primaryTrack: SubtitleTrack | null, secondaryTrack: SubtitleTrack | null) {
  subtitleList.innerHTML = "";
  cueElements = [];
  combinedCues = [];
  activeCueIndex = null;
  loopingCueIndex = null;

  if (!primaryTrack) {
    return;
  }

  combinedCues = mergeSubtitleCues(primaryTrack.cues, secondaryTrack?.cues ?? []);

  combinedCues.forEach((cue, index) => {
    const item = document.createElement("div");
    item.className = "subtitle-item";
    item.dataset.index = String(index);

    const timeContainer = document.createElement("div");
    timeContainer.className = "subtitle-item__time";

    const time = document.createElement("span");
    time.textContent = `${formatTime(cue.start)} - ${formatTime(cue.end)}`;

    const playButton = document.createElement("button");
    playButton.className = "subtitle-item__play-btn";
    playButton.type = "button";
    playButton.setAttribute("aria-label", "Play from this subtitle");
    playButton.innerHTML = "&#9654;"; // Unicode triangle play icon
    playButton.dataset.index = String(index);

    const loopButton = document.createElement("button");
    loopButton.className = "subtitle-item__loop-btn";
    loopButton.type = "button";
    loopButton.setAttribute("aria-label", "Loop this subtitle");
    loopButton.innerHTML = "&#8635;"; // Unicode loop/repeat icon
    loopButton.dataset.index = String(index);

    timeContainer.appendChild(time);
    timeContainer.appendChild(playButton);
    timeContainer.appendChild(loopButton);

    const text = document.createElement("div");
    text.className = "subtitle-item__text";

    const primaryLine = document.createElement("div");
    primaryLine.className = "subtitle-item__text-primary";
    primaryLine.innerHTML = escapeHtml(cue.primaryText).replace(/\n/g, "<br />");
    text.appendChild(primaryLine);

    if (cue.secondaryText) {
      const secondaryLine = document.createElement("div");
      secondaryLine.className = "subtitle-item__text-secondary";
      secondaryLine.innerHTML = escapeHtml(cue.secondaryText).replace(/\n/g, "<br />");
      text.appendChild(secondaryLine);
    }

    item.appendChild(timeContainer);
    item.appendChild(text);
    subtitleList.appendChild(item);
    cueElements.push(item);
  });
}

function highlightActiveCue(currentTime: number) {
  if (!combinedCues.length) return;

  // In loop mode, lock highlight to the looped cue index
  if (lastKnownPlaybackState?.isLooping && lastKnownPlaybackState.loopCueIndex !== null) {
    const lockedIndex = lastKnownPlaybackState.loopCueIndex;
    
    if (activeCueIndex !== lockedIndex) {
      // Remove highlight from current active cue
    if (activeCueIndex !== null && cueElements[activeCueIndex]) {
      console.debug(`${logPrefixAnim} remove-active`, { index: activeCueIndex });
      cueElements[activeCueIndex].classList.remove("subtitle-item--active");
    }
      
      // Highlight the locked cue
      const element = cueElements[lockedIndex];
      if (element) {
        element.classList.add("subtitle-item--active");
        if (autoScrollEnabled) {
          scrollToActiveSubtitle(element);
        }
        activeCueIndex = lockedIndex;
      }
    }
    return; // Skip time-based matching in loop mode
  }

  // Normal mode: find cue by time
  const newIndex = combinedCues.findIndex((cue) => currentTime >= cue.start && currentTime <= cue.end);
  
  if (newIndex === -1) {
    if (activeCueIndex !== null && cueElements[activeCueIndex]) {
      cueElements[activeCueIndex].classList.remove("subtitle-item--active");
      activeCueIndex = null;
    }
    return;
  }

  if (newIndex === activeCueIndex) {
    return;
  }

  if (activeCueIndex !== null && cueElements[activeCueIndex]) {
    console.debug(`${logPrefixAnim} switch-active`, { from: activeCueIndex, to: newIndex });
    cueElements[activeCueIndex].classList.remove("subtitle-item--active");
  }

  const element = cueElements[newIndex];
  if (element) {
    console.debug(`${logPrefixAnim} add-active`, { index: newIndex, time: currentTime });
    element.classList.add("subtitle-item--active");
    if (autoScrollEnabled) {
      scrollToActiveSubtitle(element);
    }
    activeCueIndex = newIndex;
  }
}

function scrollToActiveSubtitle(element: HTMLElement) {
  const container = subtitleList;
  const elementTop = element.offsetTop;
  const containerHeight = container.clientHeight;
  const elementHeight = element.offsetHeight;
  
  // Use the position percentage from the currently active configuration (0-100)
  const positionPercent = (playbackProfileSettings?.subtitleScrollPosition ?? DEFAULT_PROFILE_TEMPLATE.subtitleScrollPosition) / 100;
  const targetScroll = elementTop - containerHeight * positionPercent + elementHeight / 2;
  
  console.debug(`${logPrefixAnim} scroll`, {
    elementTop,
    containerHeight,
    elementHeight,
    positionPercent,
    targetScroll
  });
  container.scrollTo({
    top: targetScroll,
    behavior: "smooth"
  });
}

function clearLoopUI() {
  if (loopingCueIndex !== null) {
    // Remove active class from loop button
    const loopButton = document.querySelector(
      `.subtitle-item__loop-btn[data-index="${loopingCueIndex}"]`
    );
    if (loopButton) {
      console.debug(`${logPrefixAnim} loop-btn-remove-active`, { index: loopingCueIndex });
      loopButton.classList.remove("subtitle-item__loop-btn--active");
    }
    loopingCueIndex = null;
  }
}

function pauseAutoScrollImmediate() {
  if (autoScrollTimer !== null) {
    clearTimeout(autoScrollTimer);
    autoScrollTimer = null;
  }
  autoScrollEnabled = false;
}

function resetAutoScrollTimer() {
  pauseAutoScrollImmediate();
  if (isSubtitlePointerDown || hasSubtitleTextSelection) {
    return;
  }
  const timeoutSeconds = playbackProfileSettings?.subtitleAutoScrollTimeout ?? DEFAULT_PROFILE_TEMPLATE.subtitleAutoScrollTimeout;
  autoScrollTimer = window.setTimeout(() => {
    autoScrollEnabled = true;
    autoScrollTimer = null;
    // When auto-scroll is restored, immediately scroll to the currently active subtitle
    if (activeCueIndex !== null && cueElements[activeCueIndex]) {
      scrollToActiveSubtitle(cueElements[activeCueIndex]);
    }
  }, timeoutSeconds * 1000);
}

function isNodeInsideSubtitleList(node: Node | null): boolean {
  return node instanceof Node && subtitleList.contains(node);
}

function handleSubtitleSelectionChange() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    if (!hasSubtitleTextSelection) {
      return;
    }
    hasSubtitleTextSelection = false;
    resetAutoScrollTimer();
    return;
  }
  const selectionActive =
    isNodeInsideSubtitleList(selection.anchorNode) ||
    isNodeInsideSubtitleList(selection.focusNode);
  if (selectionActive === hasSubtitleTextSelection) {
    return;
  }
  hasSubtitleTextSelection = selectionActive;
  if (selectionActive) {
    pauseAutoScrollImmediate();
    return;
  }
  resetAutoScrollTimer();
}

function renderTrackSelectors(state: DesktopState) {
  controlPanel.style.display = "flex";
  if (!state.subtitleTracks.length) {
    primaryTrackSelector.innerHTML = "";
    const placeholderPrimary = document.createElement("option");
    placeholderPrimary.value = "";
    placeholderPrimary.disabled = true;
    placeholderPrimary.selected = true;
    setTranslatedElementText(placeholderPrimary, "primary-track-placeholder", "Primary Subtitle");
    primaryTrackSelector.appendChild(placeholderPrimary);

    secondaryTrackSelector.innerHTML = "";
    const placeholderSecondary = document.createElement("option");
    placeholderSecondary.value = "";
    placeholderSecondary.disabled = true;
    placeholderSecondary.selected = true;
    setTranslatedElementText(placeholderSecondary, "secondary-track-placeholder", "Secondary Subtitle");
    secondaryTrackSelector.appendChild(placeholderSecondary);

    lastTrackSignature = "";
    return;
  }

  const signature = state.subtitleTracks.map((track) => `${track.id}:${track.label}`).join("|");

  if (signature !== lastTrackSignature) {
    primaryTrackSelector.innerHTML = "";
    secondaryTrackSelector.innerHTML = "";

    state.subtitleTracks.forEach((track) => {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = track.label || track.language;
      primaryTrackSelector.appendChild(option);
    });

    const noneOption = document.createElement("option");
    noneOption.value = "";
    setTranslatedElementText(noneOption, "secondary-track-none", "None");
    secondaryTrackSelector.appendChild(noneOption);

    state.subtitleTracks.forEach((track) => {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = track.label || track.language;
      secondaryTrackSelector.appendChild(option);
    });

    lastTrackSignature = signature;
  }

  const fallbackPrimaryId = state.subtitleTracks[0]?.id ?? "";
  const desiredPrimary = state.selectedPrimarySubtitleId ?? fallbackPrimaryId;
  if (desiredPrimary) {
    primaryTrackSelector.value = desiredPrimary;
    if (primaryTrackSelector.value !== desiredPrimary && fallbackPrimaryId) {
      primaryTrackSelector.value = fallbackPrimaryId;
    }
  } else {
    primaryTrackSelector.selectedIndex = -1;
  }

  const secondaryValue = state.selectedSecondarySubtitleId ?? "";
  secondaryTrackSelector.value = secondaryValue;
  if (secondaryTrackSelector.value !== secondaryValue) {
    secondaryTrackSelector.value = "";
  }
}

function renderState(state: DesktopState) {
  currentStateSnapshot = state;
  
  // Update playback state to ensure highlight uses latest data
  lastKnownPlaybackState = state.playback;
  
  if (currentSettings) {
    syncPlaybackProfileSettings();
  }

  const browserStatus = `${translate("connection-extension", "Extension")}: ${state.connectionCount}`;
  const jellyfinStatus = `${translate("connection-jellyfin", "Jellyfin")}: ${state.jellyfin.sessions.length}`;
  connectionIndicator.textContent = `${browserStatus} · ${jellyfinStatus}`;

  videoTitle.textContent = state.title ?? translate("status-waiting-video", "Waiting for video...");
  videoUrl.textContent = formatUrl(state.videoUrl);

  if (activeProfileLabel) {
    const profileName = state.appliedProfileName ?? "Default Profile";
    const profileLabel = translate("active-profile-prefix", "Profile");
    if (state.appliedRulePattern) {
      const matchLabel = state.appliedRuleMatchType
        ? translate(
            `rule-match-${state.appliedRuleMatchType}`,
            MATCH_TYPE_LABELS[state.appliedRuleMatchType] ?? state.appliedRuleMatchType ?? "Rule"
          )
        : translate("rule-match-label", "Rule");
      activeProfileLabel.textContent = `${profileLabel}: ${profileName} (${matchLabel}: ${state.appliedRulePattern})`;
    } else {
      activeProfileLabel.textContent = `${profileLabel}: ${profileName}`;
    }
  }

  const { text, modifier } = formatStatus(state);
  if (statusBannerText) {
    statusBannerText.textContent = text;
  } else {
    statusBanner.textContent = text;
  }
  statusBanner.className = `status-banner ${modifier}`;

  renderTrackSelectors(state);

  if (state.primarySubtitles) {
    renderSubtitles(state.primarySubtitles, state.secondarySubtitles);
    const predictedTime = getPredictedPlaybackTime();
    if (predictedTime !== null) {
      highlightActiveCue(predictedTime);
    }
  } else {
    subtitleList.innerHTML = "";
    cueElements = [];
    combinedCues = [];
    activeCueIndex = null;
  }
}

function setSettingsOpen(nextValue: boolean) {
  if (!windowContainer || !settingsPanelElement || isSettingsOpen === nextValue) {
    return;
  }
  isSettingsOpen = nextValue;
  windowContainer.classList.toggle("window--settings-open", nextValue);
  settingsPanelElement.setAttribute("aria-hidden", String(!nextValue));
  if (nextValue) {
    closeBehaviorSelect.focus();
  } else {
    settingsButton.focus();
  }
}

function setPinnedState(level: "off" | "floating" | "screen-saver") {
  if (!pinButton) {
    return;
  }
  
  // Remove all state classes
  pinButton.classList.remove("icon-button--active", "icon-button--screen-saver");
  
  // Set appropriate class and icon based on level
  let icon: string;
  
  let labelKey = "pin-label-unpinned";
  switch (level) {
    case "off":
      icon = PIN_ICON_OFF;
      labelKey = "pin-label-unpinned";
      pinButton.setAttribute("aria-pressed", "false");
      break;
    case "floating":
      icon = PIN_ICON_FLOATING;
      labelKey = "pin-label-floating";
      pinButton.classList.add("icon-button--active");
      pinButton.setAttribute("aria-pressed", "true");
      break;
    case "screen-saver":
      icon = PIN_ICON_SCREEN_SAVER;
      labelKey = "pin-label-screensaver";
      pinButton.classList.add("icon-button--active", "icon-button--screen-saver");
      pinButton.setAttribute("aria-pressed", "true");
      break;
  }
  const label = translate(labelKey, labelKey === "pin-label-unpinned" ? "Unpinned" : labelKey === "pin-label-floating" ? "Pinned (Normal)" : "Pinned (Screen Saver)");
  
  if (pinIconElement) {
    pinIconElement.textContent = icon;
  }
  pinButton.setAttribute("aria-label", label);
  pinButton.setAttribute("title", label);
}

function setFullscreenButtonState(nextValue: boolean) {
  if (!fullscreenButton) {
    return;
  }
  fullscreenButton.classList.toggle("icon-button--active", nextValue);
  fullscreenButton.setAttribute("aria-pressed", String(nextValue));
  if (fullscreenIconElement) {
    fullscreenIconElement.textContent = nextValue ? FULLSCREEN_ICON_ACTIVE : FULLSCREEN_ICON_DEFAULT;
  }
}

function clampPanelOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PANEL_OPACITY;
  }
  return Math.min(PANEL_OPACITY_MAX, Math.max(PANEL_OPACITY_MIN, Math.round(value)));
}

function applyPanelOpacity(nextValue: number) {
  const clamped = clampPanelOpacity(nextValue);
  currentPanelOpacity = clamped;
  if (panelOpacitySlider && panelOpacitySlider.value !== String(clamped)) {
    panelOpacitySlider.value = String(clamped);
  }
  if (panelOpacityValue) {
    panelOpacityValue.textContent = `${clamped}%`;
  }
  rootElement.style.setProperty("--panel-opacity-factor", (clamped / 100).toFixed(2));
}

function positionTransparencyPopover() {
  if (!transparencyPopover || !transparencyButton) {
    return;
  }
  const buttonRect = transparencyButton.getBoundingClientRect();
  const fallbackWidth = 220;
  const fallbackHeight = 80;
  const width = transparencyPopover.offsetWidth || fallbackWidth;
  const height = transparencyPopover.offsetHeight || fallbackHeight;
  const spacing = 8;

  let left = buttonRect.right - width;
  left = Math.max(spacing, Math.min(left, window.innerWidth - width - spacing));

  let top = buttonRect.bottom + spacing;
  const maxTop = window.innerHeight - height - spacing;
  top = Math.min(Math.max(spacing, top), maxTop);

  transparencyPopover.style.left = `${left}px`;
  transparencyPopover.style.top = `${top}px`;
}

function setTransparencyPopover(open: boolean) {
  if (!transparencyPopover || !transparencyButton) {
    isTransparencyPopoverOpen = false;
    return;
  }
  isTransparencyPopoverOpen = open;
  transparencyPopover.classList.toggle("is-open", open);
  transparencyPopover.setAttribute("aria-hidden", String(!open));
  transparencyButton.setAttribute("aria-expanded", String(open));
  if (open) {
    positionTransparencyPopover();
  }
}

function requestPanelOpacityUpdate(nextValue: number) {
  if (!currentSettings) {
    return;
  }
  updateSettings({
    global: {
      ...currentSettings.global,
      panelOpacity: clampPanelOpacity(nextValue)
    }
  });
}

function applyAutoHideZoneHeight(nextValue: number) {
  const clamped = clampAutoHideZoneHeight(nextValue);
  autoHideActiveZoneHeight = clamped;
  rootElement.style.setProperty("--auto-hide-zone-height", `${clamped}px`);
  if (autoHideZoneSlider && autoHideZoneSlider.value !== String(clamped)) {
    autoHideZoneSlider.value = String(clamped);
  }
  if (autoHideZoneValue) {
    autoHideZoneValue.textContent = `${clamped}px`;
  }
}

function requestAutoHideZoneHeightUpdate(nextValue: number) {
  if (!currentSettings) {
    return;
  }
  updateSettings({
    global: {
      ...currentSettings.global,
      autoHideActiveZoneHeight: clampAutoHideZoneHeight(nextValue)
    }
  });
}

function setAutoHidePreviewVisible(visible: boolean) {
  if (!autoHidePreviewElement) {
    return;
  }
  if (isAutoHidePreviewVisible === visible) {
    return;
  }
  isAutoHidePreviewVisible = visible;
  autoHidePreviewElement.classList.toggle("is-visible", visible);
}

function setCollapsed(next: boolean) {
  if (!windowContainer) return;
  if (isCollapsed === next) return;
  isCollapsed = next;
  console.log(`[Auto-hide] Setting collapsed: ${next}`);
  windowContainer.classList.toggle("auto-hide-collapsed", next);
}

function clearCollapseTimer() {
  if (collapseTimer !== null) {
    window.clearTimeout(collapseTimer);
    collapseTimer = null;
  }
}

function scheduleCollapse() {
  clearCollapseTimer();
  if (!autoHideEnabled) return;
  collapseTimer = window.setTimeout(() => {
    setCollapsed(true);
    collapseTimer = null;
  }, 2000);
}

function handleAutoHideMouseMove(event: MouseEvent) {
  if (!autoHideEnabled) {
    return;
  }
  const pointerInZone = event.clientY >= 0 && event.clientY <= autoHideActiveZoneHeight;
  if (pointerInZone) {
    if (!isMouseInActiveZone) {
      console.log(
        `[Auto-hide] Pointer entered active zone (<= ${autoHideActiveZoneHeight}px from top)`
      );
    }
    isMouseInActiveZone = true;
    clearCollapseTimer();
    setCollapsed(false);
    return;
  }
  if (isMouseInActiveZone) {
    console.log(`[Auto-hide] Pointer left active zone (> ${autoHideActiveZoneHeight}px from top)`);
    isMouseInActiveZone = false;
    scheduleCollapse();
  }
}

function handleAutoHidePointerExit(event: MouseEvent) {
  if (!autoHideEnabled) {
    return;
  }
  if (event.relatedTarget !== null) {
    return;
  }
  if (isMouseInActiveZone) {
    console.log("[Auto-hide] Pointer left window");
    isMouseInActiveZone = false;
  }
  scheduleCollapse();
}

function applySubtitleStyles(settings: ProfileSettings | null) {
  const normalizeNumber = (value: number, fallback: number): number =>
    Number.isFinite(value) ? value : fallback;

  const family = settings?.subtitleFontFamily?.trim();
  const fontSize = Number(settings?.subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE) || DEFAULT_SUBTITLE_FONT_SIZE;
  const lineSpacing = normalizeNumber(
    Number(settings?.subtitleLineSpacing ?? DEFAULT_PROFILE_TEMPLATE.subtitleLineSpacing),
    DEFAULT_PROFILE_TEMPLATE.subtitleLineSpacing
  );
  const timeTextGap = normalizeNumber(
    Number(settings?.subtitleTimeTextGap ?? DEFAULT_PROFILE_TEMPLATE.subtitleTimeTextGap),
    DEFAULT_PROFILE_TEMPLATE.subtitleTimeTextGap
  );
  const primarySecondaryGap = normalizeNumber(
    Number(settings?.subtitlePrimarySecondaryGap ?? DEFAULT_PROFILE_TEMPLATE.subtitlePrimarySecondaryGap),
    DEFAULT_PROFILE_TEMPLATE.subtitlePrimarySecondaryGap
  );
  const lineHeight = normalizeNumber(
    Number(settings?.subtitleLineHeight ?? DEFAULT_PROFILE_TEMPLATE.subtitleLineHeight),
    DEFAULT_PROFILE_TEMPLATE.subtitleLineHeight
  );

  rootElement.style.setProperty(
    "--subtitle-font-family",
    family && family.length ? family : DEFAULT_SUBTITLE_FONT_FAMILY
  );
  rootElement.style.setProperty("--subtitle-font-size", `${fontSize}px`);
  rootElement.style.setProperty("--subtitle-line-spacing", `${lineSpacing}px`);
  rootElement.style.setProperty("--subtitle-time-text-gap", `${timeTextGap}px`);
  rootElement.style.setProperty("--subtitle-primary-secondary-gap", `${primarySecondaryGap}px`);
  rootElement.style.setProperty("--subtitle-line-height", lineHeight.toString());
  const normalizeColorValue = (value: string | undefined | null, fallback: string): string => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length ? trimmed : fallback;
  };
  const primaryColor = normalizeColorValue(
    settings?.subtitlePrimaryColor,
    DEFAULT_PROFILE_TEMPLATE.subtitlePrimaryColor
  );
  const secondaryColor = normalizeColorValue(
    settings?.subtitleSecondaryColor,
    DEFAULT_PROFILE_TEMPLATE.subtitleSecondaryColor
  );
  const activePrimaryColor = normalizeColorValue(
    settings?.subtitleActivePrimaryColor,
    DEFAULT_PROFILE_TEMPLATE.subtitleActivePrimaryColor
  );
  const activeSecondaryColor = normalizeColorValue(
    settings?.subtitleActiveSecondaryColor,
    DEFAULT_PROFILE_TEMPLATE.subtitleActiveSecondaryColor
  );
  rootElement.style.setProperty("--subtitle-primary-text-color", primaryColor);
  rootElement.style.setProperty("--subtitle-secondary-text-color", secondaryColor);
  rootElement.style.setProperty("--subtitle-active-primary-text-color", activePrimaryColor);
  rootElement.style.setProperty("--subtitle-active-secondary-text-color", activeSecondaryColor);
}

function renderSettings(settings: AppSettings) {
  currentSettings = settings;
  const normalizedLanguage = normalizeLanguageCode(settings.global.language);
  syncLanguageFromSettings(normalizedLanguage);
  if (languageSelect) {
    languageSelect.value = normalizedLanguage;
  }
  setPinnedState(settings.global.alwaysOnTop);
  setFullscreenButtonState(false);
  applyPanelOpacity(settings.global.panelOpacity ?? DEFAULT_PANEL_OPACITY);
  applyAutoHideZoneHeight(settings.global.autoHideActiveZoneHeight ?? DEFAULT_AUTO_HIDE_ACTIVE_ZONE_HEIGHT);
  setTransparencyPopover(false);
  ensureEditingProfile();
  ensureEditingJellyfinConfig();
  closeBehaviorSelect.value = settings.global.closeBehavior;
  autostartToggle.checked = settings.global.autoLaunch;
  toggleWindowShortcutInput.value = settings.global.toggleWindowShortcut || "";
  if (jellyfinEnabledToggle) {
    jellyfinEnabledToggle.checked = settings.jellyfin.enabled;
  }
  renderGameProcessBlacklist(settings.global.gameProcessBlacklist ?? []);
  
  // Render cache settings
  cacheEnabledCheckbox.checked = settings.cache.enabled;
  cachePathInput.value = settings.cache.path;
  cacheRetentionDaysInput.value = String(settings.cache.retentionDays);
  
  renderJellyfinConfigList(settings);
  renderJellyfinConfigEditor();
  renderProfileList(settings);
  renderProfileEditor();
  updateRuleProfileOptions();
  renderRuleList();

  if (editingRuleId) {
    const rule = settings.rules.find((item) => item.id === editingRuleId);
    if (rule) {
      populateRuleForm(rule);
    } else {
      editingRuleId = null;
      resetRuleForm();
    }
  } else if (!ruleFormInitialized) {
    resetRuleForm();
    ruleFormInitialized = true;
  } else {
    const selectedProfileId = ruleProfileSelect.value;
    if (!getProfileById(selectedProfileId)) {
      const fallback = ensureEditingProfile();
      if (fallback) {
        ruleProfileSelect.value = fallback.id;
      }
    }
  }

  syncPlaybackProfileSettings();
  
  // Load cache stats
  refreshCacheStats();

  if (autoHideToggle) {
    autoHideEnabled = Boolean(settings.global.autoHidePanels);
    autoHideToggle.textContent = autoHideEnabled ? "▲" : "▼";
  }
}

function updateSettings(partial: Partial<AppSettings>) {
  return window.usp.updateSettings(partial).catch((error: unknown) => {
    console.error("[Renderer] Failed to update settings", error);
  });
}

setupPriorityEditorInteractions("primary");
setupPriorityEditorInteractions("secondary");

primaryTrackSelector.addEventListener("change", () => {
  const value = primaryTrackSelector.value || null;
  window.usp.selectSubtitleTrack(value, "primary");
});

secondaryTrackSelector.addEventListener("change", () => {
  const value = secondaryTrackSelector.value || null;
  window.usp.selectSubtitleTrack(value, "secondary");
});

if (jellyfinEnabledToggle) {
  jellyfinEnabledToggle.addEventListener("change", () => {
    updateJellyfinSettings({ enabled: jellyfinEnabledToggle.checked });
  });
}

if (jellyfinConfigAddButton) {
  jellyfinConfigAddButton.addEventListener("click", handleJellyfinConfigAdd);
}
if (jellyfinConfigDeleteButton) {
  jellyfinConfigDeleteButton.addEventListener("click", handleJellyfinConfigDelete);
}

if (jellyfinConfigNameInput) {
  jellyfinConfigNameInput.addEventListener("change", () => {
    const config = ensureEditingJellyfinConfig();
    if (!config) {
      return;
    }
    const nextValue = jellyfinConfigNameInput.value.trim();
    if (nextValue === config.name) {
      return;
    }
    updateEditingJellyfinConfig((cfg) => ({
      ...cfg,
      name: nextValue || "Jellyfin Server"
    }));
  });
}

if (jellyfinServerInput) {
  jellyfinServerInput.addEventListener("change", () => {
    const config = ensureEditingJellyfinConfig();
    if (!config) {
      return;
    }
    const nextValue = jellyfinServerInput.value.trim();
    if (nextValue === config.serverUrl) {
      return;
    }
    updateEditingJellyfinConfig((cfg) => ({
      ...cfg,
      serverUrl: nextValue
    }));
  });
}

if (jellyfinApiKeyInput) {
  jellyfinApiKeyInput.addEventListener("change", () => {
    const config = ensureEditingJellyfinConfig();
    if (!config) {
      return;
    }
    const nextValue = jellyfinApiKeyInput.value.trim();
    if (nextValue === config.apiKey) {
      return;
    }
    updateEditingJellyfinConfig((cfg) => ({
      ...cfg,
      apiKey: nextValue
    }));
  });
}

if (jellyfinWsPathInput) {
  jellyfinWsPathInput.addEventListener("change", () => {
    const config = ensureEditingJellyfinConfig();
    if (!config) {
      return;
    }
    const nextValue = jellyfinWsPathInput.value.trim();
    if (nextValue === config.webSocketPath) {
      return;
    }
    updateEditingJellyfinConfig((cfg) => ({
      ...cfg,
      webSocketPath: nextValue
    }));
  });
}

settingsButton.addEventListener("click", () => {
  setSettingsOpen(true);
});

settingsBackButton.addEventListener("click", () => {
  setSettingsOpen(false);
});

if (languageSelect) {
  languageSelect.addEventListener("change", handleLanguageSelectionChange);
}

if (pinButton) {
  pinButton.addEventListener("click", () => {
    if (!currentSettings) {
      return;
    }
    // Cycle through states: off -> floating -> screen-saver -> off
    let nextLevel: "off" | "floating" | "screen-saver";
    switch (currentSettings.global.alwaysOnTop) {
      case "off":
        nextLevel = "floating";
        break;
      case "floating":
        nextLevel = "screen-saver";
        break;
      case "screen-saver":
        nextLevel = "off";
        break;
      default:
        nextLevel = "floating";
    }
    
    setPinnedState(nextLevel);
    updateSettings({
      global: {
        ...currentSettings.global,
        alwaysOnTop: nextLevel
      }
    });
  });
}

if (fullscreenButton) {
  fullscreenButton.addEventListener("click", async () => {
    try {
      const nextValue = await window.usp.toggleDisplayFullscreen();
      setFullscreenButtonState(Boolean(nextValue));
    } catch (error) {
      console.error("[Renderer] Failed to toggle fullscreen", error);
    }
  });
}

if (transparencyButton) {
  transparencyButton.addEventListener("click", (event) => {
    event.stopPropagation();
    setTransparencyPopover(!isTransparencyPopoverOpen);
  });
}

if (transparencyPopover) {
  transparencyPopover.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

if (panelOpacitySlider) {
  panelOpacitySlider.addEventListener("input", () => {
    const nextValue = clampPanelOpacity(Number(panelOpacitySlider.value));
    applyPanelOpacity(nextValue);
  });
  panelOpacitySlider.addEventListener("change", () => {
    const nextValue = clampPanelOpacity(Number(panelOpacitySlider.value));
    requestPanelOpacityUpdate(nextValue);
  });
}

const hideAutoHidePreview = () => {
  setAutoHidePreviewVisible(false);
};

const showAutoHidePreview = () => {
  setAutoHidePreviewVisible(true);
};

if (autoHideZoneSlider) {
  autoHideZoneSlider.min = String(AUTO_HIDE_ZONE_MIN);
  autoHideZoneSlider.max = String(AUTO_HIDE_ZONE_MAX);
  autoHideZoneSlider.step = "10";
  autoHideZoneSlider.addEventListener("pointerdown", showAutoHidePreview);
  autoHideZoneSlider.addEventListener("input", () => {
    const nextValue = clampAutoHideZoneHeight(Number(autoHideZoneSlider.value));
    applyAutoHideZoneHeight(nextValue);
    showAutoHidePreview();
  });
  autoHideZoneSlider.addEventListener("change", () => {
    const nextValue = clampAutoHideZoneHeight(Number(autoHideZoneSlider.value));
    requestAutoHideZoneHeightUpdate(nextValue);
    hideAutoHidePreview();
  });
  autoHideZoneSlider.addEventListener("blur", hideAutoHidePreview);
  autoHideZoneSlider.addEventListener("pointerup", hideAutoHidePreview);
  autoHideZoneSlider.addEventListener("pointercancel", hideAutoHidePreview);
}

document.addEventListener("click", (event) => {
  if (!isTransparencyPopoverOpen) {
    return;
  }
  if (transparencyControl && event.target instanceof Node && transparencyControl.contains(event.target)) {
    return;
  }
  setTransparencyPopover(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isTransparencyPopoverOpen) {
    setTransparencyPopover(false);
  }
});

window.addEventListener("resize", () => {
  if (isTransparencyPopoverOpen) {
    positionTransparencyPopover();
  }
});

if (autoHideToggle) {
  autoHideToggle.addEventListener("click", () => {
    autoHideEnabled = !autoHideEnabled;
    autoHideToggle.textContent = autoHideEnabled ? "▲" : "▼";
    console.log(`[Auto-hide] Toggled to: ${autoHideEnabled ? "enabled (▲)" : "disabled (▼)"}`);
    if (!autoHideEnabled) {
      clearCollapseTimer();
      setCollapsed(false);
    }
    if (currentSettings) {
      updateSettings({
        global: {
          ...currentSettings.global,
          autoHidePanels: autoHideEnabled
        }
      });
    }
  });
}

window.addEventListener("mousemove", handleAutoHideMouseMove, { passive: true });
document.addEventListener("mouseleave", handleAutoHidePointerExit, { passive: true });

closeBehaviorSelect.addEventListener("change", () => {
  const nextValue = closeBehaviorSelect.value === "quit" ? "quit" : "tray";
  if (!currentSettings || currentSettings.global.closeBehavior === nextValue) {
    return;
  }
  updateSettings({
    global: {
      ...currentSettings.global,
      closeBehavior: nextValue
    }
  });
});

autostartToggle.addEventListener("change", () => {
  const nextValue = Boolean(autostartToggle.checked);
  if (!currentSettings || currentSettings.global.autoLaunch === nextValue) {
    return;
  }
  updateSettings({
    global: {
      ...currentSettings.global,
      autoLaunch: nextValue
    }
  });
});

toggleWindowShortcutInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const nextValue = toggleWindowShortcutInput.value.trim();
    if (!currentSettings || currentSettings.global.toggleWindowShortcut === nextValue) {
      return;
    }
    updateSettings({
      global: {
        ...currentSettings.global,
        toggleWindowShortcut: nextValue
      }
    });
  }
});

toggleWindowShortcutInput.addEventListener("blur", () => {
  const nextValue = toggleWindowShortcutInput.value.trim();
  if (!currentSettings || currentSettings.global.toggleWindowShortcut === nextValue) {
    return;
  }
  updateSettings({
    global: {
      ...currentSettings.global,
      toggleWindowShortcut: nextValue
    }
  });
});

if (gameProcessAddButton) {
  gameProcessAddButton.addEventListener("click", handleGameProcessBlacklistAdd);
}

if (gameProcessInput) {
  gameProcessInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleGameProcessBlacklistAdd();
    }
  });
}

if (gameProcessListElement) {
  gameProcessListElement.addEventListener("click", (event) => {
    const removeButton = (event.target as HTMLElement).closest(".game-blacklist-editor__item-remove");
    if (!removeButton) {
      return;
    }
    const parent = removeButton.closest(".game-blacklist-editor__item") as HTMLElement | null;
    if (!parent) {
      return;
    }
    const index = Number(parent.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    handleGameProcessBlacklistRemove(index);
  });
}

subtitleFontInput.addEventListener("change", () => {
  const profile = ensureEditingProfile();
  if (!profile) {
    return;
  }
  const nextValue = subtitleFontInput.value.trim();
  if (nextValue === profile.settings.subtitleFontFamily) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleFontFamily: nextValue
  }));
});

subtitleFontSizeInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleFontSizeInput.value, 10);
  if (!Number.isFinite(nextValue)) {
    const profile = ensureEditingProfile();
    subtitleFontSizeInput.value = String(profile?.settings.subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE);
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitleFontSize === nextValue) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleFontSize: nextValue
  }));
});

subtitleAutoScrollTimeoutInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleAutoScrollTimeoutInput.value, 10);
  if (!Number.isFinite(nextValue) || nextValue < 1) {
    const profile = ensureEditingProfile();
    subtitleAutoScrollTimeoutInput.value = String(profile?.settings.subtitleAutoScrollTimeout ?? DEFAULT_PROFILE_TEMPLATE.subtitleAutoScrollTimeout);
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitleAutoScrollTimeout === nextValue) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleAutoScrollTimeout: nextValue
  }));
});

subtitleScrollPositionInput.addEventListener("input", () => {
  const value = Number.parseInt(subtitleScrollPositionInput.value, 10);
  subtitleScrollPositionValue.textContent = `${value}%`;
});

subtitleScrollPositionInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleScrollPositionInput.value, 10);
  if (!Number.isFinite(nextValue)) {
    const profile = ensureEditingProfile();
    const fallback = profile?.settings.subtitleScrollPosition ?? DEFAULT_PROFILE_TEMPLATE.subtitleScrollPosition;
    subtitleScrollPositionInput.value = String(fallback);
    subtitleScrollPositionValue.textContent = `${fallback}%`;
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitleScrollPosition === nextValue) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleScrollPosition: nextValue
  }));
});

subtitleLineSpacingInput.addEventListener("input", () => {
  subtitleLineSpacingValue.textContent = `${subtitleLineSpacingInput.value}px`;
});

subtitleLineSpacingInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleLineSpacingInput.value, 10);
  if (!Number.isFinite(nextValue)) {
    const profile = ensureEditingProfile();
    const fallback = profile?.settings.subtitleLineSpacing ?? DEFAULT_PROFILE_TEMPLATE.subtitleLineSpacing;
    subtitleLineSpacingInput.value = String(fallback);
    subtitleLineSpacingValue.textContent = `${fallback}px`;
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitleLineSpacing === nextValue) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleLineSpacing: nextValue
  }));
});

subtitleTimeTextGapInput.addEventListener("input", () => {
  subtitleTimeTextGapValue.textContent = `${subtitleTimeTextGapInput.value}px`;
});

subtitleTimeTextGapInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleTimeTextGapInput.value, 10);
  if (!Number.isFinite(nextValue)) {
    const profile = ensureEditingProfile();
    const fallback = profile?.settings.subtitleTimeTextGap ?? DEFAULT_PROFILE_TEMPLATE.subtitleTimeTextGap;
    subtitleTimeTextGapInput.value = String(fallback);
    subtitleTimeTextGapValue.textContent = `${fallback}px`;
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitleTimeTextGap === nextValue) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleTimeTextGap: nextValue
  }));
});

subtitlePrimarySecondaryGapInput.addEventListener("input", () => {
  subtitlePrimarySecondaryGapValue.textContent = `${subtitlePrimarySecondaryGapInput.value}px`;
});

subtitlePrimarySecondaryGapInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitlePrimarySecondaryGapInput.value, 10);
  if (!Number.isFinite(nextValue)) {
    const profile = ensureEditingProfile();
    const fallback =
      profile?.settings.subtitlePrimarySecondaryGap ?? DEFAULT_PROFILE_TEMPLATE.subtitlePrimarySecondaryGap;
    subtitlePrimarySecondaryGapInput.value = String(fallback);
    subtitlePrimarySecondaryGapValue.textContent = `${fallback}px`;
    return;
  }
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitlePrimarySecondaryGap === nextValue) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitlePrimarySecondaryGap: nextValue
  }));
});

subtitleLineHeightInput.addEventListener("input", () => {
  const parsed = Number.parseFloat(subtitleLineHeightInput.value);
  subtitleLineHeightValue.textContent = Number.isFinite(parsed)
    ? parsed.toFixed(2)
    : DEFAULT_PROFILE_TEMPLATE.subtitleLineHeight.toFixed(2);
});

subtitleLineHeightInput.addEventListener("change", () => {
  const nextValue = Number.parseFloat(subtitleLineHeightInput.value);
  if (!Number.isFinite(nextValue)) {
    const profile = ensureEditingProfile();
    const fallback = profile?.settings.subtitleLineHeight ?? DEFAULT_PROFILE_TEMPLATE.subtitleLineHeight;
    const formatted = Number(fallback).toFixed(2);
    subtitleLineHeightInput.value = formatted;
    subtitleLineHeightValue.textContent = formatted;
    return;
  }
  const normalized = Number(Math.min(3, Math.max(1, nextValue)).toFixed(2));
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.subtitleLineHeight === normalized) {
    subtitleLineHeightInput.value = normalized.toFixed(2);
    subtitleLineHeightValue.textContent = normalized.toFixed(2);
    return;
  }
  subtitleLineHeightInput.value = normalized.toFixed(2);
  subtitleLineHeightValue.textContent = normalized.toFixed(2);
  updateEditingProfileSettings((settings) => ({
    ...settings,
    subtitleLineHeight: normalized
  }));
});

function bindSubtitleColorInput(field: SubtitleColorField, input: HTMLInputElement | null) {
  if (!input) {
    return;
  }
  const handleInput = () => {
    const profile = ensureEditingProfile();
    if (!profile) {
      return;
    }
    const nextValue = input.value.trim();
    if (!nextValue || profile.settings[field] === nextValue) {
      return;
    }
    updateEditingProfileSettings((settings) => ({
      ...settings,
      [field]: nextValue
    }));

    const activeProfileId = getActiveProfileId();
    if (activeProfileId && playbackProfileSettings && profile.id === activeProfileId) {
      playbackProfileSettings = {
        ...playbackProfileSettings,
        [field]: nextValue
      };
      applySubtitleStyles(playbackProfileSettings);
    }
  };

  input.addEventListener("input", handleInput);
}

bindSubtitleColorInput("subtitlePrimaryColor", subtitlePrimaryColorInput);
bindSubtitleColorInput("subtitleSecondaryColor", subtitleSecondaryColorInput);
bindSubtitleColorInput("subtitleActivePrimaryColor", subtitleActivePrimaryColorInput);
bindSubtitleColorInput("subtitleActiveSecondaryColor", subtitleActiveSecondaryColorInput);

ytDlpArgsInput.addEventListener("input", () => {
  const value = ytDlpArgsInput.value;
  const profile = ensureEditingProfile();
  if (!profile || profile.settings.ytDlpArgs === value) {
    return;
  }
  updateEditingProfileSettings((settings) => ({
    ...settings,
    ytDlpArgs: value
  }));
});

profileAddButton.addEventListener("click", () => {
  handleProfileAdd();
});

profileDuplicateButton.addEventListener("click", () => {
  handleProfileDuplicate();
});

profileDeleteButton.addEventListener("click", () => {
  handleProfileDelete();
});

profileSetDefaultButton.addEventListener("click", () => {
  handleSetDefaultProfile();
});

profileNameInput.addEventListener("change", () => {
  const profile = ensureEditingProfile();
  if (!profile) {
    return;
  }
  const nextValue = profileNameInput.value.trim() || profile.name;
  if (nextValue === profile.name) {
    return;
  }
  updateProfile(profile.id, (current) => ({
    ...current,
    name: nextValue
  }));
});

ruleSaveButton.addEventListener("click", () => handleRuleSave());
ruleCancelButton.addEventListener("click", () => resetRuleForm());

pauseButton.addEventListener("click", () => {
  console.debug(`${logPrefixUI} pause-click`);
  window.usp.controlVideo({ type: "pause" })
    .then((res: any) => {
      console.debug(`${logPrefixUI} pause-sent`, { ok: res === undefined ? true : res });
    })
    .catch((error: unknown) => {
      console.error(`${logPrefixUI} pause-failed`, error);
    });
});

playButton.addEventListener("click", () => {
  console.debug(`${logPrefixUI} play-click`);
  window.usp.controlVideo({ type: "play" })
    .then((res: any) => {
      console.debug(`${logPrefixUI} play-sent`, { ok: res === undefined ? true : res });
    })
    .catch((error: unknown) => {
      console.error(`${logPrefixUI} play-failed`, error);
    });
});

subtitleList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  
  // Check if the clicked element is the play button
  if (target.classList.contains("subtitle-item__play-btn")) {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    const cue = combinedCues[index];
    if (cue) {
      console.debug(`${logPrefixUI} seek-click`, { index, start: cue.start, end: cue.end, loopingCueIndex });
      // Seeking should clear loop (unless clicking the looped cue's play button)
      if (loopingCueIndex !== null && loopingCueIndex !== index) {
        clearLoopUI();
        window.usp.controlVideo({ type: "stopLoop" });
      }
      window.usp.controlVideo({ type: "seek", time: cue.start })
        .then((res: any) => {
          console.debug(`${logPrefixUI} seek-sent`, { ok: res === undefined ? true : res });
        })
        .catch((error: unknown) => {
          console.error(`${logPrefixUI} seek-failed`, error);
        });
    }
  }
  
  // Check if the clicked element is the loop button
  if (target.classList.contains("subtitle-item__loop-btn")) {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    
    // Toggle loop mode
    if (loopingCueIndex === index) {
      // Disable loop
      console.debug(`${logPrefixUI} loop-toggle-off`, { index });
      clearLoopUI();
      // Send stop loop command to extension
      window.usp.controlVideo({ type: "stopLoop" })
        .then((res: any) => {
          console.debug(`${logPrefixUI} stopLoop-sent`, { ok: res === undefined ? true : res });
        })
        .catch((error: unknown) => {
          console.error(`${logPrefixUI} stopLoop-failed`, error);
        });
    } else {
      // If already looping another cue, clear it first and send stopLoop
      if (loopingCueIndex !== null) {
        clearLoopUI();
        window.usp.controlVideo({ type: "stopLoop" })
          .then((res: any) => {
            console.debug(`${logPrefixUI} stopLoop-sent`, { ok: res === undefined ? true : res });
          })
          .catch((error: unknown) => {
            console.error(`${logPrefixUI} stopLoop-failed`, error);
          });
      }
      
      // Enable loop for this cue
      loopingCueIndex = index;
      
      // Add active class to current loop button
      console.debug(`${logPrefixAnim} loop-btn-add-active`, { index });
      target.classList.add("subtitle-item__loop-btn--active");
      
      // Immediately highlight this cue (before loop starts)
      if (activeCueIndex !== index) {
        if (activeCueIndex !== null && cueElements[activeCueIndex]) {
          cueElements[activeCueIndex].classList.remove("subtitle-item--active");
        }
        const element = cueElements[index];
        if (element) {
          element.classList.add("subtitle-item--active");
          if (autoScrollEnabled) {
            scrollToActiveSubtitle(element);
          }
          activeCueIndex = index;
        }
      }
      
      // Send loop command to extension with start, end times, and cueIndex
      const cue = combinedCues[index];
      if (cue) {
        console.debug(`${logPrefixUI} loop-toggle-on`, { index, start: cue.start, end: cue.end });
        window.usp.controlVideo({ type: "loop", start: cue.start, end: cue.end, cueIndex: index })
          .then((res: any) => {
            console.debug(`${logPrefixUI} loop-sent`, { ok: res === undefined ? true : res });
          })
          .catch((error: unknown) => {
            console.error(`${logPrefixUI} loop-failed`, error);
          });
      }
    }
  }
});

// Listen for user manual scrolling of subtitle list
subtitleList.addEventListener("wheel", () => {
  resetAutoScrollTimer();
}, { passive: true });

subtitleList.addEventListener("touchmove", () => {
  resetAutoScrollTimer();
}, { passive: true });

// Pause auto-scroll while the user is selecting subtitle text with the mouse
subtitleList.addEventListener("mousedown", (event) => {
  if (event.button !== 0) {
    return;
  }
  const target = event.target;
  const element =
    target instanceof HTMLElement
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  if (!element || element.closest("button")) {
    return;
  }
  isSubtitlePointerDown = true;
  pauseAutoScrollImmediate();
});

window.addEventListener("mouseup", (event) => {
  if (!isSubtitlePointerDown || event.button !== 0) {
    return;
  }
  isSubtitlePointerDown = false;
  handleSubtitleSelectionChange();
  if (!hasSubtitleTextSelection) {
    resetAutoScrollTimer();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isSettingsOpen) {
    setSettingsOpen(false);
  }
});

document.addEventListener("selectionchange", handleSubtitleSelectionChange);

async function bootstrap() {
  try {
    const initialState = await window.usp.getInitialState();
    renderState(initialState);
  } catch (error) {
    console.error("[Renderer] Failed to get initial state:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    statusBanner.textContent = formatTranslation(
      "status-failed-init",
      "Failed to get initial state: {error}",
      { error: errorMessage }
    );
    statusBanner.className = "status-banner status-banner--error";
  }

  try {
    const initialSettings = await window.usp.getSettings();
    renderSettings(initialSettings);
  } catch (error) {
    console.error("[Renderer] Failed to load settings:", error);
  }

  window.usp.onStateChange((nextState) => {
    renderState(nextState);
  });

  window.usp.onPlayback((payload) => {
    console.debug("[Renderer][Playback] update", {
      time: payload.currentTime,
      rate: payload.playbackRate,
      looping: payload.isLooping,
      loopCueIndex: payload.loopCueIndex
    });
    const wasLooping = lastKnownPlaybackState?.isLooping ?? false;
    lastKnownPlaybackState = payload;
    
    // If loop state changed, immediately re-highlight
    if (wasLooping !== payload.isLooping) {
      const predictedTime = getPredictedPlaybackTime();
      if (predictedTime !== null) {
        highlightActiveCue(predictedTime);
      }
    }
    
    ensurePlaybackPredictionLoop();
  });

  window.usp.onSettingsChange((settings) => {
    renderSettings(settings);
  });

  window.usp.onLoopCleared(() => {
    clearLoopUI();
  });
}

bootstrap();

// Cache management functions
async function refreshCacheStats() {
  try {
    const stats = await window.usp.getCacheStats();
    cacheTotalEntriesElement.textContent = String(stats.totalEntries);
    cacheTotalSizeElement.textContent = formatBytes(stats.totalSize);
    cacheOldestEntryElement.textContent = stats.oldestEntry 
      ? new Date(stats.oldestEntry).toLocaleDateString()
      : '-';
  } catch (error) {
    console.error('[Renderer] Failed to get cache stats:', error);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Cache settings event listeners
cacheEnabledCheckbox.addEventListener("change", () => {
  updateSettings({
    cache: {
      ...currentSettings?.cache,
      enabled: cacheEnabledCheckbox.checked
    } as any
  });
});

cachePathInput.addEventListener("change", () => {
  const path = cachePathInput.value.trim();
  updateSettings({
    cache: {
      ...currentSettings?.cache,
      path
    } as any
  });
});

cacheRetentionDaysInput.addEventListener("change", () => {
  const days = parseInt(cacheRetentionDaysInput.value, 10);
  if (isNaN(days) || days < 1 || days > 365) {
    cacheRetentionDaysInput.value = String(currentSettings?.cache.retentionDays || 7);
    return;
  }
  updateSettings({
    cache: {
      ...currentSettings?.cache,
      retentionDays: days
    } as any
  });
});

cacheRefreshStatsButton.addEventListener("click", () => {
  refreshCacheStats();
});

cacheOpenFolderButton.addEventListener("click", async () => {
  try {
    await window.usp.openCacheFolder();
  } catch (error) {
    console.error('[Renderer] Failed to open cache folder:', error);
    alert(
      formatTranslation(
        "cache-open-error",
        "Failed to open cache folder: {error}",
        { error: error instanceof Error ? error.message : String(error) }
      )
    );
  }
});

cacheCleanupButton.addEventListener("click", async () => {
  try {
    cacheCleanupButton.disabled = true;
    setTranslatedElementText(cacheCleanupButton, "cache-cleanup-progress", "Cleaning up...");
    const result = await window.usp.cleanupCache();
    alert(
      formatTranslation(
        "cache-cleanup-success",
        "Cleanup completed! Removed {count} expired entries.",
        { count: String(result.removedCount) }
      )
    );
    await refreshCacheStats();
  } catch (error) {
    console.error('[Renderer] Failed to cleanup cache:', error);
    alert(
      formatTranslation(
        "cache-cleanup-failure",
        "Failed to cleanup cache: {error}",
        { error: error instanceof Error ? error.message : String(error) }
      )
    );
  } finally {
    cacheCleanupButton.disabled = false;
    setTranslatedElementText(cacheCleanupButton, "button-cleanup", "Clean Up Expired");
  }
});

cacheClearButton.addEventListener("click", async () => {
  if (!confirm(translate("cache-clear-confirm", "Are you sure you want to clear all cached subtitles? This cannot be undone."))) {
    return;
  }
  try {
    cacheClearButton.disabled = true;
    setTranslatedElementText(cacheClearButton, "cache-clear-progress", "Clearing...");
    await window.usp.clearCache();
    alert(translate("cache-clear-success", "Cache cleared successfully!"));
    await refreshCacheStats();
  } catch (error) {
    console.error('[Renderer] Failed to clear cache:', error);
    alert(
      formatTranslation(
        "cache-clear-failure",
        "Failed to clear cache: {error}",
        { error: error instanceof Error ? error.message : String(error) }
      )
    );
  } finally {
    cacheClearButton.disabled = false;
    setTranslatedElementText(cacheClearButton, "button-clear-cache", "Clear All Cache");
  }
});
