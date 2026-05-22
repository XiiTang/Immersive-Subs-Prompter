import { computed, inject, type ComputedRef, type InjectionKey } from "vue";

export interface UiFieldContext {
  labelId: ComputedRef<string>;
  describedBy: ComputedRef<string>;
}

export const uiFieldContextKey: InjectionKey<UiFieldContext> = Symbol("ui-field-context");

export function useUiFieldControl(options: {
  hasExplicitLabel?: () => boolean;
  describedBy?: () => string | undefined;
} = {}) {
  const field = inject(uiFieldContextKey, null);
  const fieldLabelledBy = computed(() => {
    if (!field || options.hasExplicitLabel?.()) {
      return undefined;
    }
    return field.labelId.value;
  });
  const fieldDescribedBy = computed(() => {
    const ids = [
      options.describedBy?.(),
      field?.describedBy.value
    ].filter((value): value is string => Boolean(value));
    return ids.length ? ids.join(" ") : undefined;
  });

  return {
    hasField: computed(() => Boolean(field)),
    fieldLabelledBy,
    fieldDescribedBy
  };
}
