<template>
  <div class="network-endpoint-editor">
    <div class="priority-editor__header">
      <div class="priority-editor__label-row">
        <span class="settings-field__label">{{ label }}</span>
      </div>
      <span class="priority-editor__hint">{{ hint }}</span>
    </div>

    <div class="priority-editor__list network-endpoint-editor__list">
      <span
        v-for="endpoint in endpoints"
        :key="endpoint.id"
        class="ui-chip priority-editor__item network-endpoint-editor__item"
        :class="{
          'network-endpoint-editor__item--error': statusById.get(endpoint.id)?.status === 'error',
          'network-endpoint-editor__item--removable': endpoints.length > 1
        }"
      >
        <span
          class="network-endpoint-editor__display"
          :data-testid="`network-endpoint-display-${endpoint.id}`"
          :title="endpointUrl(endpoint)"
        >
          {{ endpointUrl(endpoint) }}
        </span>

        <UiIconButton
          v-if="endpoints.length > 1"
          class="network-endpoint-editor__remove"
          size="sm"
          variant="ghost"
          :label="removeLabel"
          :data-testid="`network-endpoint-remove-${endpoint.id}`"
          @click.stop="removeEndpoint(endpoint.id)"
        >
          <IconClose size="sm" />
        </UiIconButton>
      </span>

      <span class="priority-editor__item priority-editor__draft network-endpoint-editor__draft">
        <UiInput
          class="priority-editor__draft-input network-endpoint-editor__input"
          data-testid="network-endpoint-draft-input"
          :model-value="draftValue"
          :placeholder="placeholder"
          @update:model-value="draftValue = String($event)"
          @blur="commitDraft"
          @keyup.enter="commitDraft"
        />
      </span>
    </div>

    <div v-if="error" class="settings-field__error">{{ error }}</div>
    <div
      v-for="status in errorStatuses"
      :key="status.endpointId"
      class="settings-field__error"
    >
      {{ status.host }}:{{ status.port }} - {{ status.error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { NetworkEndpoint, NetworkListenerStatus } from "../../../main/types";
import {
  buildNetworkEndpointUrl,
  networkEndpointKey,
  parseNetworkEndpointInput
} from "../../../common/networkEndpoints.js";
import { IconClose } from "../icons";
import { UiIconButton, UiInput } from "../ui";

const props = defineProps<{
  endpoints: NetworkEndpoint[];
  authToken: string;
  listenerStatuses: NetworkListenerStatus[];
  label: string;
  hint: string;
  placeholder: string;
  removeLabel: string;
}>();

const emit = defineEmits<{
  (event: "update:endpoints", endpoints: NetworkEndpoint[]): void;
}>();

const draftValue = ref("");
const error = ref<string | null>(null);

const statusById = computed(() => new Map(props.listenerStatuses.map((status) => [status.endpointId, status])));
const errorStatuses = computed(() => props.listenerStatuses.filter((status) => status.status === "error"));

function endpointUrl(endpoint: NetworkEndpoint): string {
  return buildNetworkEndpointUrl(endpoint, props.authToken);
}

function commitDraft() {
  const value = draftValue.value.trim();
  if (!value) {
    error.value = null;
    return;
  }
  const nextEndpoint = parseEditableEndpoint(value);
  if (!nextEndpoint) return;
  emit("update:endpoints", [...props.endpoints, nextEndpoint]);
  draftValue.value = "";
  error.value = null;
}

function removeEndpoint(endpointId: string) {
  if (props.endpoints.length <= 1) return;
  emit("update:endpoints", props.endpoints.filter((endpoint) => endpoint.id !== endpointId));
}

function parseEditableEndpoint(value: string): NetworkEndpoint | null {
  const parsed = parseNetworkEndpointInput(value);
  if (!parsed.ok) {
    error.value = parsed.error;
    return null;
  }
  const duplicate = props.endpoints.some((endpoint) => networkEndpointKey(endpoint) === networkEndpointKey(parsed.endpoint));
  if (duplicate) {
    error.value = "Endpoint already exists";
    return null;
  }
  return {
    id: createEndpointId(),
    ...parsed.endpoint
  };
}

function createEndpointId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `endpoint-${crypto.randomUUID()}`;
  }
  return `endpoint-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
</script>
