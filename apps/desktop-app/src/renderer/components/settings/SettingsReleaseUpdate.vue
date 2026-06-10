<template>
  <section class="global-settings__group">
    <h3 class="global-settings__group-title">{{ t("global-updates") }}</h3>

    <div class="global-settings__row">
      <div class="global-settings__row-meta">
        <span class="ui-field__label">{{ t("release-current-version") }}</span>
        <span class="ui-field__hint">{{ currentVersion }}</span>
      </div>
      <div class="global-settings__control global-settings__control--compact">
        <UiButton data-testid="release-check" :disabled="checking" @click="check">
          <IconRefresh size="sm" :class="{ 'icon--spinning': checking }" />
          {{ checking ? t("release-checking") : t("release-check") }}
        </UiButton>
      </div>
    </div>

    <div class="global-settings__row">
      <div class="global-settings__row-meta">
        <span class="ui-field__label">{{ t("release-auto-check") }}</span>
        <span class="ui-field__hint">{{ t("release-auto-check-hint") }}</span>
      </div>
      <div class="global-settings__control global-settings__control--compact">
        <UiSwitch v-model="autoCheckUpdates" :label="autoCheckUpdates ? t('toggle-on') : t('toggle-off')" />
      </div>
    </div>

    <div v-if="state?.status === 'available'" class="global-settings__row global-settings__row--editor">
      <div class="global-settings__row-meta">
        <UiStatus tone="success">{{ t("release-update-available", { version: state.latestVersion }) }}</UiStatus>
        <span class="ui-field__hint">{{ localizedNotes }}</span>
        <span v-if="releaseDate" class="ui-field__hint">{{ t("release-date") }} {{ releaseDate }}</span>
        <span v-if="state.error" class="ui-field__hint">{{ state.error.message }}</span>
      </div>
      <div class="global-settings__control global-settings__control--editor">
        <UiButton data-testid="release-open-download" variant="primary" @click="openDownload">
          <IconExternalLink size="sm" />
          {{ t("release-open-download") }}
        </UiButton>
        <span v-if="state.platformArtifact" class="ui-field__hint">
          {{ state.platformArtifact.fileName }} · SHA-256 {{ artifactHash }}
        </span>
      </div>
    </div>

    <div v-else-if="state?.status === 'unavailable'" class="global-settings__row">
      <div class="global-settings__row-meta">
        <UiStatus tone="success">{{ t("release-up-to-date") }}</UiStatus>
      </div>
    </div>

    <div v-else-if="state?.status === 'error'" class="global-settings__row">
      <div class="global-settings__row-meta">
        <UiStatus tone="danger">{{ t("release-check-failed") }}</UiStatus>
        <span class="ui-field__hint">{{ state.error?.message }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, normalizeLanguage, useI18n } from "../../i18n";
import { IconExternalLink, IconRefresh } from "../icons";
import { UiButton, UiStatus, UiSwitch } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const state = computed(() => store.releaseState);
const checking = computed(() => state.value?.status === "checking");
const currentVersion = computed(() => state.value?.currentVersion ?? "-");
const autoCheckUpdates = computed({
  get: () => store.settings?.global.autoCheckUpdates ?? true,
  set: (value: boolean) => store.updateGlobalSetting("autoCheckUpdates", value)
});
const localizedNotes = computed(() => {
  const notes = state.value?.manifest?.notes;
  if (!notes) {
    return "";
  }
  return normalizeLanguage(language.value) === "zh" ? notes.zh : notes.en;
});
const releaseDate = computed(() => state.value?.manifest?.releasedAt.slice(0, 10) ?? "");
const artifactHash = computed(() => state.value?.platformArtifact?.sha256 ?? "");

function check() {
  void store.checkForUpdates();
}

function openDownload() {
  void store.openReleaseDownload();
}
</script>
