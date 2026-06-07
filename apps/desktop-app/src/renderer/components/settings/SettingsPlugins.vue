<template>
  <UiSection :title="t('plugin-section-title')">
    <form class="plugin-install" @submit.prevent="installFromInput">
      <UiInput
        v-model="installUrl"
        name="plugin-install-url"
        :placeholder="t('plugin-install-placeholder')"
        aria-label="Plugin install link"
      />
      <UiButton
        type="submit"
        variant="primary"
        data-testid="plugin-install-submit"
        :disabled="!installUrl.trim() || busy"
      >
        {{ t("plugin-install") }}
      </UiButton>
    </form>
    <p v-if="actionError" class="ui-field__error">{{ actionError }}</p>

    <div class="plugin-group">
      <h3 class="plugin-group__title">{{ t("plugin-recommended-title") }}</h3>
      <div class="ui-list plugin-list">
        <UiListItem v-for="plugin in recommendedPlugins" :key="plugin.pluginKey" as="article">
          <div class="ui-list-item__main">
            <div class="ui-list-item__title-row">
              <span class="ui-list-item__title">{{ plugin.displayName }}</span>
            </div>
            <p class="ui-list-item__description">{{ plugin.description }}</p>
            <p class="ui-list-item__meta">{{ plugin.author.name }}</p>
          </div>
          <UiButton
            variant="secondary"
            :data-testid="`recommended-plugin-install-${plugin.pluginKey}`"
            :disabled="busy"
            @click="installRecommended(plugin.sourceUrl)"
          >
            {{ t("plugin-install") }}
          </UiButton>
        </UiListItem>
      </div>
    </div>

    <div class="plugin-group">
      <h3 class="plugin-group__title">{{ t("plugin-installed-title") }}</h3>
      <div v-if="catalog.length" class="ui-list plugin-list">
        <UiListItem v-for="plugin in catalog" :key="plugin.pluginKey" as="article">
          <div class="ui-list-item__main">
            <div class="ui-list-item__title-row">
              <span class="ui-list-item__title">{{ plugin.displayName }}</span>
              <span class="ui-list-item__meta">v{{ plugin.version }}</span>
              <UiBadge :tone="statusTone(plugin.status)">{{ statusLabel(plugin.status) }}</UiBadge>
            </div>
            <p class="ui-list-item__description">{{ plugin.description }}</p>
            <p class="ui-list-item__meta">{{ plugin.author.name }}</p>
            <p v-if="plugin.permissions.length" class="ui-list-item__meta">
              {{ t("plugin-permissions-label") }} {{ plugin.permissions.join(", ") }}
            </p>
            <p v-if="plugin.error" class="ui-field__error">{{ plugin.error }}</p>
          </div>

          <div class="plugin-actions">
            <UiButton variant="secondary" :disabled="busy" @click="updateInstalled(plugin.pluginKey)">
              {{ t("plugin-update") }}
            </UiButton>
            <UiButton
              :variant="plugin.enabled ? 'secondary' : 'primary'"
              :disabled="busy"
              @click="toggleInstalled(plugin.pluginKey, plugin.enabled)"
            >
              {{ plugin.enabled ? t("plugin-disable") : t("plugin-enable") }}
            </UiButton>
            <UiButton variant="danger" :disabled="busy" @click="deleteInstalled(plugin.pluginKey)">
              {{ t("button-delete") }}
            </UiButton>
          </div>
        </UiListItem>
      </div>
      <UiEmptyState v-else :message="t('plugin-empty')" />
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { RECOMMENDED_PLUGIN_INSTALL_LINKS } from "../../../common/recommendedPlugins";
import type { PluginManifest } from "../../../main/plugins/pluginManifest";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiBadge, UiButton, UiEmptyState, UiInput, UiListItem, UiSection } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const installUrl = ref("");
const busy = ref(false);
const actionError = ref<string | null>(null);

const catalog = computed(() => store.pluginCatalog);
const installedPluginKeys = computed(() => new Set(catalog.value.map((plugin) => plugin.pluginKey)));
const recommendedPlugins = computed(() =>
  RECOMMENDED_PLUGIN_INSTALL_LINKS.filter((plugin) => !installedPluginKeys.value.has(plugin.pluginKey))
);

async function installFromInput() {
  const sourceUrl = installUrl.value.trim();
  if (!sourceUrl) {
    return;
  }
  await runPluginAction(async () => {
    const installed = await confirmAndInstall(sourceUrl);
    if (installed) {
      installUrl.value = "";
    }
  });
}

async function installRecommended(sourceUrl: string) {
  await runPluginAction(() => confirmAndInstall(sourceUrl));
}

async function updateInstalled(pluginKey: string) {
  await runPluginAction(() => store.updatePlugin(pluginKey));
}

async function toggleInstalled(pluginKey: string, enabled: boolean) {
  await runPluginAction(() => enabled ? store.disablePlugin(pluginKey) : store.enablePlugin(pluginKey));
}

async function deleteInstalled(pluginKey: string) {
  await runPluginAction(() => store.deletePlugin(pluginKey));
}

async function runPluginAction(action: () => Promise<unknown>) {
  busy.value = true;
  actionError.value = null;
  try {
    await action();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error);
  } finally {
    busy.value = false;
  }
}

async function confirmAndInstall(sourceUrl: string): Promise<boolean> {
  const preview = await store.previewPluginInstall(sourceUrl);
  if (!window.confirm(formatInstallConfirmation(preview))) {
    return false;
  }
  await store.installPlugin(sourceUrl, preview);
  return true;
}

function formatInstallConfirmation(plugin: PluginManifest): string {
  const pluginKey = `${plugin.author.id}/${plugin.id}`;
  return [
    `Install ${plugin.displayName} v${plugin.version}?`,
    `Publisher: ${plugin.author.name}`,
    `Plugin key: ${pluginKey}`,
    `Compatibility: ${plugin.appCompatibility.minVersion}${plugin.appCompatibility.maxVersion ? ` - ${plugin.appCompatibility.maxVersion}` : "+"}`,
    `Permissions: ${plugin.permissions.length ? plugin.permissions.join(", ") : "none"}`
  ].join("\n");
}

function statusLabel(status: string): string {
  switch (status) {
    case "disabled":
      return t("plugin-status-disabled");
    case "enabled":
      return t("plugin-status-enabled");
    case "updating":
      return t("plugin-status-updating");
    case "broken":
      return t("plugin-status-broken");
    default:
      return status;
  }
}

function statusTone(status: string): "success" | "neutral" | "danger" {
  if (status === "enabled") return "success";
  if (status === "broken") return "danger";
  return "neutral";
}
</script>

<style scoped>
.plugin-install,
.plugin-actions {
  display: flex;
  gap: 8px;
}

.plugin-install {
  align-items: center;
}

.plugin-install :deep(.ui-input) {
  min-width: 0;
  flex: 1;
}

.plugin-group {
  margin-top: 16px;
}

.plugin-group__title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
}

.plugin-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
