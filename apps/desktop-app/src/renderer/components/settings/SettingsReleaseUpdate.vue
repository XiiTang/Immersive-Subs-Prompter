<template>
  <section class="global-settings__group">
    <h3 class="global-settings__group-title">{{ t("global-updates") }}</h3>

    <UiSettingRow
      id="release-current-version"
      :label="t('release-current-version')"
      :hint="currentVersion"
      control-width="compact"
    >
      <UiButton data-testid="release-check" :disabled="checking" @click="check">
        <IconRefresh size="sm" :class="{ 'icon--spinning': checking }" />
        {{ checking ? t("release-checking") : t("release-check") }}
      </UiButton>
    </UiSettingRow>

    <UiSettingRow
      id="release-auto-check"
      :label="t('release-auto-check')"
      :hint="t('release-auto-check-hint')"
      control-width="compact"
    >
      <UiSwitch v-model="autoCheckUpdates" :label="autoCheckUpdates ? t('toggle-on') : t('toggle-off')" />
    </UiSettingRow>

    <UiSettingRow
      v-if="state?.status === 'available'"
      id="release-available"
      :label="t('release-update-available', { version: state.latestVersion })"
      :hint="localizedNotes"
      control-width="editor"
    >
      <div class="settings-stack">
        <UiButton data-testid="release-open-download" variant="primary" @click="openDownload">
          <IconExternalLink size="sm" />
          {{ t("release-open-download") }}
        </UiButton>
        <span v-if="releaseDate" class="ui-field__hint">{{ t("release-date") }} {{ releaseDate }}</span>
        <span v-if="state.error" class="ui-field__hint">{{ state.error.message }}</span>
        <span v-if="state.platformArtifact" class="ui-field__hint">
          {{ state.platformArtifact.fileName }} · SHA-256 {{ artifactHash }}
        </span>
      </div>
    </UiSettingRow>

    <UiSettingRow
      v-else-if="state?.status === 'unavailable'"
      id="release-unavailable"
      :label="t('release-up-to-date')"
      control-width="editor"
    >
      <UiStatus tone="success">{{ t("release-up-to-date") }}</UiStatus>
    </UiSettingRow>

    <UiSettingRow
      v-else-if="state?.status === 'error'"
      id="release-error"
      :label="t('release-check-failed')"
      :hint="state.error?.message"
      control-width="editor"
    >
      <UiStatus tone="danger">{{ t("release-check-failed") }}</UiStatus>
    </UiSettingRow>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, normalizeLanguage, useI18n } from "../../i18n";
import { IconExternalLink, IconRefresh } from "../icons";
import { UiButton, UiSettingRow, UiStatus, UiSwitch } from "../ui";

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
