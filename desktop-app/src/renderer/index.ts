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

const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";

const connectionIndicator = document.getElementById("connection-indicator") as HTMLElement;
const videoTitle = document.getElementById("video-title") as HTMLElement;
const videoUrl = document.getElementById("video-url") as HTMLElement;
const activeProfileLabel = document.getElementById("active-profile-label") as HTMLElement;
const statusBanner = document.getElementById("status-banner") as HTMLElement;
const subtitleList = document.getElementById("subtitle-list") as HTMLElement;
const controlPanel = document.getElementById("control-panel") as HTMLElement;
const jellyfinStatusIndicator = document.getElementById("jellyfin-status") as HTMLElement | null;
const jellyfinSessionSelector = document.getElementById("jellyfin-session-selector") as HTMLSelectElement | null;
const primaryTrackSelector = document.getElementById("primary-track-selector") as HTMLSelectElement;
const secondaryTrackSelector = document.getElementById("secondary-track-selector") as HTMLSelectElement;
const playButton = document.getElementById("play-btn") as HTMLButtonElement;
const pauseButton = document.getElementById("pause-btn") as HTMLButtonElement;
const closeBehaviorSelect = document.getElementById("close-behavior") as HTMLSelectElement;
const autostartToggle = document.getElementById("autostart-toggle") as HTMLInputElement;
const subtitleFontInput = document.getElementById("subtitle-font") as HTMLInputElement;
const subtitleFontSizeInput = document.getElementById("subtitle-font-size") as HTMLInputElement;
const subtitleAutoScrollTimeoutInput = document.getElementById("subtitle-auto-scroll-timeout") as HTMLInputElement;
const subtitleScrollPositionInput = document.getElementById("subtitle-scroll-position") as HTMLInputElement;
const subtitleScrollPositionValue = document.getElementById("subtitle-scroll-position-value") as HTMLElement;
const ytDlpArgsInput = document.getElementById("yt-dlp-args") as HTMLTextAreaElement;
const jellyfinEnabledToggle = document.getElementById("jellyfin-enabled") as HTMLInputElement | null;
const jellyfinConfigListElement = document.getElementById("jellyfin-config-list") as HTMLElement;
const jellyfinConfigAddButton = document.getElementById("jellyfin-config-add") as HTMLButtonElement;
const jellyfinConfigDeleteButton = document.getElementById("jellyfin-config-delete") as HTMLButtonElement;
const jellyfinConfigActivateButton = document.getElementById("jellyfin-config-activate") as HTMLButtonElement;
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
const rootElement = document.documentElement;
const computedStyles = window.getComputedStyle(rootElement);
const DEFAULT_SUBTITLE_FONT_FAMILY =
  computedStyles.getPropertyValue("--subtitle-font-family").trim() ||
  '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_SUBTITLE_FONT_SIZE =
  parseInt(computedStyles.getPropertyValue("--subtitle-font-size"), 10) || 14;
const DEFAULT_PROFILE_TEMPLATE: ProfileSettings = {
  subtitleFontFamily: "",
  subtitleFontSize: DEFAULT_SUBTITLE_FONT_SIZE,
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

let currentPlayback: PlaybackState | null = null;
let currentSettings: AppSettings | null = null;
let currentStateSnapshot: DesktopState | null = null;
let cueElements: HTMLElement[] = [];
let combinedCues: CombinedCue[] = [];
let activeCueIndex: number | null = null;
let lastTrackSignature = "";
let isSettingsOpen = false;
let autoScrollEnabled = true;
let autoScrollTimer: number | null = null;
let activePriorityDrag: { role: PriorityRole; index: number } | null = null;
let editingProfileId: string | null = null;
let editingRuleId: string | null = null;
let editingJellyfinConfigId: string | null = null;
let playbackProfileSettings: ProfileSettings | null = null;
let ruleFormInitialized = false;
let loopingCueIndex: number | null = null;

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

function getActiveJellyfinConfig(): JellyfinConfig | null {
  if (!currentSettings || !currentSettings.jellyfin.activeConfigId) {
    return null;
  }
  return getJellyfinConfigById(currentSettings.jellyfin.activeConfigId);
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
      return { text: "Waiting for extension connection...", modifier: "" };
    case "awaiting-video":
      return { text: "Please open a supported video in your browser", modifier: "" };
    case "loading-subtitles":
      return { text: "Downloading subtitles...", modifier: "" };
    case "ready":
      return { text: "Subtitles loaded", modifier: "status-banner--ready" };
    case "error":
      return { text: state.error ?? "Subtitle loading failed", modifier: "status-banner--error" };
    default:
      return { text: "Unknown status", modifier: "" };
  }
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds ?? 0));
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
    placeholder.textContent = "No priorities";
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
    removeButton.setAttribute("aria-label", "Remove priority");
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
    empty.textContent = "No profiles";
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
      badge.textContent = "Default";
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
    empty.textContent = "No servers configured";
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
    if (config.id === settings.jellyfin.activeConfigId) {
      button.classList.add("is-active");
    }
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "jellyfin-config-list__name";
    nameSpan.textContent = config.name;
    button.appendChild(nameSpan);
    
    if (config.id === settings.jellyfin.activeConfigId) {
      const badge = document.createElement("span");
      badge.className = "jellyfin-config-list__badge";
      badge.textContent = "Active";
      button.appendChild(badge);
    }
    
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
    jellyfinConfigActivateButton.disabled = true;
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
  const isActive = currentSettings.jellyfin.activeConfigId === config.id;
  jellyfinConfigActivateButton.disabled = isActive;
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
    webSocketPath: "/socket"
  };
  editingJellyfinConfigId = newConfig.id;
  const newConfigs = [...currentSettings.jellyfin.configs, newConfig];
  updateJellyfinSettings({ 
    configs: newConfigs,
    activeConfigId: currentSettings.jellyfin.activeConfigId || newConfig.id
  });
}

function handleJellyfinConfigDelete() {
  const config = ensureEditingJellyfinConfig();
  if (!config || !currentSettings) {
    return;
  }
  
  if (currentSettings.jellyfin.configs.length <= 1 && currentSettings.jellyfin.enabled) {
    window.alert("Cannot delete the last server while Jellyfin is enabled. Disable Jellyfin first or add another server.");
    return;
  }
  
  const nextConfigs = currentSettings.jellyfin.configs.filter((item) => item.id !== config.id);
  const wasActive = currentSettings.jellyfin.activeConfigId === config.id;
  const nextActiveId = wasActive && nextConfigs.length > 0 ? nextConfigs[0].id : currentSettings.jellyfin.activeConfigId;
  
  editingJellyfinConfigId = nextConfigs.length > 0 ? nextConfigs[0].id : null;
  updateJellyfinSettings({
    configs: nextConfigs,
    activeConfigId: nextActiveId
  });
}

function handleJellyfinConfigActivate() {
  const config = ensureEditingJellyfinConfig();
  if (!config || !currentSettings) {
    return;
  }
  updateJellyfinSettings({ activeConfigId: config.id });
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
    window.alert("Cannot delete the default profile. Please change the default profile first.");
    return;
  }
  if (currentSettings.profiles.length <= 1) {
    window.alert("At least one profile must remain.");
    return;
  }
  if (currentSettings.rules.some((rule) => rule.profileId === profile.id)) {
    window.alert("This profile is still referenced by rules. Please modify or delete the related rules first.");
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
    empty.textContent = "No rules";
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
    const matchLabel = MATCH_TYPE_LABELS[rule.matchType] ?? rule.matchType;
    meta.textContent = `${matchLabel}：${rule.pattern}`;

    header.appendChild(title);
    header.appendChild(meta);
    item.appendChild(header);

    const target = document.createElement("div");
    target.className = "rule-item__profile";
    target.textContent = `Apply Profile: ${getProfileDisplayName(rule.profileId)}`;
    item.appendChild(target);

    const actions = document.createElement("div");
    actions.className = "rule-item__actions";
    const toggleButton = createRuleActionButton(rule.isEnabled ? "Disable" : "Enable", () => handleRuleToggle(rule.id));
    const editButton = createRuleActionButton("Edit", () => handleRuleEdit(rule.id));
    const deleteButton = createRuleActionButton("Delete", () => handleRuleDelete(rule.id));
    const upButton = createRuleActionButton("Move Up", () => handleRuleMove(rule.id, -1), index === 0);
    const downButton = createRuleActionButton(
      "Move Down",
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
  ruleFormTitle.textContent = "Add Rule";
  ruleSaveButton.textContent = "Add Rule";
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
  ruleFormTitle.textContent = "Edit Rule";
  ruleSaveButton.textContent = "Save Rule";
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
    cueElements[activeCueIndex].classList.remove("subtitle-item--active");
  }

  const element = cueElements[newIndex];
  if (element) {
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
  
  container.scrollTo({
    top: targetScroll,
    behavior: "smooth"
  });
}

function resetAutoScrollTimer() {
  if (autoScrollTimer !== null) {
    clearTimeout(autoScrollTimer);
  }
  autoScrollEnabled = false;
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

function renderTrackSelectors(state: DesktopState) {
  if (!state.subtitleTracks.length) {
    controlPanel.style.display = "flex";
    primaryTrackSelector.innerHTML = "";
    secondaryTrackSelector.innerHTML = "";
    lastTrackSignature = "";
    return;
  }

  controlPanel.style.display = "flex";
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
    noneOption.textContent = "None";
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

function formatJellyfinSessionLabel(session: JellyfinSessionSummary): string {
  const title = session.nowPlayingItemName ?? "Idle";
  const user = session.userName ?? "Unknown user";
  const device = session.deviceName ?? session.client ?? "Unknown device";
  return `${title} · ${user} · ${device}`;
}

function renderJellyfinControls(state: DesktopState) {
  if (!jellyfinStatusIndicator || !jellyfinSessionSelector) {
    return;
  }
  const sessionCount = state.jellyfin.sessions.length;
  jellyfinStatusIndicator.textContent = state.jellyfin.connected
    ? `Jellyfin: Connected (${sessionCount} session${sessionCount === 1 ? "" : "s"})`
    : "Jellyfin: Disconnected";

  const previousLength = jellyfinSessionSelector.options.length - 1;
  const needsRebuild =
    previousLength !== sessionCount || jellyfinSessionSelector.dataset.signature !== String(sessionCount);
  if (needsRebuild) {
    jellyfinSessionSelector.innerHTML = "";
    const browserOption = document.createElement("option");
    browserOption.value = "";
    browserOption.textContent = "Browser (active tab)";
    jellyfinSessionSelector.appendChild(browserOption);
    state.jellyfin.sessions.forEach((session) => {
      const option = document.createElement("option");
      option.value = session.id;
      option.textContent = formatJellyfinSessionLabel(session);
      jellyfinSessionSelector.appendChild(option);
    });
    jellyfinSessionSelector.dataset.signature = String(sessionCount);
  }
  const desiredValue = state.jellyfin.selectedSessionId ?? "";
  jellyfinSessionSelector.value = desiredValue;
  if (jellyfinSessionSelector.value !== desiredValue) {
    jellyfinSessionSelector.value = "";
  }
}

function renderState(state: DesktopState) {
  currentStateSnapshot = state;
  if (currentSettings) {
    syncPlaybackProfileSettings();
  }

  const browserStatus = state.connectionCount > 0 ? `Browser: ${state.connectionCount}` : "Browser: disconnected";
  const jellyfinStatus = state.jellyfin.connected ? "Jellyfin: connected" : "Jellyfin: disconnected";
  connectionIndicator.textContent = `${browserStatus} · ${jellyfinStatus}`;

  videoTitle.textContent = state.title ?? "Waiting for video...";
  videoUrl.textContent = formatUrl(state.videoUrl);

  if (activeProfileLabel) {
    const profileName = state.appliedProfileName ?? "Default Profile";
    if (state.appliedRulePattern) {
      const matchLabel = state.appliedRuleMatchType
        ? MATCH_TYPE_LABELS[state.appliedRuleMatchType] ?? state.appliedRuleMatchType
        : "Rule";
      activeProfileLabel.textContent = `Profile: ${profileName} (${matchLabel}: ${state.appliedRulePattern})`;
    } else {
      activeProfileLabel.textContent = `Profile: ${profileName}`;
    }
  }

  const { text, modifier } = formatStatus(state);
  statusBanner.textContent = text;
  statusBanner.className = `status-banner ${modifier}`;

  renderTrackSelectors(state);
  renderJellyfinControls(state);

  if (state.primarySubtitles) {
    renderSubtitles(state.primarySubtitles, state.secondarySubtitles);
    if (currentPlayback) {
      highlightActiveCue(currentPlayback.currentTime);
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

function applySubtitleStyles(settings: ProfileSettings | null) {
  const family = settings?.subtitleFontFamily?.trim();
  const fontSize = Number(settings?.subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE) || DEFAULT_SUBTITLE_FONT_SIZE;
  rootElement.style.setProperty(
    "--subtitle-font-family",
    family && family.length ? family : DEFAULT_SUBTITLE_FONT_FAMILY
  );
  rootElement.style.setProperty("--subtitle-font-size", `${fontSize}px`);
}

function renderSettings(settings: AppSettings) {
  currentSettings = settings;
  ensureEditingProfile();
  ensureEditingJellyfinConfig();
  closeBehaviorSelect.value = settings.global.closeBehavior;
  autostartToggle.checked = settings.global.autoLaunch;
  if (jellyfinEnabledToggle) {
    jellyfinEnabledToggle.checked = settings.jellyfin.enabled;
  }
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

if (jellyfinSessionSelector) {
  jellyfinSessionSelector.addEventListener("change", () => {
    const value = jellyfinSessionSelector.value;
    window.usp.selectJellyfinSession(value || null);
  });
}

if (jellyfinEnabledToggle) {
  jellyfinEnabledToggle.addEventListener("change", () => {
    updateJellyfinSettings({ enabled: jellyfinEnabledToggle.checked });
  });
}

jellyfinConfigAddButton.addEventListener("click", handleJellyfinConfigAdd);
jellyfinConfigDeleteButton.addEventListener("click", handleJellyfinConfigDelete);
jellyfinConfigActivateButton.addEventListener("click", handleJellyfinConfigActivate);

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
  window.usp.controlVideo({ type: "pause" });
});

playButton.addEventListener("click", () => {
  window.usp.controlVideo({ type: "play" });
});

subtitleList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  
  // Check if the clicked element is the play button
  if (target.classList.contains("subtitle-item__play-btn")) {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    const cue = combinedCues[index];
    if (cue) {
      window.usp.controlVideo({ type: "seek", time: cue.start });
    }
  }
  
  // Check if the clicked element is the loop button
  if (target.classList.contains("subtitle-item__loop-btn")) {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    
    // Toggle loop mode
    if (loopingCueIndex === index) {
      // Disable loop
      loopingCueIndex = null;
      // Remove active class from all loop buttons
      document.querySelectorAll(".subtitle-item__loop-btn--active").forEach((btn) => {
        btn.classList.remove("subtitle-item__loop-btn--active");
      });
      // Send stop loop command to extension
      window.usp.controlVideo({ type: "stopLoop" });
    } else {
      // Enable loop for this cue
      const prevLoopIndex = loopingCueIndex;
      loopingCueIndex = index;
      
      // Remove active class from previous loop button
      if (prevLoopIndex !== null) {
        const prevButton = document.querySelector(
          `.subtitle-item__loop-btn[data-index="${prevLoopIndex}"]`
        );
        if (prevButton) {
          prevButton.classList.remove("subtitle-item__loop-btn--active");
        }
      }
      
      // Add active class to current loop button
      target.classList.add("subtitle-item__loop-btn--active");
      
      // Send loop command to extension with start and end times
      const cue = combinedCues[index];
      if (cue) {
        window.usp.controlVideo({ type: "loop", start: cue.start, end: cue.end });
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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isSettingsOpen) {
    setSettingsOpen(false);
  }
});

async function bootstrap() {
  try {
    const initialState = await window.usp.getInitialState();
    renderState(initialState);
  } catch (error) {
    console.error("[Renderer] Failed to get initial state:", error);
    statusBanner.textContent = `Failed to get initial state: ${error instanceof Error ? error.message : String(error)}`;
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
    currentPlayback = payload;
    highlightActiveCue(payload.currentTime);
  });

  window.usp.onSettingsChange((settings) => {
    renderSettings(settings);
  });

  window.usp.onLoopCleared(() => {
    // Clear loop state in UI when extension clears it due to user interaction
    if (loopingCueIndex !== null) {
      const loopButton = document.querySelector(
        `.subtitle-item__loop-btn[data-index="${loopingCueIndex}"]`
      );
      if (loopButton) {
        loopButton.classList.remove("subtitle-item__loop-btn--active");
      }
      loopingCueIndex = null;
      console.log("[Renderer] Loop cleared by user interaction");
    }
  });
}

bootstrap();
