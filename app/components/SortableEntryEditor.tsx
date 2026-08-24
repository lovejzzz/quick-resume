"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type { ResumeEntry } from "../lib/resume-model";

export type SortableEntryEditorProps = {
  children: ReactNode;
  entry: ResumeEntry;
  index: number;
  itemCount: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  sectionId: string;
  sectionTitle: string;
  sortable: boolean;
};

export function SortableEntryEditor({
  children,
  entry,
  index,
  itemCount,
  onMove,
  onRemove,
  sectionId,
  sectionTitle,
  sortable,
}: SortableEntryEditorProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: entry.id,
    data: { type: "entry", sectionId },
    transition: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });

  return (
    <div
      aria-label={`${sectionTitle} item ${index + 1} of ${itemCount}`}
      className={`entry-editor${isDragging ? " sorting-source" : ""}`}
      data-entry-id={entry.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 44 : undefined,
      }}
    >
      {sortable && (
        <div className="entry-editor-head">
          <div className="entry-order-label">
            <button
              {...attributes}
              {...listeners}
              aria-label={`Reorder item ${index + 1} in ${sectionTitle}. Press space, then use arrow keys.`}
              className="entry-drag-handle"
              title="Drag to reorder. Press Space to use arrow keys."
              type="button"
            >
              <i />
              <i />
              <i />
            </button>
            <span>Item {index + 1}</span>
          </div>
          <div className="entry-actions">
            <button
              aria-label={`Move item ${index + 1} up in ${sectionTitle}`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
              title="Move item up"
              type="button"
            >
              ↑
            </button>
            <button
              aria-label={`Move item ${index + 1} down in ${sectionTitle}`}
              disabled={index === itemCount - 1}
              onClick={() => onMove(1)}
              title="Move item down"
              type="button"
            >
              ↓
            </button>
            <button
              aria-label={`Remove item ${index + 1} from ${sectionTitle}`}
              className="entry-remove-action"
              onClick={onRemove}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
