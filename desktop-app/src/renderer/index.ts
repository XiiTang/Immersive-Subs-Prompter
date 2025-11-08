import type {
  AppSettings,
  DesktopState,
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
  contains: "包含",
  exact: "完全匹配",
  regex: "正则"
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
let playbackProfileSettings: ProfileSettings | null = null;
let ruleFormInitialized = false;

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
    empty.textContent = "暂无配置";
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
      badge.textContent = "默认";
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

function handleProfileAdd() {
  if (!currentSettings) {
    return;
  }
  const newProfile: ProfileDefinition = {
    id: createId("profile"),
    name: `情景配置 ${currentSettings.profiles.length + 1}`,
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
    name: `${profile.name} 副本`,
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
    window.alert("默认配置无法删除，请先切换默认配置。");
    return;
  }
  if (currentSettings.profiles.length <= 1) {
    window.alert("至少保留一个配置。");
    return;
  }
  if (currentSettings.rules.some((rule) => rule.profileId === profile.id)) {
    window.alert("此配置仍被规则引用，请先修改或删除相关规则。");
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
  return currentSettings.profiles.find((profile) => profile.id === profileId)?.name ?? "未知配置";
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
    empty.textContent = "暂无规则";
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
    target.textContent = `套用配置：${getProfileDisplayName(rule.profileId)}`;
    item.appendChild(target);

    const actions = document.createElement("div");
    actions.className = "rule-item__actions";
    const toggleButton = createRuleActionButton(rule.isEnabled ? "禁用" : "启用", () => handleRuleToggle(rule.id));
    const editButton = createRuleActionButton("编辑", () => handleRuleEdit(rule.id));
    const deleteButton = createRuleActionButton("删除", () => handleRuleDelete(rule.id));
    const upButton = createRuleActionButton("上移", () => handleRuleMove(rule.id, -1), index === 0);
    const downButton = createRuleActionButton(
      "下移",
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
  ruleFormTitle.textContent = "新增规则";
  ruleSaveButton.textContent = "添加规则";
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
  ruleFormTitle.textContent = "编辑规则";
  ruleSaveButton.textContent = "保存规则";
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

  if (!primaryTrack) {
    return;
  }

  combinedCues = mergeSubtitleCues(primaryTrack.cues, secondaryTrack?.cues ?? []);

  combinedCues.forEach((cue, index) => {
    const item = document.createElement("div");
    item.className = "subtitle-item";
    item.dataset.index = String(index);

    const time = document.createElement("span");
    time.className = "subtitle-item__time";
    time.textContent = `${formatTime(cue.start)} - ${formatTime(cue.end)}`;

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

    item.appendChild(time);
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
  
  // 使用当前生效配置中的位置百分比 (0-100)
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
    controlPanel.style.display = "none";
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

function renderState(state: DesktopState) {
  currentStateSnapshot = state;
  if (currentSettings) {
    syncPlaybackProfileSettings();
  }

  connectionIndicator.textContent =
    state.connectionCount > 0 ? `Connected ×${state.connectionCount}` : "Disconnected";

  videoTitle.textContent = state.title ?? "Waiting for video...";
  videoUrl.textContent = formatUrl(state.videoUrl);

  if (activeProfileLabel) {
    const profileName = state.appliedProfileName ?? "默认配置";
    if (state.appliedRulePattern) {
      const matchLabel = state.appliedRuleMatchType
        ? MATCH_TYPE_LABELS[state.appliedRuleMatchType] ?? state.appliedRuleMatchType
        : "规则";
      activeProfileLabel.textContent = `情景配置：${profileName}（${matchLabel}：${state.appliedRulePattern}）`;
    } else {
      activeProfileLabel.textContent = `情景配置：${profileName}`;
    }
  }

  const { text, modifier } = formatStatus(state);
  statusBanner.textContent = text;
  statusBanner.className = `status-banner ${modifier}`;

  renderTrackSelectors(state);

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
  closeBehaviorSelect.value = settings.global.closeBehavior;
  autostartToggle.checked = settings.global.autoLaunch;
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
  const target = (event.target as HTMLElement).closest(".subtitle-item") as HTMLElement | null;
  if (!target) return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;
  const cue = combinedCues[index];
  if (cue) {
    window.usp.controlVideo({ type: "seek", time: cue.start });
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
}

bootstrap();
