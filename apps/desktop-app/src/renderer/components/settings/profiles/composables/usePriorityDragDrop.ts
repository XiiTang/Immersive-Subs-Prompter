import { ref, type Ref } from "vue";

export type PriorityRole = "primary" | "secondary";

export type PriorityDragState = {
  role: PriorityRole | null;
  fromIndex: number | null;
  overIndex: number | null;
};

export type ReorderPriority = (role: PriorityRole, fromIndex: number, toIndex: number) => void;
export type RemovePriority = (role: PriorityRole, index: number) => void;

export type PriorityListLengthGetter = (role: PriorityRole) => number;

export interface UsePriorityDragDropOptions {
  reorderPriority: ReorderPriority;
  removePriority: RemovePriority;
  getListLength: PriorityListLengthGetter;
}

export interface UsePriorityDragDropReturn {
  priorityDragState: Ref<PriorityDragState>;
  onPriorityDragStart(role: PriorityRole, index: number, event: DragEvent): void;
  onPriorityDragEnter(role: PriorityRole, index: number): void;
  onPriorityDragLeave(role: PriorityRole, index: number): void;
  onPriorityDrop(role: PriorityRole, index: number): void;
  onPriorityListDrop(role: PriorityRole): void;
  onPriorityDragEnd(): void;
  resetPriorityDragState(): void;
  isPriorityDragOver(role: PriorityRole, index: number): boolean;
}

export function usePriorityDragDrop(options: UsePriorityDragDropOptions): UsePriorityDragDropReturn {
  const { reorderPriority, removePriority, getListLength } = options;

  const priorityDragState = ref<PriorityDragState>({
    role: null,
    fromIndex: null,
    overIndex: null
  });

  function resetPriorityDragState() {
    priorityDragState.value = {
      role: null,
      fromIndex: null,
      overIndex: null
    };
  }

  function removeDraggedPriority() {
    const { role, fromIndex } = priorityDragState.value;
    if (role !== null && fromIndex !== null) {
      removePriority(role, fromIndex);
    }
    resetPriorityDragState();
  }

  function onPriorityDragStart(role: PriorityRole, index: number, event: DragEvent) {
    priorityDragState.value = { role, fromIndex: index, overIndex: index };
    event.dataTransfer?.setData("text/plain", `${role}:${index}`);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function onPriorityDragEnter(role: PriorityRole, index: number) {
    if (priorityDragState.value.role !== role) {
      return;
    }
    priorityDragState.value.overIndex = index;
  }

  function onPriorityDragLeave(role: PriorityRole, index: number) {
    if (priorityDragState.value.role !== role) {
      return;
    }
    if (priorityDragState.value.overIndex === index) {
      priorityDragState.value.overIndex = null;
    }
  }

  function onPriorityDrop(role: PriorityRole, index: number) {
    const { role: draggingRole, fromIndex } = priorityDragState.value;
    if (draggingRole !== role || fromIndex === null) {
      removeDraggedPriority();
      return;
    }
    if (fromIndex !== index) {
      reorderPriority(role, fromIndex, index);
    }
    resetPriorityDragState();
  }

  function onPriorityListDrop(role: PriorityRole) {
    const { role: draggingRole, fromIndex, overIndex } = priorityDragState.value;
    if (draggingRole !== role || fromIndex === null) {
      removeDraggedPriority();
      return;
    }
    const listLength = getListLength(role);
    const targetIndex = Math.min(overIndex ?? listLength - 1, listLength - 1);
    if (targetIndex !== fromIndex) {
      reorderPriority(role, fromIndex, targetIndex);
    }
    resetPriorityDragState();
  }

  function onPriorityDragEnd() {
    removeDraggedPriority();
  }

  function isPriorityDragOver(role: PriorityRole, index: number) {
    const state = priorityDragState.value;
    return state.role === role && state.overIndex === index && state.fromIndex !== index;
  }

  return {
    priorityDragState,
    onPriorityDragStart,
    onPriorityDragEnter,
    onPriorityDragLeave,
    onPriorityDrop,
    onPriorityListDrop,
    onPriorityDragEnd,
    resetPriorityDragState,
    isPriorityDragOver
  };
}
