"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type { ResumeSection } from "../lib/resume-model";

export type SortableSectionCardProps = {
  children: ReactNode;
  index: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onRename: (title: string) => void;
  section: ResumeSection;
  sectionCount: number;
};

export function SortableSectionCard({
  children,
  index,
  onMove,
  onRemove,
  onRename,
  section,
  sectionCount,
}: SortableSectionCardProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: section.id,
    data: { type: "section" },
    transition: { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });

  return (
    <article
      aria-label={`${section.title} section, ${index + 1} of ${sectionCount}`}
      className={`section-card${isDragging ? " sorting-source" : ""}`}
      data-content-anchor={section.id}
      id={`content-section-${section.id}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 45 : undefined,
      }}
    >
      <div className="section-card-head">
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${section.title}. Press space, then use arrow keys.`}
          className="drag-handle"
          title="Drag to reorder. Press Space to use arrow keys."
          type="button"
        >
          <i />
          <i />
          <i />
        </button>
        <input
          aria-label={`${section.title} section title`}
          className="section-title-input"
          onChange={(event) => onRename(event.target.value)}
          value={section.title}
        />
        <div className="section-actions">
          <button
            aria-label={`Move ${section.title} up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Move up"
            type="button"
          >
            ↑
          </button>
          <button
            aria-label={`Move ${section.title} down`}
            disabled={index === sectionCount - 1}
            onClick={() => onMove(1)}
            title="Move down"
            type="button"
          >
            ↓
          </button>
          <button
            aria-label={`Remove ${section.title} section`}
            className="danger-action"
            onClick={onRemove}
            title="Remove section"
            type="button"
          >
            ×
          </button>
        </div>
      </div>
      {children}
    </article>
  );
}
