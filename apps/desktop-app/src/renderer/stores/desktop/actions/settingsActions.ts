import type { AppSettings, GlobalSettings, NetworkSettings } from "../../../../main/types";
import { reportError } from "../../../utils/errorBus";
import { mergePartial, toPlain } from "../helpers";
import type { DesktopStoreThis } from "../types";

export type SettingsPersistenceMode = "immediate" | "deferred";

export interface UpdateSettingsOptions {
  persist?: SettingsPersistenceMode;
  debounceMs?: number;
}

const DEFAULT_DEFERRED_SETTINGS_PERSIST_MS = 150;

type DeferredSettingsPersistence = {
  payload: Partial<AppSettings> | null;
  rollback: AppSettings | null;
  timer: ReturnType<typeof setTimeout> | null;
};

const deferredPersistenceByStore = new WeakMap<DesktopStoreThis, DeferredSettingsPersistence>();
const settingsRevisionByStore = new WeakMap<DesktopStoreThis, number>();

function getDeferredPersistence(store: DesktopStoreThis): DeferredSettingsPersistence {
  let deferred = deferredPersistenceByStore.get(store);
  if (!deferred) {
    deferred = {
      payload: null,
      rollback: null,
      timer: null
    };
    deferredPersistenceByStore.set(store, deferred);
  }
  return deferred;
}

function clearDeferredTimer(deferred: DeferredSettingsPersistence) {
  if (deferred.timer) {
    clearTimeout(deferred.timer);
    deferred.timer = null;
  }
}

function resetDeferredPersistence(deferred: DeferredSettingsPersistence) {
  clearDeferredTimer(deferred);
  deferred.payload = null;
  deferred.rollback = null;
}

function mergeSettingsPayload(
  current: Partial<AppSettings> | null,
  patch: Partial<AppSettings>
): Partial<AppSettings> {
  return mergePartial(current ?? {}, patch);
}

function bumpSettingsRevision(store: DesktopStoreThis) {
  settingsRevisionByStore.set(store, (settingsRevisionByStore.get(store) ?? 0) + 1);
}

function getSettingsRevision(store: DesktopStoreThis) {
  return settingsRevisionByStore.get(store) ?? 0;
}

async function persistSettingsPayload(
  store: DesktopStoreThis,
  payload: Partial<AppSettings>,
  rollback: AppSettings | null,
  revisionAtDispatch: number
) {
  try {
    const next = await window.usp.updateSettings(payload);
    if (getSettingsRevision(store) === revisionAtDispatch) {
      store.settings = next;
    }
  } catch (error) {
    if (rollback && getSettingsRevision(store) === revisionAtDispatch) {
      store.settings = rollback;
    }
    reportError(error, "settings.update");
  }
}

export function applySettingsPatch(this: DesktopStoreThis, partial: Partial<AppSettings>) {
  if (!this.settings) {
    return;
  }
  this.settings = mergePartial(this.settings, partial);
  bumpSettingsRevision(this);
}

export async function flushDeferredSettingsPersistence(this: DesktopStoreThis) {
  if (!this.settings) {
    return;
  }
  const deferred = getDeferredPersistence(this);
  const payload = deferred.payload;
  if (!payload) {
    clearDeferredTimer(deferred);
    return;
  }
  const rollback = deferred.rollback;
  resetDeferredPersistence(deferred);
  await persistSettingsPayload(this, payload, rollback, getSettingsRevision(this));
}

function scheduleDeferredSettingsPersistence(store: DesktopStoreThis, debounceMs: number) {
  const deferred = getDeferredPersistence(store);
  clearDeferredTimer(deferred);
  deferred.timer = setTimeout(() => {
    void flushDeferredSettingsPersistence.call(store);
  }, debounceMs);
}

export async function updateSettings(
  this: DesktopStoreThis,
  partial: Partial<AppSettings>,
  options: UpdateSettingsOptions = {}
) {
  if (!this.settings) {
    return;
  }
  const payload = toPlain(partial);
  const deferred = getDeferredPersistence(this);

  if (options.persist === "deferred") {
    if (!deferred.rollback) {
      deferred.rollback = toPlain(this.settings);
    }
    this.applySettingsPatch(payload);
    deferred.payload = mergeSettingsPayload(deferred.payload, payload);
    scheduleDeferredSettingsPersistence(
      this,
      options.debounceMs ?? DEFAULT_DEFERRED_SETTINGS_PERSIST_MS
    );
    return;
  }

  const rollback = deferred.rollback ?? toPlain(this.settings);
  const queuedPayload = deferred.payload;
  resetDeferredPersistence(deferred);
  const mergedPayload = queuedPayload ? mergeSettingsPayload(queuedPayload, payload) : payload;
  this.applySettingsPatch(payload);
  await persistSettingsPayload(this, mergedPayload, rollback, getSettingsRevision(this));
}

export function updateGlobalSetting<Key extends keyof GlobalSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: GlobalSettings[Key]
) {
  if (!this.settings) {
    return;
  }
  const nextGlobal = { ...this.settings.global, [key]: value } as GlobalSettings;
  this.updateSettings({ global: nextGlobal });
}

export function updateNetworkSetting<Key extends keyof NetworkSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: NetworkSettings[Key]
) {
  if (!this.settings) {
    return;
  }
  const nextNetwork = { ...this.settings.network, [key]: value } as NetworkSettings;
  this.updateSettings({ network: nextNetwork });
}

export const settingsActions = {
  applySettingsPatch,
  flushDeferredSettingsPersistence,
  updateSettings,
  updateGlobalSetting,
  updateNetworkSetting
};
