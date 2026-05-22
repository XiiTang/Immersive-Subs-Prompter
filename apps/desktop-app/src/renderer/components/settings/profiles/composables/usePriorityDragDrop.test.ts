import { describe, expect, it, vi } from "vitest";
import { usePriorityDragDrop } from "./usePriorityDragDrop";

function createDragEvent(): DragEvent {
  return {
    dataTransfer: {
      setData: vi.fn(),
      effectAllowed: "uninitialized"
    }
  } as unknown as DragEvent;
}

describe("usePriorityDragDrop", () => {
  it("removes the dragged priority when the drag ends outside its list", () => {
    const reorderPriority = vi.fn();
    const removePriority = vi.fn();
    const dragDrop = usePriorityDragDrop({
      reorderPriority,
      removePriority,
      getListLength: () => 3
    } as never);

    dragDrop.onPriorityDragStart("primary", 1, createDragEvent());
    dragDrop.onPriorityDragEnd();

    expect(removePriority).toHaveBeenCalledWith("primary", 1);
    expect(reorderPriority).not.toHaveBeenCalled();
  });

  it("reorders without deleting when the dragged priority is dropped inside its list", () => {
    const reorderPriority = vi.fn();
    const removePriority = vi.fn();
    const dragDrop = usePriorityDragDrop({
      reorderPriority,
      removePriority,
      getListLength: () => 3
    } as never);

    dragDrop.onPriorityDragStart("primary", 0, createDragEvent());
    dragDrop.onPriorityDrop("primary", 2);
    dragDrop.onPriorityDragEnd();

    expect(reorderPriority).toHaveBeenCalledWith("primary", 0, 2);
    expect(removePriority).not.toHaveBeenCalled();
  });

  it("removes the dragged priority when it is dropped in the other priority list", () => {
    const reorderPriority = vi.fn();
    const removePriority = vi.fn();
    const dragDrop = usePriorityDragDrop({
      reorderPriority,
      removePriority,
      getListLength: () => 3
    });

    dragDrop.onPriorityDragStart("primary", 0, createDragEvent());
    dragDrop.onPriorityListDrop("secondary");
    dragDrop.onPriorityDragEnd();

    expect(removePriority).toHaveBeenCalledWith("primary", 0);
    expect(reorderPriority).not.toHaveBeenCalled();
  });
});
