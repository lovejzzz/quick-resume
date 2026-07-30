"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { ResumeDocument } from "../lib/resume-model";

export type DocumentSwitcherProps = {
  activeId: string;
  documents: ResumeDocument[];
  onCreateBlank: () => void;
  onCreateFromExample: () => void;
  onDelete: (id: string) => void;
  onDownloadBackup: () => void;
  onDuplicate: () => void;
  onImportFile: (file: File) => Promise<{ ok: boolean; reason?: string }>;
  onRename: (title: string) => void;
  onSelect: (id: string) => void;
};

export function DocumentSwitcher({
  activeId,
  documents,
  onCreateBlank,
  onCreateFromExample,
  onDelete,
  onDownloadBackup,
  onDuplicate,
  onImportFile,
  onRename,
  onSelect,
}: DocumentSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
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

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage("");
    const result = await onImportFile(file);
    setImporting(false);
    input.value = "";
    if (result.ok) {
      setOpen(false);
      setNewOpen(false);
    } else {
      setMessage(result.reason ?? "That resume could not be imported.");
    }
  };

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
              aria-expanded={newOpen}
              onClick={() => setNewOpen((current) => !current)}
              type="button"
            >
              + New
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
            <button onClick={onDownloadBackup} type="button">
              Back up
            </button>
          </div>
          {newOpen && (
            <div aria-label="Create a new resume" className="document-new-options">
              <p>Start a new resume</p>
              <button
                onClick={() => {
                  onCreateBlank();
                  setOpen(false);
                }}
                type="button"
              >
                <strong>Blank resume</strong>
                <small>Start with an empty document</small>
              </button>
              <label className={importing ? "disabled" : ""}>
                <strong>{importing ? "Importing…" : "Import a resume"}</strong>
                <small>PDF, Word .docx, or text · processed on this device</small>
                <input
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  disabled={importing}
                  onChange={handleImport}
                  type="file"
                />
              </label>
              <button
                onClick={() => {
                  onCreateFromExample();
                  setOpen(false);
                }}
                type="button"
              >
                <strong>Another example</strong>
                <small>Make a fresh copy of Tian Xing’s example</small>
              </button>
              {message && <p className="document-new-error" role="alert">{message}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
