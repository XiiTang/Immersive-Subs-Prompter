# Unified Pill List Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current branch. Do not use subagents. Do not use worktrees. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the same read-only pill list, hover close button, and trailing blank pill interaction to network endpoints, process blacklist entries, and subtitle priority entries, with subtitle priorities supporting drag sorting only.

**Architecture:** Add a small shared renderer component for generic pill-list UI and events. Keep domain logic in the existing parent components: network endpoint parsing stays in `NetworkEndpointEditor`, process normalization stays in store actions, and subtitle regex validation stays in `SettingsProfiles`/`PriorityEditor`. Remove the old subtitle drag-delete composable and let the shared component emit reorder events without any delete-on-drag behavior.

**Tech Stack:** Vue 3 `<script setup>`, Pinia store actions, local UI primitives (`UiInput`, `UiIconButton`), local lucide-backed `IconClose`, Vitest jsdom/browser tests.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-23-unified-pill-list-editors-design.md`
- Current endpoint editor: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`
- Current process blacklist UI: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Current subtitle priority UI: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Old subtitle drag-delete logic: `apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.ts`

## Execution Constraints

- Do not use subagents.
- Do not use worktrees.
- Do not add compatibility, migration, fallback, legacy UI, or transition paths.
- Do not preserve old process blacklist input/add-button UI.
- Do not preserve subtitle drag-delete behavior.
- Do not add in-place editing for saved pills.
- Keep shared component generic; domain parsing and validation remain in parent components.

## Final File Structure

Shared pill UI:

- Create: `apps/desktop-app/src/renderer/components/settings/PillListEditor.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/PillListEditor.test.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/PillListEditor.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

Network endpoints:

- Modify: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`

Process blacklist:

- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`

Subtitle priority:

- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Delete: `apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.ts`
- Delete: `apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`

Verification and docs:

- Modify only if needed: `docs/superpowers/specs/2026-05-23-unified-pill-list-editors-design.md`

---

### Task 1: Add Shared PillListEditor

**Files:**
- Create: `apps/desktop-app/src/renderer/components/settings/PillListEditor.vue`
- Create: `apps/desktop-app/src/renderer/components/settings/PillListEditor.test.ts`
- Create: `apps/desktop-app/src/renderer/components/settings/PillListEditor.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Write failing component behavior tests**

Create `apps/desktop-app/src/renderer/components/settings/PillListEditor.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import PillListEditor from "./PillListEditor.vue";

function mountEditor() {
  return mount(PillListEditor, {
    props: {
      label: "Items",
      hint: "Add items",
      items: [
        { id: "one", label: "one.exe" },
        { id: "two", label: "two.exe" }
      ],
      draftValue: "",
      placeholder: "item.exe",
      removeLabel: "Remove item",
      draftTestId: "pill-draft-input",
      displayTestIdPrefix: "pill-display",
      removeTestIdPrefix: "pill-remove"
    }
  });
}

describe("PillListEditor", () => {
  it("renders read-only saved pills and a trailing draft input", () => {
    const wrapper = mountEditor();

    expect(wrapper.text()).toContain("one.exe");
    expect(wrapper.text()).toContain("two.exe");
    expect(wrapper.find('[data-testid="pill-display-one"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pill-draft-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="pill-edit-one"]').exists()).toBe(false);
  });

  it("emits draft updates and add-draft on enter and blur", async () => {
    const wrapper = mountEditor();
    const input = wrapper.get<HTMLInputElement>('[data-testid="pill-draft-input"]');

    await input.setValue("three.exe");
    await input.trigger("keyup.enter");
    await input.trigger("blur");

    expect(wrapper.emitted("update:draftValue")).toEqual([["three.exe"]]);
    expect(wrapper.emitted("add-draft")).toHaveLength(2);
  });

  it("emits remove from the close button", async () => {
    const wrapper = mountEditor();

    await wrapper.get('[data-testid="pill-remove-one"]').trigger("click");

    expect(wrapper.emitted("remove")).toEqual([["one"]]);
  });

  it("emits reorder for same-list drag sorting", async () => {
    const wrapper = mount(PillListEditor, {
      props: {
        label: "Items",
        items: [
          { id: "one", label: "one" },
          { id: "two", label: "two" },
          { id: "three", label: "three" }
        ],
        draftValue: "",
        placeholder: "item",
        removeLabel: "Remove item",
        draftTestId: "pill-draft-input",
        displayTestIdPrefix: "pill-display",
        removeTestIdPrefix: "pill-remove",
        sortable: true
      }
    });
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="pill-display-three"]').trigger("dragenter");
    await wrapper.get('[data-testid="pill-display-three"]').trigger("drop");
    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragend");

    expect(wrapper.emitted("reorder")).toEqual([[0, 2]]);
    expect(wrapper.emitted("remove")).toBeUndefined();
  });

  it("ignores drag end and invalid drops without removing items", async () => {
    const wrapper = mount(PillListEditor, {
      props: {
        label: "Items",
        items: [
          { id: "one", label: "one" },
          { id: "two", label: "two" }
        ],
        draftValue: "",
        placeholder: "item",
        removeLabel: "Remove item",
        draftTestId: "pill-draft-input",
        displayTestIdPrefix: "pill-display",
        removeTestIdPrefix: "pill-remove",
        sortable: true
      }
    });
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="pill-display-one"]').trigger("dragend");

    expect(wrapper.emitted("reorder")).toBeUndefined();
    expect(wrapper.emitted("remove")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write failing browser layout tests**

Create `apps/desktop-app/src/renderer/components/settings/PillListEditor.browser.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { userEvent } from "vitest/browser";
import { beforeEach, describe, expect, it } from "vitest";
import PillListEditor from "./PillListEditor.vue";
import "../../style.css";

function mountEditor() {
  return mount(PillListEditor, {
    attachTo: document.body,
    props: {
      label: "Items",
      hint: "Add items",
      items: [
        { id: "one", label: "one.exe" },
        { id: "two", label: "two.exe" }
      ],
      draftValue: "",
      placeholder: "item.exe",
      removeLabel: "Remove item",
      draftTestId: "pill-draft-input",
      displayTestIdPrefix: "pill-display",
      removeTestIdPrefix: "pill-remove"
    }
  });
}

describe("PillListEditor browser layout", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("uses compact borderless draft input and close button geometry", async () => {
    const wrapper = mountEditor();
    const savedPill = wrapper.get('[data-testid="pill-display-one"]').element.closest(".pill-list-editor__item") as HTMLElement;
    const draftPill = wrapper.get(".pill-list-editor__draft").element as HTMLElement;
    const draftInput = wrapper.get('[data-testid="pill-draft-input"]').element as HTMLElement;
    const remove = wrapper.get('[data-testid="pill-remove-one"]').element as HTMLElement;

    await userEvent.hover(savedPill);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const pillRect = savedPill.getBoundingClientRect();
    const removeRect = remove.getBoundingClientRect();
    const removeCenterX = removeRect.left + removeRect.width / 2;
    const removeCenterY = removeRect.top + removeRect.height / 2;
    const pillRadius = pillRect.height / 2;
    const cornerCenterX = pillRect.right - pillRadius;
    const cornerCenterY = pillRect.top + pillRadius;
    const distanceToCornerCenter = Math.hypot(removeCenterX - cornerCenterX, removeCenterY - cornerCenterY);
    const inputStyle = getComputedStyle(draftInput);

    expect(Math.round(draftPill.getBoundingClientRect().width)).toBe(110);
    expect(Math.round(draftPill.getBoundingClientRect().height)).toBe(Math.round(pillRect.height));
    expect(inputStyle.borderTopWidth).toBe("0px");
    expect(inputStyle.borderRightWidth).toBe("0px");
    expect(inputStyle.borderBottomWidth).toBe("0px");
    expect(inputStyle.borderLeftWidth).toBe("0px");
    expect(getComputedStyle(remove).opacity).toBe("1");
    expect(Math.round(removeRect.width)).toBe(12);
    expect(Math.round(removeRect.height)).toBe(12);
    expect(remove.querySelector("svg")).not.toBeNull();
    expect(removeCenterX).toBeLessThan(pillRect.right);
    expect(removeCenterY).toBeGreaterThan(pillRect.top);
    expect(Math.abs(distanceToCornerCenter - pillRadius)).toBeLessThanOrEqual(1.5);
  });
});
```

- [ ] **Step 3: Run shared component tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/PillListEditor.test.ts src/renderer/components/settings/PillListEditor.browser.test.ts
```

Expected: FAIL because `PillListEditor.vue` does not exist.

- [ ] **Step 4: Implement `PillListEditor.vue`**

Create `apps/desktop-app/src/renderer/components/settings/PillListEditor.vue`:

```vue
<template>
  <div class="pill-list-editor">
    <div class="priority-editor__header">
      <div class="priority-editor__label-row">
        <span class="settings-field__label">{{ label }}</span>
      </div>
      <span v-if="hint || $slots.hint" class="priority-editor__hint">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </div>

    <div class="priority-editor__list pill-list-editor__list" @dragover.prevent @drop.prevent="onListDrop">
      <span
        v-for="(item, index) in items"
        :key="item.id"
        class="ui-chip priority-editor__item pill-list-editor__item"
        :class="{
          'pill-list-editor__item--error': item.error,
          'pill-list-editor__item--removable': item.removable !== false,
          'priority-editor__item--dragover': isDragOver(index)
        }"
      >
        <span
          class="pill-list-editor__display"
          :data-testid="`${displayTestIdPrefix}-${item.id}`"
          :title="item.title ?? item.label"
          :draggable="sortable"
          @dragstart="onDragStart(index, $event)"
          @dragenter.prevent="onDragEnter(index)"
          @dragover.prevent
          @drop.prevent.stop="onDrop(index)"
          @dragleave="onDragLeave(index)"
          @dragend="onDragEnd"
        >
          {{ item.label }}
        </span>

        <UiIconButton
          v-if="item.removable !== false"
          class="pill-list-editor__remove"
          size="sm"
          variant="ghost"
          :label="removeLabel"
          :data-testid="`${removeTestIdPrefix}-${item.id}`"
          @click.stop="$emit('remove', item.id)"
        >
          <IconClose size="sm" />
        </UiIconButton>
      </span>

      <span class="priority-editor__item priority-editor__draft pill-list-editor__draft">
        <UiInput
          class="priority-editor__draft-input pill-list-editor__input"
          :data-testid="draftTestId"
          :model-value="draftValue"
          :placeholder="placeholder"
          @update:model-value="$emit('update:draftValue', String($event))"
          @blur="$emit('add-draft')"
          @keyup.enter="$emit('add-draft')"
        />
      </span>
    </div>

    <div v-if="error" class="settings-field__error">{{ error }}</div>
    <slot name="after-errors" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { IconClose } from "../icons";
import { UiIconButton, UiInput } from "../ui";

export interface PillListEditorItem {
  id: string;
  label: string;
  title?: string;
  removable?: boolean;
  error?: boolean;
}

const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    items: PillListEditorItem[];
    draftValue: string;
    placeholder: string;
    removeLabel: string;
    error?: string | null;
    sortable?: boolean;
    draftTestId: string;
    displayTestIdPrefix: string;
    removeTestIdPrefix: string;
  }>(),
  {
    hint: "",
    error: null,
    sortable: false
  }
);

const emit = defineEmits<{
  (event: "update:draftValue", value: string): void;
  (event: "add-draft"): void;
  (event: "remove", id: string): void;
  (event: "reorder", fromIndex: number, toIndex: number): void;
}>();

const dragState = ref<{ fromIndex: number | null; overIndex: number | null }>({
  fromIndex: null,
  overIndex: null
});

function resetDragState() {
  dragState.value = { fromIndex: null, overIndex: null };
}

function onDragStart(index: number, event: DragEvent) {
  if (!props.sortable) return;
  dragState.value = { fromIndex: index, overIndex: index };
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDragEnter(index: number) {
  if (!props.sortable || dragState.value.fromIndex === null) return;
  dragState.value.overIndex = index;
}

function onDragLeave(index: number) {
  if (dragState.value.overIndex === index) {
    dragState.value.overIndex = null;
  }
}

function onDrop(index: number) {
  const fromIndex = dragState.value.fromIndex;
  if (!props.sortable || fromIndex === null) {
    resetDragState();
    return;
  }
  if (fromIndex !== index) {
    emit("reorder", fromIndex, index);
  }
  resetDragState();
}

function onListDrop() {
  const fromIndex = dragState.value.fromIndex;
  const overIndex = dragState.value.overIndex;
  if (!props.sortable || fromIndex === null || overIndex === null) {
    resetDragState();
    return;
  }
  if (fromIndex !== overIndex) {
    emit("reorder", fromIndex, overIndex);
  }
  resetDragState();
}

function onDragEnd() {
  resetDragState();
}

function isDragOver(index: number) {
  return props.sortable && dragState.value.overIndex === index && dragState.value.fromIndex !== index;
}
</script>
```

- [ ] **Step 5: Add shared styles and remove duplicated network-only pill shell styles later**

Modify `apps/desktop-app/src/renderer/style.css` by adding the shared styles near the current `network-endpoint-editor` styles:

```css
.pill-list-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pill-list-editor__list {
  align-items: center;
}

.pill-list-editor__item {
  position: relative;
  max-width: 100%;
  cursor: default;
}

.pill-list-editor__item--removable {
  padding-right: 20px;
}

.pill-list-editor__item--error {
  border-color: var(--ui-danger);
}

.pill-list-editor__display {
  min-width: 0;
  max-width: min(100%, 520px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  font: inherit;
  cursor: text;
  user-select: text;
}

.pill-list-editor__display[draggable="true"] {
  cursor: grab;
}

.pill-list-editor__display[draggable="true"]:active {
  cursor: grabbing;
}

.pill-list-editor__remove.ui-icon-button {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  opacity: 0;
  pointer-events: none;
}

.pill-list-editor__remove .icon {
  width: 9px;
  height: 9px;
}

.pill-list-editor__item:hover .pill-list-editor__remove,
.pill-list-editor__item:focus-within .pill-list-editor__remove {
  opacity: 1;
  pointer-events: auto;
}

.pill-list-editor__draft {
  flex: 0 0 110px;
  width: 110px;
  min-width: 110px;
}

.pill-list-editor__input {
  min-width: 0;
}

.pill-list-editor__input.ui-input {
  min-height: 26px;
  border: 0;
  outline: 0;
}

.pill-list-editor__input.ui-input:focus-visible {
  outline: 0;
}
```

- [ ] **Step 6: Run shared component tests and verify they pass**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/PillListEditor.test.ts src/renderer/components/settings/PillListEditor.browser.test.ts
```

Expected: PASS.

---

### Task 2: Refactor NetworkEndpointEditor To Use Shared Pills

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/NetworkEndpointEditor.browser.test.ts`
- Modify: `apps/desktop-app/src/renderer/style.css`

- [ ] **Step 1: Update network editor to delegate pill UI**

Replace the template in `NetworkEndpointEditor.vue` with:

```vue
<template>
  <PillListEditor
    class="network-endpoint-editor"
    :label="label"
    :hint="hint"
    :items="endpointItems"
    :draft-value="draftValue"
    :placeholder="placeholder"
    :remove-label="removeLabel"
    :error="error"
    draft-test-id="network-endpoint-draft-input"
    display-test-id-prefix="network-endpoint-display"
    remove-test-id-prefix="network-endpoint-remove"
    @update:draft-value="draftValue = $event"
    @add-draft="commitDraft"
    @remove="removeEndpoint"
  >
    <template #after-errors>
      <div
        v-for="status in errorStatuses"
        :key="status.endpointId"
        class="settings-field__error"
      >
        {{ status.host }}:{{ status.port }} - {{ status.error }}
      </div>
    </template>
  </PillListEditor>
</template>
```

Update the script imports and computed item list:

```ts
import { computed, ref } from "vue";
import type { NetworkEndpoint, NetworkListenerStatus } from "../../../main/types";
import {
  buildNetworkEndpointUrl,
  networkEndpointKey,
  parseNetworkEndpointInput
} from "../../../common/networkEndpoints.js";
import PillListEditor, { type PillListEditorItem } from "./PillListEditor.vue";
```

Add:

```ts
const endpointItems = computed<PillListEditorItem[]>(() =>
  props.endpoints.map((endpoint) => ({
    id: endpoint.id,
    label: endpointUrl(endpoint),
    title: endpointUrl(endpoint),
    removable: props.endpoints.length > 1,
    error: statusById.value.get(endpoint.id)?.status === "error"
  }))
);
```

Keep the existing `commitDraft`, `removeEndpoint`, `parseEditableEndpoint`, and `createEndpointId` functions.

- [ ] **Step 2: Update network layout browser test to avoid duplicating shared layout assertions**

Modify `NetworkEndpointEditor.browser.test.ts` so it only asserts network-specific integration:

```ts
it("marks listener error endpoints on the shared pill item", () => {
  const wrapper = mount(NetworkEndpointEditor, {
    attachTo: document.body,
    props: {
      endpoints: [
        { id: "default", host: "127.0.0.1", port: 44501 },
        { id: "lan", host: "192.168.1.2", port: 44502 }
      ],
      authToken: "0123456789abcdef0123456789abcdef",
      listenerStatuses: [
        {
          endpointId: "lan",
          host: "192.168.1.2",
          port: 44502,
          status: "error",
          error: "listen EADDRNOTAVAIL"
        }
      ],
      label: "Listening Endpoints",
      hint: "Add explicit addresses.",
      placeholder: "127.0.0.1:44501",
      removeLabel: "Remove endpoint"
    }
  });

  const lanPill = wrapper.get('[data-testid="network-endpoint-display-lan"]').element.closest(".pill-list-editor__item");

  expect(lanPill?.classList.contains("pill-list-editor__item--error")).toBe(true);
  expect(wrapper.text()).toContain("192.168.1.2:44502 - listen EADDRNOTAVAIL");
});
```

- [ ] **Step 3: Remove duplicate network-only shell styles**

In `style.css`, remove network-specific styles that duplicate shared shell behavior:

```css
.network-endpoint-editor__list { ... }
.network-endpoint-editor__item { ... }
.network-endpoint-editor__item--removable { ... }
.network-endpoint-editor__item--error { ... }
.network-endpoint-editor__display { ... }
.network-endpoint-editor__remove.ui-icon-button { ... }
.network-endpoint-editor__remove .icon { ... }
.network-endpoint-editor__item:hover .network-endpoint-editor__remove,
.network-endpoint-editor__item:focus-within .network-endpoint-editor__remove { ... }
.network-endpoint-editor__draft { ... }
.network-endpoint-editor__input { ... }
.network-endpoint-editor__input.ui-input { ... }
.network-endpoint-editor__input.ui-input:focus-visible { ... }
```

Keep only `.network-endpoint-editor` if a network-specific hook remains necessary. If no network-specific styles remain, remove it too.

- [ ] **Step 4: Run endpoint tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/NetworkEndpointEditor.browser.test.ts src/renderer/components/settings/SettingsGlobal.test.ts
```

Expected: PASS.

---

### Task 3: Apply Shared Pills To Process Blacklist

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsGlobal.test.ts`

- [ ] **Step 1: Add failing process blacklist tests**

Add to `SettingsGlobal.test.ts`:

```ts
it("edits the process blacklist as read-only pills with a trailing draft", async () => {
  const store = useDesktopStore();
  store.settings = {
    ...createSettings(),
    global: {
      ...createSettings().global,
      gameProcessBlacklist: ["r5apex_dx12.exe"]
    }
  };
  const addSpy = vi.spyOn(store, "addGameProcess");
  const removeSpy = vi.spyOn(store, "removeGameProcess");

  const wrapper = mount(SettingsGlobal);

  expect(wrapper.text()).toContain("r5apex_dx12.exe");
  expect(wrapper.find('[data-testid="process-blacklist-draft-input"]').exists()).toBe(true);
  expect(wrapper.find('[aria-label="Add"]').exists()).toBe(false);
  expect(wrapper.text()).not.toContain("No processes yet.");

  const input = wrapper.get<HTMLInputElement>('[data-testid="process-blacklist-draft-input"]');
  await input.setValue("vlc.exe");
  await input.trigger("blur");

  expect(addSpy).toHaveBeenCalledWith("vlc.exe");

  await wrapper.get('[data-testid="process-blacklist-remove-r5apex_dx12.exe"]').trigger("click");

  expect(removeSpy).toHaveBeenCalledWith("r5apex_dx12.exe");
});
```

- [ ] **Step 2: Run SettingsGlobal test and verify it fails**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsGlobal.test.ts
```

Expected: FAIL because the process blacklist still renders a separate input and add button.

- [ ] **Step 3: Replace process blacklist markup**

In `SettingsGlobal.vue`, replace the `UiField id="process-blacklist"` block and the following chip/empty-state block with:

```vue
<PillListEditor
  :label="t('process-blacklist-label', 'Process Blacklist')"
  :hint="t('process-blacklist-hint', 'Disable shortcuts when these processes are foregrounded.')"
  :items="gameProcessItems"
  :draft-value="gameProcessInput"
  :placeholder="t('process-blacklist-placeholder', 'e.g.: r5apex_dx12.exe')"
  :remove-label="t('game-blacklist-remove', 'Remove')"
  draft-test-id="process-blacklist-draft-input"
  display-test-id-prefix="process-blacklist-display"
  remove-test-id-prefix="process-blacklist-remove"
  @update:draft-value="gameProcessInput = $event"
  @add-draft="addGameProcess"
  @remove="removeGameProcess"
/>
```

Update imports:

```ts
import { UiField, UiInput, UiSection, UiSelect, UiSwitch } from "../ui";
import PillListEditor, { type PillListEditorItem } from "./PillListEditor.vue";
```

Remove unused imports:

```ts
import { IconAdd, IconDelete } from "../icons";
import { UiEmptyState, UiIconButton } from "../ui";
```

Add computed items:

```ts
const gameProcessItems = computed<PillListEditorItem[]>(() =>
  gameProcesses.value.map((process) => ({
    id: process,
    label: process,
    title: process
  }))
);
```

Keep:

```ts
function addGameProcess() {
  store.addGameProcess(gameProcessInput.value);
  gameProcessInput.value = "";
}

function removeGameProcess(name: string) {
  store.removeGameProcess(name);
}
```

- [ ] **Step 4: Run SettingsGlobal tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsGlobal.test.ts
```

Expected: PASS.

---

### Task 4: Apply Shared Pills To Subtitle Priority And Remove Drag Delete

**Files:**
- Modify: `apps/desktop-app/src/renderer/components/settings/profiles/PriorityEditor.vue`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.vue`
- Delete: `apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.ts`
- Delete: `apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.test.ts`
- Modify: `apps/desktop-app/src/renderer/components/settings/SettingsProfiles.browser.test.ts`

- [ ] **Step 1: Add failing final drag-sort tests**

Add these tests to `SettingsProfiles.browser.test.ts`:

```ts
it("removes subtitle priorities only through the pill close button", async () => {
  const store = useDesktopStore();
  store.settings = {
    ...createSettings(),
    profiles: [
      {
        ...createProfile("profile-default", "Default"),
        settings: {
          ...createProfile("profile-default", "Default").settings,
          primarySubtitlePriority: ["en", "ja"],
          secondarySubtitlePriority: []
        }
      }
    ],
    defaultProfileId: "profile-default"
  };
  store.editingProfileId = "profile-default";
  const removeSpy = vi.spyOn(store, "removePriority");

  const wrapper = mount(SettingsProfiles, { attachTo: document.body });

  await wrapper.get('[data-testid="priority-primary-remove-en"]').trigger("click");

  expect(removeSpy).toHaveBeenCalledWith("primary", "en");
});

it("reorders subtitle priorities within the same list and does not delete on drag end", async () => {
  const store = useDesktopStore();
  store.settings = {
    ...createSettings(),
    profiles: [
      {
        ...createProfile("profile-default", "Default"),
        settings: {
          ...createProfile("profile-default", "Default").settings,
          primarySubtitlePriority: ["en", "ja", "zh"],
          secondarySubtitlePriority: ["fr"]
        }
      }
    ],
    defaultProfileId: "profile-default"
  };
  store.editingProfileId = "profile-default";
  const reorderSpy = vi.spyOn(store, "reorderPriority");
  const removeSpy = vi.spyOn(store, "removePriority");
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

  const wrapper = mount(SettingsProfiles, { attachTo: document.body });

  await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragstart", { dataTransfer });
  await wrapper.get('[data-testid="priority-primary-display-zh"]').trigger("dragenter");
  await wrapper.get('[data-testid="priority-primary-display-zh"]').trigger("drop");
  await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragend");

  expect(reorderSpy).toHaveBeenCalledWith("primary", 0, 2);
  expect(removeSpy).not.toHaveBeenCalled();
});

it("ignores subtitle priority drops outside the source list", async () => {
  const store = useDesktopStore();
  store.settings = {
    ...createSettings(),
    profiles: [
      {
        ...createProfile("profile-default", "Default"),
        settings: {
          ...createProfile("profile-default", "Default").settings,
          primarySubtitlePriority: ["en", "ja"],
          secondarySubtitlePriority: ["fr"]
        }
      }
    ],
    defaultProfileId: "profile-default"
  };
  store.editingProfileId = "profile-default";
  const reorderSpy = vi.spyOn(store, "reorderPriority");
  const removeSpy = vi.spyOn(store, "removePriority");
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" };

  const wrapper = mount(SettingsProfiles, { attachTo: document.body });

  await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragstart", { dataTransfer });
  await wrapper.get('[data-testid="priority-primary-display-en"]').trigger("dragend");

  expect(reorderSpy).not.toHaveBeenCalled();
  expect(removeSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run priority tests and verify they fail**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsProfiles.browser.test.ts
```

Expected: FAIL because `PriorityEditor` does not yet emit remove/reorder from the shared component.

- [ ] **Step 3: Refactor `PriorityEditor.vue`**

Replace the template with:

```vue
<template>
  <PillListEditor
    class="priority-editor"
    :label="label"
    :items="pillItems"
    :draft-value="modelValue"
    :placeholder="placeholder"
    :remove-label="removeLabel"
    :error="error"
    :sortable="true"
    draft-test-id="priority-draft-input"
    :display-test-id-prefix="`priority-${role}-display`"
    :remove-test-id-prefix="`priority-${role}-remove`"
    @update:draft-value="onInputValue"
    @add-draft="$emit('add')"
    @remove="onRemove"
    @reorder="(fromIndex, toIndex) => $emit('reorder', fromIndex, toIndex)"
  >
    <template #hint>
      <template v-if="hintLinkParts">
        {{ hintLinkParts.before }}<a
          class="priority-editor__hint-link"
          :href="docUrl ?? undefined"
          @click.prevent="onDocLinkClick"
        >{{ hintLinkParts.linked }}</a>{{ hintLinkParts.after }}
      </template>
      <template v-else>{{ hint }}</template>
    </template>
  </PillListEditor>
</template>
```

Replace the script with:

```ts
<script setup lang="ts">
import { computed } from "vue";
import PillListEditor, { type PillListEditorItem } from "../PillListEditor.vue";

type PriorityRole = "primary" | "secondary";

interface Props {
  role: PriorityRole;
  items: readonly string[];
  modelValue: string;
  label: string;
  hint: string;
  placeholder: string;
  error: string | null;
  docUrl?: string | null;
  removeLabel: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "add"): void;
  (e: "remove", value: string): void;
  (e: "reorder", fromIndex: number, toIndex: number): void;
  (e: "doc-link-click"): void;
}>();

const pillItems = computed<PillListEditorItem[]>(() =>
  props.items.map((item) => ({
    id: item,
    label: item,
    title: item
  }))
);

const hintLinkParts = computed(() => {
  if (!props.docUrl) {
    return null;
  }
  const linkTerms = ["正则表达式", "regular expressions"];
  for (const linked of linkTerms) {
    const start = props.hint.indexOf(linked);
    if (start >= 0) {
      return {
        before: props.hint.slice(0, start),
        linked,
        after: props.hint.slice(start + linked.length)
      };
    }
  }
  return null;
});

function onInputValue(value: string) {
  emit("update:modelValue", value);
}

function onRemove(value: string) {
  emit("remove", value);
}

function onDocLinkClick() {
  emit("doc-link-click");
}
</script>
```

- [ ] **Step 4: Refactor `SettingsProfiles.vue` wiring**

Remove the `usePriorityDragDrop` import and destructuring.

Update both `PriorityEditor` usages:

```vue
:remove-label="t('priority-remove', 'Remove priority')"
@remove="(value) => store.removePriority('primary', value)"
@reorder="(fromIndex, toIndex) => store.reorderPriority('primary', fromIndex, toIndex)"
```

and:

```vue
:remove-label="t('priority-remove', 'Remove priority')"
@remove="(value) => store.removePriority('secondary', value)"
@reorder="(fromIndex, toIndex) => store.reorderPriority('secondary', fromIndex, toIndex)"
```

Remove these props from both `PriorityEditor` usages:

```vue
:is-drag-over="isPriorityDragOver"
:on-drag-start="onPriorityDragStart"
:on-drag-enter="onPriorityDragEnter"
:on-drag-leave="onPriorityDragLeave"
:on-drop="onPriorityDrop"
:on-drag-end="onPriorityDragEnd"
:on-list-drop="onPriorityListDrop"
```

Update `addPriority` to block invalid regex adds:

```ts
function addPriority(role: PriorityRole) {
  const input = role === "primary" ? primaryPriorityInput : secondaryPriorityInput;
  if (getPriorityRegexError(input.value)) {
    return;
  }
  store.addPriority(role, input.value);
  input.value = "";
}
```

Keep:

```ts
type PriorityRole = "primary" | "secondary";
```

Delete:

```ts
function removePriorityAtIndex(role: PriorityRole, index: number) { ... }
```

- [ ] **Step 5: Delete old drag-delete composable**

Delete:

```text
apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.ts
apps/desktop-app/src/renderer/components/settings/profiles/composables/usePriorityDragDrop.test.ts
```

Confirm no references remain:

```bash
rg -n "usePriorityDragDrop|onPriorityDrag|isPriorityDragOver|removePriorityAtIndex" apps/desktop-app/src/renderer
```

Expected: no results.

- [ ] **Step 6: Run priority tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/SettingsProfiles.browser.test.ts
```

Expected: PASS.

---

### Task 5: Cleanup, Documentation, And Verification

**Files:**
- Modify if needed: `docs/superpowers/specs/2026-05-23-unified-pill-list-editors-design.md`
- Modify if needed: `docs/superpowers/plans/2026-05-23-unified-pill-list-editors.md`

- [ ] **Step 1: Remove obsolete CSS selectors**

Search:

```bash
rg -n "network-endpoint-editor__|ui-chip__remove|priority-editor__controls" apps/desktop-app/src/renderer
```

Expected after cleanup:

- No `network-endpoint-editor__*` selectors unless a network-only hook is still used.
- `ui-chip__remove` may remain only for unrelated non-converted UI.
- No `priority-editor__controls`.

- [ ] **Step 2: Run UI boundary and style convergence tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/uiLibraryBoundary.test.ts src/renderer/styleConvergence.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run focused settings tests**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer -- src/renderer/components/settings/PillListEditor.test.ts src/renderer/components/settings/PillListEditor.browser.test.ts src/renderer/components/settings/NetworkEndpointEditor.browser.test.ts src/renderer/components/settings/SettingsGlobal.test.ts src/renderer/components/settings/SettingsProfiles.browser.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run full renderer test suite**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app test:renderer
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @immersive-subs/desktop-app typecheck
```

Expected: PASS.

- [ ] **Step 6: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

---

## Self-Review

Spec coverage:

- Shared pill UI: Task 1.
- Network endpoint reuse without changing endpoint parsing: Task 2.
- Process blacklist pill UI: Task 3.
- Subtitle priority pill UI and drag sorting only: Task 4.
- Removal of drag-delete behavior: Task 4 deletes `usePriorityDragDrop`.
- Styling and UI primitive constraints: Tasks 1 and 5.
- Verification: Task 5.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps.
- No compatibility, migration, fallback, legacy UI, or old data handling.

Type consistency:

- Shared item type is `PillListEditorItem`.
- Shared component events are `update:draftValue`, `add-draft`, `remove`, and `reorder`.
- Parent usages map those events to existing store actions.
