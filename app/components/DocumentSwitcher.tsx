"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumeDocument } from "../lib/resume-model";

export type DocumentSwitcherProps = {
  activeId: string;
  documents: ResumeDocument[];
  onCreateBlank: () => void;
  onCreateFromExample: () => void;
  onDelete: (id: string) => void;
  onDuplicate: () => void;
  onRename: (title: string) => void;
  onSelect: (id: string) => void;
};

export function DocumentSwitcher({
  activeId,
  documents,
  onCreateBlank,
  onCreateFromExample,
  onDelete,
  onDuplicate,
  onRename,
  onSelect,
}: DocumentSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = documents.find((document) => document.id === activeId) ?? documents[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!active) return null;

  return (
    <div className="document-switcher" ref={containerRef}>
      <input
        aria-label="Resume name"
        className="document-title-input"
        onChange={(event) => onRename(event.target.value)}
        placeholder="Untitled resume"
        value={active.title}
      />
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Switch resume. ${documents.length} saved.`}
        className="document-switch-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{documents.length}</span>
        <i aria-hidden="true">⌄</i>
      </button>

      {open && (
        <div className="document-menu" role="menu">
          <p className="document-menu-heading">Your resumes</p>
          <ul>
            {documents.map((document) => (
              <li key={document.id}>
                <button
                  aria-current={document.id === activeId}
                  className={document.id === activeId ? "active" : ""}
                  onClick={() => {
                    onSelect(document.id);
                    setOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <strong>{document.title || "Untitled resume"}</strong>
                  <small>
                    {document.data.headline || document.data.name || "No headline yet"}
                  </small>
                </button>
                {documents.length > 1 && (
                  <button
                    aria-label={`Delete ${document.title || "untitled resume"}`}
                    className="document-delete"
                    onClick={() => onDelete(document.id)}
                    type="button"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="document-menu-actions">
            <button
              onClick={() => {
                onCreateBlank();
                setOpen(false);
              }}
              type="button"
            >
              New blank
            </button>
            <button
              onClick={() => {
                onDuplicate();
                setOpen(false);
              }}
              type="button"
            >
              Duplicate this
            </button>
            <button
              onClick={() => {
                onCreateFromExample();
                setOpen(false);
              }}
              type="button"
            >
              From example
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
