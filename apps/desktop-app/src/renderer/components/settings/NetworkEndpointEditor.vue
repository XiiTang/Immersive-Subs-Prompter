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
    :hide-header="hideHeader"
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

<script setup lang="ts">
import { computed, ref } from "vue";
import type { NetworkEndpoint, NetworkListenerStatus } from "../../../main/types";
import {
  buildNetworkEndpointUrl,
  networkEndpointKey,
  parseNetworkEndpointInput
} from "@immersive-subs/contracts";
import PillListEditor from "./PillListEditor.vue";
import type { PillListEditorItem } from "./pillListEditorTypes";

const props = defineProps<{
  endpoints: NetworkEndpoint[];
  authToken: string;
  listenerStatuses: NetworkListenerStatus[];
  label: string;
  hint: string;
  placeholder: string;
  removeLabel: string;
  hideHeader?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:endpoints", endpoints: NetworkEndpoint[]): void;
}>();

const draftValue = ref("");
const error = ref<string | null>(null);

const statusById = computed(() => new Map(props.listenerStatuses.map((status) => [status.endpointId, status])));
const errorStatuses = computed(() => props.listenerStatuses.filter((status) => status.status === "error"));
const endpointItems = computed<PillListEditorItem[]>(() =>
  props.endpoints.map((endpoint) => ({
    id: endpoint.id,
    label: endpointUrl(endpoint),
    title: endpointUrl(endpoint),
    removable: props.endpoints.length > 1,
    error: statusById.value.get(endpoint.id)?.status === "error"
  }))
);

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
  return `endpoint-${crypto.randomUUID()}`;
}
</script>
