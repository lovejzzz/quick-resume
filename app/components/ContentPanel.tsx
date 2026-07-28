"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRef, useState, type ChangeEvent, type RefObject } from "react";
import { SchoolAutocomplete } from "./SchoolAutocomplete";
import { SortableSectionCard } from "./SortableSectionCard";
import { sectionTemplates } from "../lib/fit";
import {
  getOcrPagePlan,
  importByOcr,
  importResumeFile,
  type ImportResult,
  type OcrProgress,
  type OcrRetry,
} from "../lib/import-resume";
import {
  makeId,
  type ResumeData,
  type ResumeEntry,
  type ResumeSection,
  type SectionKind,
} from "../lib/resume-model";

export type ContentPanelProps = {
  activeAnchor: string;
  data: ResumeData;
  onClearAll: () => void;
  onLoadExample: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReplaceData: (data: ResumeData) => void;
  onScrollTo: (anchor: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  setData: (update: (current: ResumeData) => ResumeData) => void;
};

export function ContentPanel({
  activeAnchor,
  data,
  onClearAll,
  onLoadExample,
  onPhotoChange,
  onReplaceData,
  onScrollTo,
  setData,
}: ContentPanelProps) {
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [ocrOffer, setOcrOffer] = useState<OcrRetry | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const ocrAbort = useRef<AbortController | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const ocrPagePlan = ocrOffer ? getOcrPagePlan(ocrOffer.pages) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateContact = (key: keyof Omit<ResumeData, "sections">, value: string) =>
    setData((current) => ({ ...current, [key]: value }));

  const updateSection = (sectionId: string, patch: Partial<ResumeSection>) =>
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    }));

  const updateEntry = (sectionId: string, entryId: string, patch: Partial<ResumeEntry>) =>
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              entries: section.entries.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry,
              ),
            }
          : section,
      ),
    }));

  const moveSection = (sectionId: string, direction: -1 | 1) =>
    setData((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });

  const finishDrag = (event: DragEndEvent) => {
    setDraggedSection(null);
    const sourceId = String(event.active.id);
    const targetId = event.over ? String(event.over.id) : null;
    if (!targetId || sourceId === targetId) return;
    setData((current) => {
      const from = current.sections.findIndex((section) => section.id === sourceId);
      const to = current.sections.findIndex((section) => section.id === targetId);
      if (from < 0 || to < 0) return current;
      return { ...current, sections: arrayMove(current.sections, from, to) };
    });
  };

  const addSection = (kind: SectionKind) => {
    const template = sectionTemplates[kind];
    setData((current) => ({
      ...current,
      sections: [
        ...current.sections,
        {
          id: makeId(),
          kind,
          title: template.title,
          entries: [{ ...template.entry, id: makeId(), bullets: [...template.entry.bullets] }],
        },
      ],
    }));
  };

  const addEntry = (section: ResumeSection) => {
    const template = sectionTemplates[section.kind].entry;
    updateSection(section.id, {
      entries: [...section.entries, { ...template, id: makeId(), bullets: [...template.bullets] }],
    });
  };

  const applyResult = (result: ImportResult) => {
    if (!result.ok) {
      setImportMessage({ tone: "error", text: result.reason });
      setOcrOffer(result.retry ?? null);
      return;
    }
    setOcrOffer(null);
    onReplaceData(result.data);
    setImportMessage({
      tone: "ok",
      // Report what was actually recovered so the user knows where to look
      // rather than having to re-read the whole document.
      text: [
        result.summary || "Imported.",
        ...result.warnings,
        "Check every section before exporting — designed layouts do not always convert cleanly.",
      ].join(" "),
    });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    setOcrOffer(null);
    const result = await importResumeFile(file);
    setImporting(false);
    input.value = "";
    applyResult(result);
  };

  const runOcr = async (retry: OcrRetry) => {
    const controller = new AbortController();
    ocrAbort.current = controller;
    setOcrProgress({ phase: "loading", ratio: 0 });
    setImportMessage(null);
    const result = await importByOcr(retry, {
      signal: controller.signal,
      onProgress: setOcrProgress,
    });
    ocrAbort.current = null;
    setOcrProgress(null);
    applyResult(result);
  };

  return (
    <div className="content-layout">
      <nav aria-label="Content sections" className="content-sidebar">
        <p>Navigate</p>
        <button
          aria-current={activeAnchor === "identity"}
          className={activeAnchor === "identity" ? "active" : ""}
          onClick={() => onScrollTo("identity")}
          type="button"
        >
          <span aria-hidden="true">01</span>
          Identity
        </button>
        <div className="content-nav-sections">
          <small>Sections</small>
          {data.sections.map((section, index) => (
            <button
              aria-current={activeAnchor === section.id}
              className={activeAnchor === section.id ? "active" : ""}
              key={section.id}
              onClick={() => onScrollTo(section.id)}
              type="button"
            >
              <span aria-hidden="true">{String(index + 2).padStart(2, "0")}</span>
              {section.title || "Untitled"}
            </button>
          ))}
        </div>
        <button
          aria-current={activeAnchor === "add-section"}
          className={`content-nav-add${activeAnchor === "add-section" ? " active" : ""}`}
          onClick={() => onScrollTo("add-section")}
          type="button"
        >
          <span aria-hidden="true">+</span>
          Add section
        </button>
      </nav>

      <div className="content-flow">
        <section className="panel-block" data-content-anchor="identity" id="content-identity">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Header</p>
              <h2>Personal details</h2>
            </div>
            <div className="content-actions">
              <button className="example-button" onClick={onLoadExample} title="Load the example resume" type="button">
                Example
              </button>
              <button
                className="clear-all-button"
                onClick={onClearAll}
                title="Clear text while keeping sections and styling"
                type="button"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="import-card">
            <div>
              <strong>Start from an existing resume</strong>
              <small>
                Reads a PDF, Word .docx, or plain-text resume in your browser and fills the sections below. Nothing is uploaded.
              </small>
            </div>
            <label className="import-action">
              {importing ? "Reading…" : "Import file"}
              <input
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                disabled={importing}
                onChange={handleImport}
                ref={importInputRef}
                type="file"
              />
            </label>
          </div>
          {importMessage && (
            <p className={importMessage.tone === "error" ? "import-message error" : "import-message"} role="status">
              {importMessage.text}
            </p>
          )}

          {ocrOffer && !ocrProgress && (
            <div className="ocr-offer">
              <div>
                <strong>Read it with text recognition instead?</strong>
                <small>
                  Recognises the page images on this device. Downloads a 6.7 MB engine the first time, then
                  works offline. Accuracy is good but not perfect — you will need to check the result,
                  especially your email and phone.
                  {ocrPagePlan?.truncated
                    ? ` This pass reads the first ${ocrPagePlan.pagesToRead} of ${ocrPagePlan.totalPages} pages.`
                    : ""}
                </small>
              </div>
              <button className="ocr-run" onClick={() => runOcr(ocrOffer)} type="button">
                {ocrPagePlan?.truncated
                  ? `Read first ${ocrPagePlan.pagesToRead} pages`
                  : `Read ${ocrOffer.pages === 1 ? "the page" : `all ${ocrOffer.pages} pages`}`}
              </button>
            </div>
          )}

          {ocrProgress && (
            <div aria-live="polite" className="ocr-progress">
              <div className="ocr-progress-head">
                <span>
                  {ocrProgress.phase === "loading"
                    ? "Downloading the recognition engine…"
                    : ocrProgress.phase === "rendering"
                      ? `Rendering page ${ocrProgress.page} of ${ocrProgress.pages}…`
                      : `Reading page ${ocrProgress.page} of ${ocrProgress.pages}…`}
                </span>
                <button
                  onClick={() => {
                    ocrAbort.current?.abort();
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              <div className="ocr-progress-track">
                <span style={{ width: `${Math.round(ocrProgress.ratio * 100)}%` }} />
              </div>
            </div>
          )}

          <div className="field-grid two">
            <label className="field">
              <span>Name</span>
              <input onChange={(event) => updateContact("name", event.target.value)} value={data.name} />
            </label>
            <label className="field">
              <span>Headline</span>
              <input onChange={(event) => updateContact("headline", event.target.value)} value={data.headline} />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                onChange={(event) => updateContact("email", event.target.value)}
                type="email"
                value={data.email}
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                onChange={(event) => updateContact("phone", event.target.value)}
                type="tel"
                value={data.phone}
              />
            </label>
            <label className="field">
              <span>Location</span>
              <input
                onChange={(event) => updateContact("location", event.target.value)}
                placeholder="City, State"
                value={data.location}
              />
            </label>
            <label className="field">
              <span>Portfolio</span>
              <input onChange={(event) => updateContact("portfolio", event.target.value)} value={data.portfolio} />
            </label>
            <label className="field">
              <span>Additional link</span>
              <input
                onChange={(event) => updateContact("secondaryLink", event.target.value)}
                value={data.secondaryLink}
              />
            </label>
            <label className="field upload-field">
              <span>Optional photo</span>
              <input accept="image/png,image/jpeg" onChange={onPhotoChange} type="file" />
            </label>
          </div>
        </section>

        <section className="panel-block content-sections-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Structure</p>
              <h2>Resume sections</h2>
            </div>
            <span className="helper">Drag or use arrows</span>
          </div>

          <DndContext
            collisionDetection={closestCenter}
            onDragCancel={() => setDraggedSection(null)}
            onDragEnd={finishDrag}
            onDragStart={(event: DragStartEvent) => setDraggedSection(String(event.active.id))}
            sensors={sensors}
          >
            <SortableContext
              items={data.sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="section-stack">
                {data.sections.map((section, sectionIndex) => (
                  <SortableSectionCard
                    index={sectionIndex}
                    key={section.id}
                    onMove={(direction) => moveSection(section.id, direction)}
                    onRemove={() =>
                      setData((current) => ({
                        ...current,
                        sections: current.sections.filter((item) => item.id !== section.id),
                      }))
                    }
                    onRename={(title) => updateSection(section.id, { title })}
                    section={section}
                    sectionCount={data.sections.length}
                  >
                    <div className="entry-stack">
                      {section.entries.map((entry, entryIndex) => (
                        <div className="entry-editor" key={entry.id}>
                          {section.kind !== "summary" && (
                            <div className="entry-editor-head">
                              <span>Item {entryIndex + 1}</span>
                              <button
                                aria-label={`Remove item ${entryIndex + 1} from ${section.title}`}
                                onClick={() =>
                                  updateSection(section.id, {
                                    entries: section.entries.filter((item) => item.id !== entry.id),
                                  })
                                }
                                type="button"
                              >
                                Remove
                              </button>
                            </div>
                          )}

                          {section.kind !== "summary" && (
                            <div className="field-grid two">
                              {section.kind === "education" ? (
                                <SchoolAutocomplete
                                  entryId={entry.id}
                                  onChange={(value) => updateEntry(section.id, entry.id, { heading: value })}
                                  value={entry.heading}
                                />
                              ) : (
                                <label className="field">
                                  <span>{section.kind === "skills" ? "Category" : "Title"}</span>
                                  <input
                                    onChange={(event) =>
                                      updateEntry(section.id, entry.id, { heading: event.target.value })
                                    }
                                    value={entry.heading}
                                  />
                                </label>
                              )}
                              {section.kind !== "skills" && section.kind !== "awards" && (
                                <label className="field">
                                  <span>{section.kind === "education" ? "Degree" : "Organization / role"}</span>
                                  <input
                                    onChange={(event) =>
                                      updateEntry(section.id, entry.id, { subheading: event.target.value })
                                    }
                                    value={entry.subheading}
                                  />
                                </label>
                              )}
                              {section.kind !== "skills" && (
                                <label className="field">
                                  <span>Date</span>
                                  <input
                                    onChange={(event) =>
                                      updateEntry(section.id, entry.id, { date: event.target.value })
                                    }
                                    value={entry.date}
                                  />
                                </label>
                              )}
                              {section.kind === "projects" && (
                                <label className="field">
                                  <span>Link</span>
                                  <input
                                    onChange={(event) =>
                                      updateEntry(section.id, entry.id, { link: event.target.value })
                                    }
                                    value={entry.link || ""}
                                  />
                                </label>
                              )}
                            </div>
                          )}

                          <label className="field">
                            <span>
                              {section.kind === "summary"
                                ? "Summary"
                                : section.kind === "skills"
                                  ? "Skills"
                                  : "Details"}
                            </span>
                            <textarea
                              onChange={(event) =>
                                updateEntry(section.id, entry.id, { details: event.target.value })
                              }
                              rows={section.kind === "summary" ? 5 : 2}
                              value={entry.details}
                            />
                          </label>

                          {(section.kind === "experience" ||
                            section.kind === "projects" ||
                            section.kind === "custom") && (
                            <label className="field">
                              <span>
                                Bullets <small>one per line</small>
                              </span>
                              <textarea
                                onChange={(event) =>
                                  updateEntry(section.id, entry.id, {
                                    bullets: event.target.value.split("\n"),
                                  })
                                }
                                rows={3}
                                value={entry.bullets.join("\n")}
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>

                    {section.kind !== "summary" && (
                      <button className="text-button" onClick={() => addEntry(section)} type="button">
                        + Add item
                      </button>
                    )}
                  </SortableSectionCard>
                ))}
              </div>
            </SortableContext>
            <DragOverlay
              adjustScale={false}
              dropAnimation={{ duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
            >
              {draggedSection ? (
                <div className="section-drag-overlay">
                  <span aria-hidden="true" className="overlay-grip">
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>{data.sections.find((section) => section.id === draggedSection)?.title}</strong>
                  <small>Move to reorder</small>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          <div className="add-section-row" data-content-anchor="add-section" id="content-add-section">
            <label className="field">
              <span>Add another section</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) addSection(event.target.value as SectionKind);
                  event.target.value = "";
                }}
              >
                <option disabled value="">
                  Choose a section…
                </option>
                <option value="experience">Experience</option>
                <option value="projects">Projects</option>
                <option value="education">Education</option>
                <option value="skills">Skills</option>
                <option value="awards">Awards</option>
                <option value="custom">Custom section</option>
              </select>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
