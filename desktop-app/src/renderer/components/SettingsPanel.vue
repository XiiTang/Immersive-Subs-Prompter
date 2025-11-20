<template>
  <section class="settings-panel" aria-hidden="false">
    <div class="settings-panel__header">
      <button type="button" class="text-button" @click="store.setSettingsOpen(false)">
        {{ t("settings-back", "← Back") }}
      </button>
      <div class="settings-panel__title">{{ t("settings-title", "Settings") }}</div>
    </div>
    <div class="settings-panel__content" v-if="store.settings">
      <section class="settings-section">
        <h3 class="settings-section__title">{{ t("section-global-settings", "Global Settings") }}</h3>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("close-behavior-label", "Close Behavior") }}</span>
          <select v-model="closeBehavior">
            <option value="tray">{{ t("close-behavior-tray", "Minimize to tray on close") }}</option>
            <option value="quit">{{ t("close-behavior-quit", "Quit application") }}</option>
          </select>
        </label>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">{{ t("auto-start-label", "Auto Start") }}</span>
          <label class="toggle">
            <input type="checkbox" v-model="autoLaunch" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">Auto-hide Panels</span>
          <label class="toggle">
            <input type="checkbox" v-model="autoHidePanels" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("toggle-shortcut-label", "Toggle Window Shortcut") }}</span>
          <input type="text" v-model="toggleShortcut" placeholder="CommandOrControl+Shift+S" />
          <span class="settings-field__hint">{{ t("toggle-shortcut-hint", "Use modifiers with keys.") }}</span>
        </label>
        <section class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("process-blacklist-label", "Process Blacklist") }}</span>
            <small class="settings-field__hint">
              {{ t("process-blacklist-hint", "Disable shortcuts when these processes are foregrounded.") }}
            </small>
          </div>
          <div class="game-blacklist-editor__controls">
            <input
              type="text"
              v-model="gameProcessInput"
              :placeholder="t('primary-priority-placeholder', 'e.g.: cyberpunk2077.exe')"
              autocomplete="off"
              @keyup.enter="addGameProcess"
            />
            <button type="button" class="text-button" @click="addGameProcess">
              {{ t("button-add", "Add") }}
            </button>
          </div>
          <div class="game-blacklist-editor__list">
            <template v-if="gameProcesses.length">
              <div
                v-for="process in gameProcesses"
                :key="process"
                class="game-blacklist-editor__item"
              >
                <span>{{ process }}</span>
                <button
                  type="button"
                  class="game-blacklist-editor__item-remove"
                  :aria-label="t('game-blacklist-remove', 'Remove')"
                  @click="removeGameProcess(process)"
                >
                  ✕
                </button>
              </div>
            </template>
            <div v-else class="game-blacklist-editor__empty">
              {{ t("game-blacklist-none", "No processes yet.") }}
            </div>
          </div>
        </section>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("auto-hide-label", "Auto-hide Trigger Area Height") }}</span>
            <span class="settings-field__value">{{ autoHideHeight }}px</span>
          </div>
          <input
            type="range"
            min="80"
            max="600"
            step="10"
            class="slider"
            v-model.number="autoHideHeight"
            @pointerdown="emit('preview-auto-hide', true)"
            @pointerup="emit('preview-auto-hide', false)"
            @pointercancel="emit('preview-auto-hide', false)"
            @blur="emit('preview-auto-hide', false)"
          />
          <small class="settings-field__hint">
            {{ t("auto-hide-hint", "Distance from top that keeps panels expanded while auto-hide is on") }}
          </small>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("language-label", "Language") }}</span>
          <select v-model="languageSetting">
            <option value="en">{{ t("language-option-en", "English") }}</option>
            <option value="zh">{{ t("language-option-zh", "中文") }}</option>
          </select>
          <small class="settings-field__hint">{{ t("language-hint", "Select interface language.") }}</small>
        </label>
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">{{ t("section-profiles", "Profiles") }}</h3>
        <div class="profile-settings">
          <div class="profile-settings__sidebar">
            <div class="profile-settings__actions">
              <span class="settings-field__label">{{ t("profile-list-label", "Profile List") }}</span>
              <div class="profile-settings__buttons">
                <button type="button" class="text-button" @click="store.addProfile()">
                  {{ t("button-add", "Add") }}
                </button>
                <button type="button" class="text-button" @click="store.duplicateProfile()">
                  {{ t("button-duplicate", "Duplicate") }}
                </button>
                <button
                  type="button"
                  class="text-button"
                  :disabled="!canDeleteProfile"
                  @click="deleteEditingProfile"
                >
                  {{ t("button-delete", "Delete") }}
                </button>
              </div>
            </div>
            <div class="profile-list">
              <template v-if="profiles.length">
                <button
                  v-for="profile in profiles"
                  :key="profile.id"
                  type="button"
                  class="profile-list__item"
                  :class="{ 'is-selected': profile.id === editingProfileId }"
                  @click="store.setEditingProfile(profile.id)"
                >
                  <span class="profile-list__name">{{ profile.name }}</span>
                  <span v-if="profile.id === defaultProfileId" class="profile-list__badge">
                    {{ t("default-badge", "Default") }}
                  </span>
                </button>
              </template>
              <div v-else class="profile-list__empty">{{ t("profile-empty", "No profiles") }}</div>
            </div>
            <button
              type="button"
              class="text-button profile-settings__default"
              :disabled="!editingProfile || editingProfile.id === defaultProfileId"
              @click="setDefaultProfile"
            >
              {{ t("button-set-default", "Set as Default") }}
            </button>
          </div>
          <div class="profile-settings__editor" v-if="editingProfile">
            <label class="settings-field">
              <span class="settings-field__label">{{ t("profile-name-label", "Profile Name") }}</span>
              <input type="text" v-model="profileName" autocomplete="off" />
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("subtitle-font-label", "Subtitle Font") }}</span>
              <input
                type="text"
                v-model="subtitleFontFamily"
                placeholder="e.g.: LXGW WenKai, sans-serif"
                autocomplete="off"
              />
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("subtitle-font-size-label", "Subtitle Font Size") }}</span>
              <input type="number" min="10" max="48" step="1" v-model.number="subtitleFontSize" />
            </label>
            <label class="settings-field">
              <span class="settings-field__label">
                {{ t("subtitle-autoscroll-label", "Auto-scroll Restore Time (seconds)") }}
              </span>
              <input type="number" min="1" max="60" step="1" v-model.number="subtitleAutoScrollTimeout" />
              <span class="settings-field__hint">
                {{ t("subtitle-autoscroll-hint", "How long to wait before auto-scroll resumes") }}
              </span>
            </label>
            <label class="settings-field">
              <div class="settings-field__label-row">
                <span class="settings-field__label">
                  {{ t("subtitle-scroll-position-label", "Subtitle Scroll Position") }}
                </span>
                <span class="settings-field__value">{{ subtitleScrollPosition }}%</span>
              </div>
              <input type="range" min="0" max="100" step="1" class="slider" v-model.number="subtitleScrollPosition" />
              <small class="settings-field__hint">
                {{
                  t(
                    "subtitle-scroll-position-hint",
                    "Where active subtitles sit in the panel (0% top, 50% middle, 100% bottom)"
                  )
                }}
              </small>
            </label>
            <label class="settings-field">
              <div class="settings-field__label-row">
                <span class="settings-field__label">
                  {{ t("subtitle-line-spacing-label", "Subtitle Line Spacing") }}
                </span>
                <span class="settings-field__value">{{ subtitleLineSpacing }}px</span>
              </div>
              <input type="range" min="0" max="60" step="1" class="slider" v-model.number="subtitleLineSpacing" />
              <small class="settings-field__hint">
                {{ t("subtitle-line-spacing-hint", "Adjust vertical spacing between lines") }}
              </small>
            </label>
            <label class="settings-field">
              <div class="settings-field__label-row">
                <span class="settings-field__label">{{ t("subtitle-time-gap-label", "Timestamp to Text Gap") }}</span>
                <span class="settings-field__value">{{ subtitleTimeTextGap }}px</span>
              </div>
              <input type="range" min="0" max="60" step="1" class="slider" v-model.number="subtitleTimeTextGap" />
              <small class="settings-field__hint">
                {{ t("subtitle-time-gap-hint", "Distance between timestamp and subtitle text") }}
              </small>
            </label>
            <label class="settings-field">
              <div class="settings-field__label-row">
                <span class="settings-field__label">
                  {{ t("subtitle-primary-secondary-gap-label", "Primary to Secondary Subtitle Gap") }}
                </span>
                <span class="settings-field__value">{{ subtitlePrimarySecondaryGap }}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                class="slider"
                v-model.number="subtitlePrimarySecondaryGap"
              />
              <small class="settings-field__hint">
                {{ t("subtitle-primary-secondary-gap-hint", "Vertical distance between primary and secondary subtitle") }}
              </small>
            </label>
            <label class="settings-field">
              <div class="settings-field__label-row">
                <span class="settings-field__label">{{ t("subtitle-line-height-label", "Line Height") }}</span>
                <span class="settings-field__value">{{ subtitleLineHeight }}</span>
              </div>
              <input type="range" min="1" max="3" step="0.05" class="slider" v-model.number="subtitleLineHeight" />
              <small class="settings-field__hint">
                {{ t("subtitle-line-height-hint", "Control line-height for readability") }}
              </small>
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("subtitle-primary-color-label", "Primary Subtitle Text Color") }}</span>
              <input type="color" v-model="subtitlePrimaryColor" />
              <small class="settings-field__hint">
                {{ t("subtitle-primary-color-hint", "Default text color for primary subtitles") }}
              </small>
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("subtitle-secondary-color-label", "Secondary Subtitle Text Color") }}</span>
              <input type="color" v-model="subtitleSecondaryColor" />
              <small class="settings-field__hint">
                {{ t("subtitle-secondary-color-hint", "Default text color for secondary subtitles") }}
              </small>
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("subtitle-active-primary-color-label", "Active Primary Subtitle Color") }}</span>
              <input type="color" v-model="subtitleActivePrimaryColor" />
              <small class="settings-field__hint">
                {{ t("subtitle-active-primary-color-hint", "Text color while active") }}
              </small>
            </label>
            <label class="settings-field">
              <span class="settings-field__label">
                {{ t("subtitle-active-secondary-color-label", "Active Secondary Subtitle Color") }}
              </span>
              <input type="color" v-model="subtitleActiveSecondaryColor" />
              <small class="settings-field__hint">
                {{ t("subtitle-active-secondary-color-hint", "Text color for active secondary subtitles") }}
              </small>
            </label>

            <div class="priority-editor">
              <div class="priority-editor__header">
                <span class="settings-field__label">{{ t("primary-priority-label", "Primary Subtitle Priority") }}</span>
                <span class="priority-editor__hint">
                  {{ t("primary-priority-hint", "Match language/tag keywords; reorder to reprioritize") }}
                </span>
              </div>
              <div class="priority-editor__list">
                <template v-if="primaryPriority.length">
                  <span
                    v-for="(item, index) in primaryPriority"
                    :key="`${item}-${index}`"
                    class="priority-editor__item"
                  >
                    <span>{{ item }}</span>
                    <button
                      type="button"
                      class="priority-editor__item-remove"
                      :aria-label="t('priority-remove', 'Remove priority')"
                      @click="removePriority('primary', item)"
                    >
                      ✕
                    </button>
                    <div class="priority-editor__actions">
                      <button
                        class="text-button"
                        type="button"
                        :disabled="index === 0"
                        @click="movePriority('primary', index, 'up')"
                      >
                        ↑
                      </button>
                      <button
                        class="text-button"
                        type="button"
                        :disabled="index === primaryPriority.length - 1"
                        @click="movePriority('primary', index, 'down')"
                      >
                        ↓
                      </button>
                    </div>
                  </span>
                </template>
                <span v-else class="priority-editor__empty">
                  {{ t("priority-empty", "No priorities yet") }}
                </span>
              </div>
              <div class="priority-editor__controls">
                <input
                  type="text"
                  v-model="primaryPriorityInput"
                  :placeholder="t('primary-priority-placeholder', 'e.g.: en')"
                  @keyup.enter="addPriority('primary')"
                />
                <button type="button" class="text-button" @click="addPriority('primary')">
                  {{ t("button-add", "Add") }}
                </button>
              </div>
            </div>

            <div class="priority-editor">
              <div class="priority-editor__header">
                <span class="settings-field__label">
                  {{ t("secondary-priority-label", "Secondary Subtitle Priority") }}
                </span>
                <span class="priority-editor__hint">
                  {{ t("secondary-priority-hint", "Usually the keywords for your native language") }}
                </span>
              </div>
              <div class="priority-editor__list">
                <template v-if="secondaryPriority.length">
                  <span
                    v-for="(item, index) in secondaryPriority"
                    :key="`${item}-${index}`"
                    class="priority-editor__item"
                  >
                    <span>{{ item }}</span>
                    <button
                      type="button"
                      class="priority-editor__item-remove"
                      :aria-label="t('priority-remove', 'Remove priority')"
                      @click="removePriority('secondary', item)"
                    >
                      ✕
                    </button>
                    <div class="priority-editor__actions">
                      <button
                        class="text-button"
                        type="button"
                        :disabled="index === 0"
                        @click="movePriority('secondary', index, 'up')"
                      >
                        ↑
                      </button>
                      <button
                        class="text-button"
                        type="button"
                        :disabled="index === secondaryPriority.length - 1"
                        @click="movePriority('secondary', index, 'down')"
                      >
                        ↓
                      </button>
                    </div>
                  </span>
                </template>
                <span v-else class="priority-editor__empty">
                  {{ t("priority-empty", "No priorities yet") }}
                </span>
              </div>
              <div class="priority-editor__controls">
                <input
                  type="text"
                  v-model="secondaryPriorityInput"
                  :placeholder="t('secondary-priority-placeholder', 'e.g.: zh, zh-Hans')"
                  @keyup.enter="addPriority('secondary')"
                />
                <button type="button" class="text-button" @click="addPriority('secondary')">
                  {{ t("button-add", "Add") }}
                </button>
              </div>
            </div>

            <label class="settings-field">
              <span class="settings-field__label">{{ t("yt-dlp-args-label", "yt-dlp Arguments") }}</span>
              <textarea rows="3" spellcheck="false" v-model="ytDlpArgs"></textarea>
              <small class="settings-field__hint">
                {{ t("yt-dlp-args-hint", "Leave blank to use default arguments") }}
              </small>
            </label>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">{{ t("section-jellyfin", "Jellyfin Integration") }}</h3>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">{{ t("jellyfin-enable-label", "Enable Jellyfin") }}</span>
          <label class="toggle">
            <input type="checkbox" v-model="jellyfinEnabled" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>

        <div class="jellyfin-config-manager">
          <div class="jellyfin-config-manager__sidebar">
            <div class="jellyfin-config-manager__actions">
              <span class="settings-field__label">{{ t("server-list-label", "Server List") }}</span>
              <div class="jellyfin-config-manager__buttons">
                <button type="button" class="text-button" @click="addJellyfinConfig">
                  {{ t("button-add", "Add") }}
                </button>
                <button
                  type="button"
                  class="text-button"
                  :disabled="!selectedJellyfinConfigId"
                  @click="deleteSelectedJellyfinConfig"
                >
                  {{ t("button-delete", "Delete") }}
                </button>
              </div>
            </div>
            <div class="jellyfin-config-list" :class="{ 'jellyfin-config-list--empty': !jellyfinConfigs.length }">
              <template v-if="jellyfinConfigs.length">
                <button
                  v-for="config in jellyfinConfigs"
                  :key="config.id"
                  type="button"
                  class="jellyfin-config-list__item"
                  :class="{
                    'is-selected': config.id === selectedJellyfinConfigId,
                    'is-disabled': !config.enabled
                  }"
                  @click="selectedJellyfinConfigId = config.id"
                >
                  <div class="jellyfin-config-list__name">{{ config.name || config.serverUrl || "Untitled" }}</div>
                  <div class="jellyfin-config-list__toggle">
                    <span>{{ config.enabled ? t("jellyfin-config-enabled", "Enabled") : t("jellyfin-config-disabled", "Disabled") }}</span>
                  </div>
                </button>
              </template>
              <div v-else class="jellyfin-config-list__empty">
                {{ t("jellyfin-no-servers", "No servers configured") }}
              </div>
            </div>
          </div>
          <div class="jellyfin-config-manager__editor" v-if="selectedJellyfinConfig">
            <label class="settings-field">
              <span class="settings-field__label">{{ t("server-name-label", "Server Name") }}</span>
              <input type="text" v-model="jellyfinName" />
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("server-url-label", "Server URL") }}</span>
              <input type="text" v-model="jellyfinServerUrl" />
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("api-key-label", "API Key") }}</span>
              <input type="text" v-model="jellyfinApiKey" />
            </label>
            <label class="settings-field">
              <span class="settings-field__label">{{ t("ws-path-label", "WebSocket Path") }}</span>
              <input type="text" v-model="jellyfinWsPath" />
            </label>
            <div class="settings-field settings-field--inline">
              <span class="settings-field__label">{{ t("jellyfin-enable-label", "Enable Jellyfin") }}</span>
              <label class="toggle">
                <input type="checkbox" v-model="jellyfinConfigEnabled" />
                <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">{{ t("section-cache", "Subtitle Cache") }}</h3>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">{{ t("enable-cache-label", "Enable Cache") }}</span>
          <label class="toggle">
            <input type="checkbox" v-model="cacheEnabled" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("cache-path-label", "Cache Path") }}</span>
          <input type="text" v-model="cachePath" />
          <small class="settings-field__hint">{{ t("cache-path-hint", "Leave blank to use default location") }}</small>
        </label>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("cache-retention-label", "Retention (days)") }}</span>
          <input type="number" min="1" max="365" step="1" v-model.number="cacheRetentionDays" />
          <small class="settings-field__hint">
            {{ t("cache-retention-hint", "How long cached subtitles are kept (1-365)") }}
          </small>
        </label>
        <div class="cache-stats">
          <div class="cache-stats__item">
            <span class="cache-stats__label">{{ t("cache-stats-entries", "Total entries:") }}</span>
            <span class="cache-stats__value">{{ cacheStatsDisplay.entries }}</span>
          </div>
          <div class="cache-stats__item">
            <span class="cache-stats__label">{{ t("cache-stats-size", "Total size:") }}</span>
            <span class="cache-stats__value">{{ cacheStatsDisplay.size }}</span>
          </div>
          <div class="cache-stats__item">
            <span class="cache-stats__label">{{ t("cache-stats-oldest", "Oldest entry:") }}</span>
            <span class="cache-stats__value">{{ cacheStatsDisplay.oldest }}</span>
          </div>
        </div>
        <div class="cache-actions">
          <button type="button" class="text-button" :disabled="cacheBusy" @click="openCacheFolder">
            {{ t("button-open-cache", "Open Folder") }}
          </button>
          <button type="button" class="text-button" :disabled="cacheBusy" @click="refreshCacheStats">
            {{ t("button-refresh-stats", "Refresh Stats") }}
          </button>
          <button type="button" class="text-button" :disabled="cacheBusy" @click="cleanupCache">
            {{ t("button-cleanup", "Cleanup expired") }}
          </button>
          <button type="button" class="text-button" :disabled="cacheBusy" @click="clearCache">
            {{ t("button-clear-cache", "Clear all") }}
          </button>
        </div>
        <div v-if="cacheMessage" class="settings-field__hint">{{ cacheMessage }}</div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">{{ t("section-rules", "URL Rules") }}</h3>
        <div class="rule-list">
          <template v-if="rules.length">
            <div
              v-for="(rule, index) in rules"
              :key="rule.id"
              class="rule-item"
              :class="{ 'is-disabled': !rule.isEnabled }"
            >
              <div class="rule-item__header">
                <div>
                  <div class="rule-item__title">{{ rule.name }}</div>
                  <div class="rule-item__meta">{{ rule.pattern }} ({{ matchTypeLabel(rule.matchType) }})</div>
                </div>
                <div class="rule-item__actions">
                  <button
                    type="button"
                    class="rule-item__action"
                    @click="toggleRule(rule.id, !rule.isEnabled)"
                  >
                    {{ rule.isEnabled ? t("rule-action-disable", "Disable") : t("rule-action-enable", "Enable") }}
                  </button>
                  <button type="button" class="rule-item__action" @click="editRule(rule)">
                    {{ t("rule-action-edit", "Edit") }}
                  </button>
                  <button
                    type="button"
                    class="rule-item__action"
                    :disabled="index === 0"
                    @click="moveRule(rule.id, 'up')"
                  >
                    {{ t("rule-action-move-up", "Move up") }}
                  </button>
                  <button
                    type="button"
                    class="rule-item__action"
                    :disabled="index === rules.length - 1"
                    @click="moveRule(rule.id, 'down')"
                  >
                    {{ t("rule-action-move-down", "Move down") }}
                  </button>
                  <button type="button" class="rule-item__action" @click="deleteRule(rule.id)">
                    {{ t("rule-action-delete", "Delete") }}
                  </button>
                </div>
              </div>
              <div class="rule-item__meta">
                {{ t("rule-apply-prefix", "Apply profile:") }} {{ profileNameById(rule.profileId) }}
              </div>
            </div>
          </template>
          <div v-else class="rule-list__empty">{{ t("rule-empty", "No rules") }}</div>
        </div>

        <form class="rule-form" @submit.prevent="saveRule">
          <div class="rule-form__header">
            <span class="settings-field__label">
              {{ ruleForm.id ? t("rule-form-title-edit", "Edit rule") : t("rule-form-title", "Add Rule") }}
            </span>
            <button type="button" class="text-button" @click="resetRuleForm">
              {{ t("rule-cancel", "Cancel edit") }}
            </button>
          </div>
          <label class="settings-field">
            <span class="settings-field__label">{{ t("rule-name-label", "Rule Name") }}</span>
            <input type="text" v-model="ruleForm.name" />
          </label>
          <label class="settings-field">
            <span class="settings-field__label">{{ t("rule-match-label", "Match Type") }}</span>
            <select v-model="ruleForm.matchType">
              <option value="contains">{{ t("rule-match-contains", "Contains") }}</option>
              <option value="exact">{{ t("rule-match-exact", "Exact Match") }}</option>
              <option value="regex">{{ t("rule-match-regex", "Regex") }}</option>
            </select>
          </label>
          <label class="settings-field">
            <span class="settings-field__label">{{ t("rule-pattern-label", "Pattern") }}</span>
            <input type="text" v-model="ruleForm.pattern" />
          </label>
          <label class="settings-field">
            <span class="settings-field__label">{{ t("rule-apply-profile-label", "Apply Profile") }}</span>
            <select v-model="ruleForm.profileId">
              <option
                v-for="profile in profiles"
                :key="profile.id"
                :value="profile.id"
              >
                {{ profile.name }}
              </option>
            </select>
          </label>
          <div class="settings-field settings-field--inline">
            <span class="settings-field__label">{{ t("rule-action-enable", "Enable") }}</span>
            <label class="toggle">
              <input type="checkbox" v-model="ruleForm.isEnabled" />
              <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
            </label>
          </div>
          <button class="rule-form__submit" type="submit">
            {{ ruleForm.id ? t("rule-form-submit-save", "Save Rule") : t("rule-form-submit-add", "Add Rule") }}
          </button>
        </form>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useDesktopStore } from "../stores/desktop";
import type { JellyfinConfig, ProfileRule, UrlMatchType } from "../main/types.js";
import { DEFAULT_LANGUAGE, useI18n } from "../i18n.js";

const emit = defineEmits<{
  (e: "preview-auto-hide", visible: boolean): void;
}>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const closeBehavior = computed({
  get: () => store.settings?.global.closeBehavior ?? "tray",
  set: (value: "tray" | "quit") => store.updateGlobalSetting("closeBehavior", value)
});

const autoLaunch = computed({
  get: () => store.settings?.global.autoLaunch ?? false,
  set: (value: boolean) => store.updateGlobalSetting("autoLaunch", value)
});

const toggleShortcut = computed({
  get: () => store.settings?.global.toggleWindowShortcut ?? "",
  set: (value: string) => store.updateGlobalSetting("toggleWindowShortcut", value)
});

const autoHidePanels = computed({
  get: () => store.settings?.global.autoHidePanels ?? false,
  set: (value: boolean) => store.updateGlobalSetting("autoHidePanels", value)
});

const autoHideHeight = computed({
  get: () => store.autoHideZoneHeight,
  set: (value: number) => store.updateGlobalSetting("autoHideActiveZoneHeight", value)
});

const languageSetting = computed({
  get: () => language.value,
  set: (value: string) => store.updateGlobalSetting("language", value)
});

const profiles = computed(() => store.settings?.profiles ?? []);
const editingProfile = computed(() => store.editingProfile);
const editingProfileId = computed(() => store.editingProfile?.id ?? null);
const defaultProfileId = computed(() => store.settings?.defaultProfileId ?? null);
const canDeleteProfile = computed(
  () =>
    Boolean(editingProfileId.value) &&
    editingProfileId.value !== defaultProfileId.value &&
    (profiles.value.length ?? 0) > 1
);

const profileName = computed({
  get: () => editingProfile.value?.name ?? "",
  set: (value: string) => store.updateProfileMeta({ name: value })
});

const subtitleFontFamily = computed({
  get: () => store.editingProfileSettings.subtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("subtitleFontFamily", value)
});

const subtitleFontSize = computed({
  get: () => store.editingProfileSettings.subtitleFontSize,
  set: (value: number) => store.updateProfileSetting("subtitleFontSize", value)
});

const subtitleAutoScrollTimeout = computed({
  get: () => store.editingProfileSettings.subtitleAutoScrollTimeout,
  set: (value: number) => store.updateProfileSetting("subtitleAutoScrollTimeout", value)
});

const subtitleScrollPosition = computed({
  get: () => store.editingProfileSettings.subtitleScrollPosition,
  set: (value: number) => store.updateProfileSetting("subtitleScrollPosition", value)
});

const subtitleLineSpacing = computed({
  get: () => store.editingProfileSettings.subtitleLineSpacing,
  set: (value: number) => store.updateProfileSetting("subtitleLineSpacing", value)
});

const subtitleTimeTextGap = computed({
  get: () => store.editingProfileSettings.subtitleTimeTextGap,
  set: (value: number) => store.updateProfileSetting("subtitleTimeTextGap", value)
});

const subtitlePrimarySecondaryGap = computed({
  get: () => store.editingProfileSettings.subtitlePrimarySecondaryGap,
  set: (value: number) => store.updateProfileSetting("subtitlePrimarySecondaryGap", value)
});

const subtitleLineHeight = computed({
  get: () => store.editingProfileSettings.subtitleLineHeight,
  set: (value: number) => store.updateProfileSetting("subtitleLineHeight", value)
});

const subtitlePrimaryColor = computed({
  get: () => store.editingProfileSettings.subtitlePrimaryColor,
  set: (value: string) => store.updateProfileSetting("subtitlePrimaryColor", value)
});

const subtitleSecondaryColor = computed({
  get: () => store.editingProfileSettings.subtitleSecondaryColor,
  set: (value: string) => store.updateProfileSetting("subtitleSecondaryColor", value)
});

const subtitleActivePrimaryColor = computed({
  get: () => store.editingProfileSettings.subtitleActivePrimaryColor,
  set: (value: string) => store.updateProfileSetting("subtitleActivePrimaryColor", value)
});

const subtitleActiveSecondaryColor = computed({
  get: () => store.editingProfileSettings.subtitleActiveSecondaryColor,
  set: (value: string) => store.updateProfileSetting("subtitleActiveSecondaryColor", value)
});

const ytDlpArgs = computed({
  get: () => store.editingProfileSettings.ytDlpArgs,
  set: (value: string) => store.updateProfileSetting("ytDlpArgs", value)
});

const primaryPriority = computed(() => store.editingProfileSettings.primarySubtitlePriority ?? []);
const secondaryPriority = computed(() => store.editingProfileSettings.secondarySubtitlePriority ?? []);
const primaryPriorityInput = ref("");
const secondaryPriorityInput = ref("");

const gameProcessInput = ref("");
const gameProcesses = computed(() => store.settings?.global.gameProcessBlacklist ?? []);

function addGameProcess() {
  store.addGameProcess(gameProcessInput.value);
  gameProcessInput.value = "";
}

function removeGameProcess(name: string) {
  store.removeGameProcess(name);
}

function addPriority(role: "primary" | "secondary") {
  const value = role === "primary" ? primaryPriorityInput.value : secondaryPriorityInput.value;
  store.addPriority(role, value);
  if (role === "primary") {
    primaryPriorityInput.value = "";
  } else {
    secondaryPriorityInput.value = "";
  }
}

function removePriority(role: "primary" | "secondary", value: string) {
  store.removePriority(role, value);
}

function movePriority(role: "primary" | "secondary", index: number, direction: "up" | "down") {
  store.movePriority(role, index, direction);
}

function deleteEditingProfile() {
  if (!editingProfileId.value) {
    return;
  }
  const referenced = store.settings?.rules.some((rule) => rule.profileId === editingProfileId.value);
  if (editingProfileId.value === defaultProfileId.value || referenced) {
    console.warn("[Renderer] Cannot delete default or referenced profile.");
    return;
  }
  store.deleteProfile(editingProfileId.value);
}

function setDefaultProfile() {
  if (editingProfileId.value) {
    store.setDefaultProfile(editingProfileId.value);
  }
}

const jellyfinEnabled = computed({
  get: () => store.settings?.jellyfin.enabled ?? false,
  set: (value: boolean) => store.setJellyfinEnabled(value)
});

const jellyfinConfigs = computed(() => store.settings?.jellyfin.configs ?? []);
const selectedJellyfinConfigId = ref<string | null>(null);

watch(
  jellyfinConfigs,
  (configs) => {
    if (!configs.length) {
      selectedJellyfinConfigId.value = null;
      return;
    }
    if (!selectedJellyfinConfigId.value || !configs.find((config) => config.id === selectedJellyfinConfigId.value)) {
      selectedJellyfinConfigId.value = configs[0]?.id ?? null;
    }
  },
  { immediate: true }
);

const selectedJellyfinConfig = computed<JellyfinConfig | null>(() =>
  jellyfinConfigs.value.find((config) => config.id === selectedJellyfinConfigId.value) ?? null
);

const jellyfinName = computed({
  get: () => selectedJellyfinConfig.value?.name ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfig.value) {
      store.updateJellyfinConfig(selectedJellyfinConfig.value.id, { name: value });
    }
  }
});

const jellyfinServerUrl = computed({
  get: () => selectedJellyfinConfig.value?.serverUrl ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfig.value) {
      store.updateJellyfinConfig(selectedJellyfinConfig.value.id, { serverUrl: value });
    }
  }
});

const jellyfinApiKey = computed({
  get: () => selectedJellyfinConfig.value?.apiKey ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfig.value) {
      store.updateJellyfinConfig(selectedJellyfinConfig.value.id, { apiKey: value });
    }
  }
});

const jellyfinWsPath = computed({
  get: () => selectedJellyfinConfig.value?.webSocketPath ?? "",
  set: (value: string) => {
    if (selectedJellyfinConfig.value) {
      store.updateJellyfinConfig(selectedJellyfinConfig.value.id, { webSocketPath: value });
    }
  }
});

const jellyfinConfigEnabled = computed({
  get: () => selectedJellyfinConfig.value?.enabled ?? true,
  set: (value: boolean) => {
    if (selectedJellyfinConfig.value) {
      store.updateJellyfinConfig(selectedJellyfinConfig.value.id, { enabled: value });
    }
  }
});

function addJellyfinConfig() {
  const newId = store.addJellyfinConfig();
  if (newId) {
    selectedJellyfinConfigId.value = newId;
  }
}

function deleteSelectedJellyfinConfig() {
  if (selectedJellyfinConfigId.value) {
    store.deleteJellyfinConfig(selectedJellyfinConfigId.value);
  }
}

const cacheEnabled = computed({
  get: () => store.settings?.cache.enabled ?? true,
  set: (value: boolean) => store.updateCacheSetting("enabled", value)
});

const cachePath = computed({
  get: () => store.settings?.cache.path ?? "",
  set: (value: string) => store.updateCacheSetting("path", value)
});

const cacheRetentionDays = computed({
  get: () => store.settings?.cache.retentionDays ?? 7,
  set: (value: number) => {
    const clamped = Math.min(365, Math.max(1, Math.round(Number(value))));
    store.updateCacheSetting("retentionDays", clamped);
  }
});

const cacheStats = computed(() => store.cacheStats);
const cacheBusy = ref(false);
const cacheMessage = ref("");

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  return `${Math.round(value * 100) / 100} ${sizes[i]}`;
}

const cacheStatsDisplay = computed(() => {
  if (!cacheStats.value) {
    return { entries: "-", size: "-", oldest: "-" };
  }
  return {
    entries: cacheStats.value.totalEntries ?? 0,
    size: formatBytes(cacheStats.value.totalSize ?? 0),
    oldest: cacheStats.value.oldestEntry ? new Date(cacheStats.value.oldestEntry).toLocaleDateString() : "-"
  };
});

async function refreshCacheStats() {
  cacheBusy.value = true;
  cacheMessage.value = "";
  try {
    await store.refreshCacheStats();
  } catch (error) {
    cacheMessage.value = t("cache-cleanup-failure", "Failed to refresh cache stats: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    cacheBusy.value = false;
  }
}

async function cleanupCache() {
  cacheBusy.value = true;
  cacheMessage.value = t("cache-cleanup-progress", "Cleaning up...");
  try {
    const result = await store.cleanupCache();
    if (result && typeof (result as any).removedCount === "number") {
      cacheMessage.value = t("cache-cleanup-success", "Cleanup complete! Removed {count} entries.", {
        count: String((result as any).removedCount)
      });
    } else {
      cacheMessage.value = t("cache-cleanup-success", "Cleanup complete!");
    }
  } catch (error) {
    cacheMessage.value = t("cache-cleanup-failure", "Failed to clean cache: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    cacheBusy.value = false;
  }
}

async function clearCache() {
  cacheBusy.value = true;
  cacheMessage.value = t("cache-clear-progress", "Clearing cache...");
  try {
    await store.clearCache();
    cacheMessage.value = t("cache-clear-success", "Cache cleared!");
  } catch (error) {
    cacheMessage.value = t("cache-clear-failure", "Failed to clear cache: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    cacheBusy.value = false;
  }
}

async function openCacheFolder() {
  cacheBusy.value = true;
  try {
    await store.openCacheFolder();
  } finally {
    cacheBusy.value = false;
  }
}

const rules = computed(() => store.settings?.rules ?? []);
const ruleForm = reactive<{
  id: string | null;
  name: string;
  pattern: string;
  matchType: UrlMatchType;
  profileId: string;
  isEnabled: boolean;
}>({
  id: null,
  name: "",
  pattern: "",
  matchType: "contains",
  profileId: "",
  isEnabled: true
});

function resetRuleForm() {
  ruleForm.id = null;
  ruleForm.name = "";
  ruleForm.pattern = "";
  ruleForm.matchType = "contains";
  ruleForm.isEnabled = true;
  ruleForm.profileId = defaultProfileId.value ?? profiles.value[0]?.id ?? "";
}

function editRule(rule: ProfileRule) {
  ruleForm.id = rule.id;
  ruleForm.name = rule.name;
  ruleForm.pattern = rule.pattern;
  ruleForm.matchType = rule.matchType;
  ruleForm.profileId = rule.profileId;
  ruleForm.isEnabled = rule.isEnabled;
}

function toggleRule(ruleId: string, enabled: boolean) {
  store.updateRule(ruleId, { isEnabled: enabled });
}

function moveRule(ruleId: string, direction: "up" | "down") {
  store.moveRule(ruleId, direction);
}

function deleteRule(ruleId: string) {
  store.deleteRule(ruleId);
  if (ruleForm.id === ruleId) {
    resetRuleForm();
  }
}

function profileNameById(profileId: string) {
  return profiles.value.find((profile) => profile.id === profileId)?.name ?? profileId;
}

function matchTypeLabel(matchType: UrlMatchType) {
  switch (matchType) {
    case "exact":
      return t("rule-match-exact", "Exact Match");
    case "regex":
      return t("rule-match-regex", "Regex");
    default:
      return t("rule-match-contains", "Contains");
  }
}

function saveRule() {
  const name = ruleForm.name.trim() || t("rule-form-title", "Add Rule");
  const pattern = ruleForm.pattern.trim();
  const profileId = ruleForm.profileId || defaultProfileId.value || profiles.value[0]?.id || "";
  if (!pattern || !profileId) {
    return;
  }
  const payload = {
    name,
    pattern,
    matchType: ruleForm.matchType,
    profileId,
    isEnabled: ruleForm.isEnabled
  };
  if (ruleForm.id) {
    store.updateRule(ruleForm.id, payload);
  } else {
    store.addRule(payload);
  }
  resetRuleForm();
}

watch(defaultProfileId, () => {
  if (!ruleForm.profileId && defaultProfileId.value) {
    ruleForm.profileId = defaultProfileId.value;
  }
});

watch(
  profiles,
  () => {
    if (ruleForm.profileId && !profiles.value.find((profile) => profile.id === ruleForm.profileId)) {
      ruleForm.profileId = defaultProfileId.value ?? profiles.value[0]?.id ?? "";
    }
  }
);

onMounted(() => {
  resetRuleForm();
  store.refreshCacheStats();
});
</script>
