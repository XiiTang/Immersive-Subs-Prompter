<template>
  <section class="global-settings__group">
    <h3 class="global-settings__group-title">{{ t("global-updates") }}</h3>

    <UiSettingRow
      id="release-current-version"
      :label="t('release-current-version')"
      :hint="currentVersion"
      control-width="compact"
    >
      <UiButton data-testid="release-check" :disabled="busy" @click="check">
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
      :hint="releaseNotes"
      control-width="editor"
    >
      <div class="ui-group">
        <UiButton data-testid="release-download" variant="primary" @click="download">
          <IconDownload size="sm" />
          {{ t("release-download-update") }}
        </UiButton>
        <span v-if="releaseDate" class="ui-field__hint">{{ t("release-date") }} {{ releaseDate }}</span>
      </div>
    </UiSettingRow>

    <UiSettingRow
      v-else-if="state?.status === 'downloading'"
      id="release-downloading"
      :label="t('release-downloading')"
      :hint="downloadHint"
      control-width="editor"
    >
      <div class="ui-group">
        <UiProgress :value="downloadPercent" :label="t('release-downloading')" />
        <span class="ui-field__hint">{{ downloadPercent }}%</span>
      </div>
    </UiSettingRow>

    <UiSettingRow
      v-else-if="state?.status === 'downloaded'"
      id="release-downloaded"
      :label="t('release-ready-to-install')"
      :hint="releaseNotes"
      control-width="editor"
    >
      <div class="ui-group">
        <UiButton data-testid="release-install" variant="primary" @click="install">
          {{ t("release-install-restart") }}
        </UiButton>
        <span v-if="releaseDate" class="ui-field__hint">{{ t("release-date") }} {{ releaseDate }}</span>
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
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { IconDownload, IconRefresh } from "../icons";
import { UiButton, UiProgress, UiSettingRow, UiStatus, UiSwitch } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const state = computed(() => store.releaseState);
const checking = computed(() => state.value?.status === "checking");
const busy = computed(() => state.value?.status === "checking" || state.value?.status === "downloading");
const currentVersion = computed(() => state.value?.currentVersion ?? "-");
const autoCheckUpdates = computed({
  get: () => store.settings?.global.autoCheckUpdates ?? true,
  set: (value: boolean) => store.updateGlobalSetting("autoCheckUpdates", value)
});
const releaseNotes = computed(() => state.value?.updateInfo?.releaseNotes ?? "");
const releaseDate = computed(() => state.value?.updateInfo?.releaseDate?.slice(0, 10) ?? "");
const downloadPercent = computed(() => Math.round(state.value?.progress?.percent ?? 0));
const downloadHint = computed(() => {
  const progress = state.value?.progress;
  if (!progress) {
    return "";
  }
  return `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`;
});

function check() {
  void store.checkForUpdates();
}

function download() {
  void store.downloadReleaseUpdate();
}

function install() {
  void store.installReleaseUpdate();
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${Math.round(value / 1024 / 1024)} MB`;
}
</script>
