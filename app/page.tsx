"use client";

import {
  ChangeEvent,
  DragEvent,
  ElementType,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import { tianXingExample } from "./examples/tian-xing";
import type {
  ResumeData,
  ResumeEntry,
  ResumeLayout,
  ResumeSection,
  ResumeStyle,
  SectionKind,
} from "./resume-model";
import { getResumeTheme, resumeThemes } from "./resume-themes";

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const PRINT_SAFE_HEIGHT = 1038;

const initialData: ResumeData = tianXingExample;

const initialStyle: ResumeStyle = {
  accent: "#28605d",
  font: "modern",
  density: "comfortable",
  fitLevel: 0,
  fontAdjustments: {},
  layout: "modern",
  showPhoto: false,
};

const sectionTemplates: Record<SectionKind, { title: string; entry: ResumeEntry }> = {
  summary: {
    title: "Profile",
    entry: { id: "", heading: "", subheading: "", date: "", details: "Write a focused professional summary.", bullets: [] },
  },
  experience: {
    title: "Experience",
    entry: { id: "", heading: "Role title", subheading: "Organization", date: "Dates", details: "", bullets: ["Describe an accomplishment or responsibility."] },
  },
  projects: {
    title: "Projects",
    entry: { id: "", heading: "Project name", subheading: "Your role", date: "", details: "Describe the project and its purpose.", bullets: [], link: "" },
  },
  education: {
    title: "Education",
    entry: { id: "", heading: "School", subheading: "Degree or program", date: "Dates", details: "", bullets: [] },
  },
  skills: {
    title: "Skills",
    entry: { id: "", heading: "Category", subheading: "", date: "", details: "Skill, Skill, Skill", bullets: [] },
  },
  awards: {
    title: "Awards",
    entry: { id: "", heading: "Award name", subheading: "", date: "Year", details: "", bullets: [] },
  },
  custom: {
    title: "New Section",
    entry: { id: "", heading: "Item title", subheading: "Supporting detail", date: "", details: "Add your information here.", bullets: [] },
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function safeFilename(name: string) {
  return `${name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume"}-resume`;
}

function serializeWorkspace(data: ResumeData, style: ResumeStyle) {
  return JSON.stringify({ data, style });
}

type InlineEditProps = {
  as?: ElementType;
  className?: string;
  editId: string;
  fontAdjustment: number;
  fontBase: string;
  label: string;
  multiline?: boolean;
  onActivate: (editId: string, label: string, top: number) => void;
  onCommit: (value: string) => void;
  placeholder?: string;
  value: string;
};

type ConfirmationRequest = {
  confirmLabel: string;
  eyebrow: string;
  message: string;
  onConfirm: () => void;
  title: string;
  tone: "accent" | "danger";
};

function InlineEdit({
  as: Tag = "span",
  className,
  editId,
  fontAdjustment,
  fontBase,
  label,
  multiline = false,
  onActivate,
  onCommit,
  placeholder = "",
  value,
}: InlineEditProps) {
  const elementRef = useRef<HTMLElement>(null);
  const isEditing = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || isEditing.current) return;
    const visibleValue = multiline ? element.innerText : element.textContent;
    if (visibleValue !== value) element.textContent = value;
  }, [multiline, value]);

  const finishEdit = () => {
    const element = elementRef.current;
    if (!element) return;
    isEditing.current = false;
    const rawValue = multiline ? element.innerText : element.textContent;
    const nextValue = (rawValue || "").replace(/\u00a0/g, " ").trim();
    element.textContent = nextValue;
    onCommit(nextValue);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (elementRef.current) elementRef.current.textContent = value;
      event.currentTarget.blur();
      return;
    }
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (multiline && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <Tag
      aria-label={label}
      className={className}
      contentEditable
      data-inline-edit=""
      data-placeholder={placeholder}
      onBlur={finishEdit}
      onFocus={(event: React.FocusEvent<HTMLElement>) => {
        isEditing.current = true;
        const paper = event.currentTarget.closest(".resume-paper");
        if (paper) {
          const paperBox = paper.getBoundingClientRect();
          const elementBox = event.currentTarget.getBoundingClientRect();
          onActivate(editId, label, elementBox.top - paperBox.top + elementBox.height / 2);
        }
      }}
      onKeyDown={handleKeyDown}
      ref={elementRef}
      spellCheck
      style={{ fontSize: `calc(${fontBase} + ${fontAdjustment}px)` }}
      suppressContentEditableWarning
      tabIndex={0}
      title="Click to edit"
    >
      {value}
    </Tag>
  );
}

export default function Home() {
  const [data, setData] = useState<ResumeData>(initialData);
  const [style, setStyle] = useState<ResumeStyle>(initialStyle);
  const [activeTab, setActiveTab] = useState<"content" | "style" | "export">("style");
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "pdf">("pdf");
  const [exportScale, setExportScale] = useState(2);
  const [jpgQuality, setJpgQuality] = useState(0.9);
  const [exporting, setExporting] = useState(false);
  const [autoFitting, setAutoFitting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [activeText, setActiveText] = useState<{ id: string; label: string; top: number } | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const confirmationDialogRef = useRef<HTMLDialogElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const hydrated = useRef(false);
  const lastSavedSnapshot = useRef(serializeWorkspace(initialData, initialStyle));

  const getResumeContentHeight = () => {
    const paper = resumeRef.current;
    const body = paper?.querySelector<HTMLElement>(".resume-body");
    if (!paper || !body) return 0;
    const paperBox = paper.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const paperStyle = window.getComputedStyle(paper);
    const paddingBottom = Number.parseFloat(paperStyle.paddingBottom) || 0;
    return bodyBox.bottom - paperBox.top + paddingBottom;
  };

  useEffect(() => {
    let cancelled = false;
    let loadedData: ResumeData = initialData;
    let loadedStyle: ResumeStyle = initialStyle;
    try {
      const stored = window.localStorage.getItem("quick-resume");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data) loadedData = parsed.data;
        if (parsed.style) loadedStyle = { ...initialStyle, ...parsed.style };
      }
    } catch {
      // Keep the safe starter data if local storage is unavailable or invalid.
    }
    window.queueMicrotask(() => {
      if (cancelled) return;
      lastSavedSnapshot.current = serializeWorkspace(loadedData, loadedStyle);
      setData(loadedData);
      setStyle(loadedStyle);
      setHasUnsavedChanges(false);
      hydrated.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const changed = serializeWorkspace(data, style) !== lastSavedSnapshot.current;
    setHasUnsavedChanges(changed);
    if (changed) setSaveError("");
  }, [data, style]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!confirmation) return;
    const dialog = confirmationDialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const focusFrame = window.requestAnimationFrame(() => confirmationCancelRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [confirmation]);

  useEffect(() => {
    const updatePages = () => {
      if (!resumeRef.current) return;
      const contentHeight = getResumeContentHeight();
      setPageCount(contentHeight <= PRINT_SAFE_HEIGHT ? 1 : Math.ceil(contentHeight / PRINT_SAFE_HEIGHT));
    };
    updatePages();
    const observer = new ResizeObserver(updatePages);
    if (resumeRef.current) observer.observe(resumeRef.current);
    return () => observer.disconnect();
  }, [data, style]);

  const textLength = useMemo(() => JSON.stringify(data).length, [data]);
  const estimatedBytes = useMemo(() => {
    const pixels = 816 * 1056 * exportScale * exportScale * pageCount;
    const density = Math.min(1, textLength / 9000);
    const photoBytes = data.photo ? Math.floor((data.photo.length * 3) / 4) : 0;
    if (exportFormat === "png") return pixels * (0.1 + density * 0.09) + photoBytes * 0.7;
    if (exportFormat === "jpg") return pixels * (0.045 + density * 0.05) * jpgQuality + photoBytes * 0.45;
    return 70000 + textLength * 9 + pageCount * 38000 + photoBytes * 0.25;
  }, [data.photo, exportFormat, exportScale, jpgQuality, pageCount, textLength]);

  const resumeFitVariables = useMemo(() => {
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const mix = (start: number, end: number, progress: number) => start + (end - start) * progress;
    const fit = clamp(style.fitLevel / 100);

    // Smart fitting happens in stages: whitespace first, page margins second,
    // and typography only after the safer layout savings have been used.
    const spacePhase = clamp(fit / 0.55);
    const marginPhase = clamp((fit - 0.12) / 0.68);
    const typePhase = clamp((fit - 0.58) / 0.42);
    const detailPhase = clamp((fit - 0.28) / 0.72);
    const compact = style.density === "compact";

    const base = compact
      ? {
          bodySpace: 12,
          entrySpace: 8,
          fontSize: 11,
          headerSpace: 14,
          lineHeight: 1.36,
          paddingY: 52,
          sectionSpace: 11,
        }
      : {
          bodySpace: 17,
          entrySpace: 12,
          fontSize: 12,
          headerSpace: 20,
          lineHeight: 1.46,
          paddingY: 66,
          sectionSpace: 17,
        };

    return {
      "--paper-pad-y": `${mix(base.paddingY, 38, marginPhase).toFixed(1)}px`,
      "--paper-pad-x": `${mix(70, 48, marginPhase).toFixed(1)}px`,
      "--paper-font-size": `${mix(base.fontSize, 10.2, typePhase).toFixed(2)}px`,
      "--paper-line-height": mix(base.lineHeight, 1.3, typePhase).toFixed(3),
      "--header-space": `${mix(base.headerSpace, 10, spacePhase).toFixed(1)}px`,
      "--body-space": `${mix(base.bodySpace, 8, spacePhase).toFixed(1)}px`,
      "--section-space": `${mix(base.sectionSpace, 7, spacePhase).toFixed(1)}px`,
      "--section-title-space": `${mix(9, 5, spacePhase).toFixed(1)}px`,
      "--entry-space": `${mix(base.entrySpace, 5.5, spacePhase).toFixed(1)}px`,
      "--name-size": `${mix(34, 28, typePhase).toFixed(1)}px`,
      "--headline-size": `${mix(13, 11.4, typePhase).toFixed(1)}px`,
      "--contact-size": `${mix(10, 9.1, typePhase).toFixed(1)}px`,
      "--section-title-size": `${mix(11, 9.5, typePhase).toFixed(1)}px`,
      "--entry-title-size": `${mix(13, 11.4, typePhase).toFixed(1)}px`,
      "--entry-subtitle-size": `${mix(11, 9.8, typePhase).toFixed(1)}px`,
      "--entry-date-size": `${mix(10, 9, typePhase).toFixed(1)}px`,
      "--entry-text-size": `${mix(10.5, 9.4, typePhase).toFixed(1)}px`,
      "--entry-link-size": `${mix(9.5, 8.8, typePhase).toFixed(1)}px`,
      "--skill-text-size": `${mix(10, 9.1, typePhase).toFixed(1)}px`,
      "--skill-label-width": `${mix(95, 76, detailPhase).toFixed(1)}px`,
      "--skill-gap-y": `${mix(7, 4, spacePhase).toFixed(1)}px`,
      "--skill-gap-x": `${mix(20, 13, detailPhase).toFixed(1)}px`,
    } as React.CSSProperties;
  }, [style.density, style.fitLevel]);

  const updateContact = (key: keyof Omit<ResumeData, "sections">, value: string | boolean) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  const activateInlineText = (id: string, label: string, top: number) => {
    setActiveText({ id, label, top });
  };

  const inlineFontProps = (id: string, fontBase: string) => ({
    editId: id,
    fontAdjustment: style.fontAdjustments[id] || 0,
    fontBase,
    onActivate: activateInlineText,
  });

  const adjustActiveFont = (amount: number | "reset") => {
    if (!activeText) return;
    setStyle((current) => {
      const fontAdjustments = { ...current.fontAdjustments };
      if (amount === "reset") {
        delete fontAdjustments[activeText.id];
      } else {
        const currentValue = fontAdjustments[activeText.id] || 0;
        fontAdjustments[activeText.id] = Math.max(-4, Math.min(8, currentValue + amount));
      }
      return { ...current, fontAdjustments };
    });
  };

  const applyResumeTheme = (layout: ResumeLayout) => {
    const theme = getResumeTheme(layout);
    setStyle((current) => ({
      ...current,
      accent: theme.accent,
      density: theme.density,
      font: theme.font,
      layout: theme.id,
    }));
    setData((current) => {
      const priority = new Map(theme.sectionPriority.map((kind, index) => [kind, index]));
      const sections = current.sections
        .map((section, index) => ({ section, index }))
        .sort((left, right) => {
          const leftPriority = priority.get(left.section.kind) ?? theme.sectionPriority.length;
          const rightPriority = priority.get(right.section.kind) ?? theme.sectionPriority.length;
          return leftPriority - rightPriority || left.index - right.index;
        })
        .map(({ section }) => section);
      return { ...current, sections };
    });
    setActiveText(null);
  };

  const updateSection = (sectionId: string, patch: Partial<ResumeSection>) => {
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    }));
  };

  const updateEntry = (sectionId: string, entryId: string, patch: Partial<ResumeEntry>) => {
    setData((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? { ...section, entries: section.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)) }
          : section,
      ),
    }));
  };

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setData((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...current, sections };
    });
  };

  const dropSection = (targetId: string) => {
    const sourceId = draggedSection;
    setDraggedSection(null);
    if (!sourceId || sourceId === targetId) return;
    setData((current) => {
      const from = current.sections.findIndex((section) => section.id === sourceId);
      const to = current.sections.findIndex((section) => section.id === targetId);
      if (from < 0 || to < 0) return current;
      const sections = [...current.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...current, sections };
    });
  };

  const addSection = (kind: SectionKind) => {
    const template = sectionTemplates[kind];
    const section: ResumeSection = {
      id: makeId(),
      kind,
      title: template.title,
      entries: [{ ...template.entry, id: makeId(), bullets: [...template.entry.bullets] }],
    };
    setData((current) => ({ ...current, sections: [...current.sections, section] }));
  };

  const addEntry = (section: ResumeSection) => {
    const template = sectionTemplates[section.kind].entry;
    updateSection(section.id, {
      entries: [...section.entries, { ...template, id: makeId(), bullets: [...template.bullets] }],
    });
  };

  const removeEntry = (section: ResumeSection, entryId: string) => {
    updateSection(section.id, { entries: section.entries.filter((entry) => entry.id !== entryId) });
  };

  const updateBullet = (sectionId: string, entry: ResumeEntry, bulletIndex: number, value: string) => {
    const bullets = [...entry.bullets];
    bullets[bulletIndex] = value;
    updateEntry(sectionId, entry.id, { bullets });
  };

  const removeSection = (sectionId: string) => {
    setData((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== sectionId) }));
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPhotoError("");
    const reader = new FileReader();
    reader.onerror = () => {
      setPhotoError("That photo could not be read. Try another PNG or JPG.");
      input.value = "";
    };
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => {
        setPhotoError("That photo could not be opened. Try another PNG or JPG.");
        input.value = "";
      };
      image.onload = () => {
        const max = 600;
        const ratio = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        const context = canvas.getContext("2d");
        if (!context) {
          setPhotoError("Your browser could not prepare that photo.");
          input.value = "";
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        updateContact("photo", canvas.toDataURL("image/jpeg", 0.84));
        setStyle((current) => ({ ...current, showPhoto: true }));
        input.value = "";
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    updateContact("photo", "");
    setStyle((current) => ({ ...current, showPhoto: false }));
    setPhotoError("");
  };

  const downloadImage = async (format: "png" | "jpg") => {
    if (!resumeRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(resumeRef.current, {
        scale: exportScale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const extension = format === "png" ? "png" : "jpg";
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${safeFilename(data.name)}.${extension}`;
          link.click();
          URL.revokeObjectURL(link.href);
        },
        mime,
        format === "jpg" ? jpgQuality : undefined,
      );
    } finally {
      setExporting(false);
    }
  };

  const exportResume = async () => {
    if (exportFormat === "pdf") {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await waitForResumeLayout();
      if (style.fitLevel > 0 && getResumeContentHeight() > PRINT_SAFE_HEIGHT) {
        await autoFitToOnePage();
        await waitForResumeLayout();
      }
      window.print();
      return;
    }
    await downloadImage(exportFormat);
  };

  const resetResume = () => {
    setConfirmation({
      confirmLabel: "Reset resume",
      eyebrow: "Start over",
      message:
        "This replaces all content and style settings with the original starter. Your saved copy will not change until you click Save changes.",
      onConfirm: () => {
        setActiveText(null);
        setData(initialData);
        setStyle(initialStyle);
      },
      title: "Reset to the starter?",
      tone: "danger",
    });
  };

  const saveResume = () => {
    const snapshot = serializeWorkspace(data, style);
    try {
      window.localStorage.setItem("quick-resume", snapshot);
      lastSavedSnapshot.current = snapshot;
      setHasUnsavedChanges(false);
      setSaveError("");
    } catch {
      setSaveError("Saving failed on this device. Please try again.");
    }
  };

  const clearAllText = () => {
    setConfirmation({
      confirmLabel: "Clear all text",
      eyebrow: "Clear content",
      message:
        "Your section names, structure, selected style, and photo will stay in place. You can reload the page to undo this before saving.",
      onConfirm: () => {
        setActiveText(null);
        setData((current) => ({
          ...current,
          name: "",
          headline: "",
          email: "",
          phone: "",
          location: "",
          portfolio: "",
          secondaryLink: "",
          sections: current.sections.map((section) => ({
            ...section,
            entries: section.entries.map((entry) => ({
              ...entry,
              heading: "",
              subheading: "",
              date: "",
              details: "",
              bullets: entry.bullets.map(() => ""),
              ...(entry.link !== undefined ? { link: "" } : {}),
            })),
          })),
        }));
      },
      title: "Clear all resume text?",
      tone: "danger",
    });
  };

  const loadExample = () => {
    setConfirmation({
      confirmLabel: "Load example",
      eyebrow: "Default content",
      message:
        "This replaces the current resume content with the Tian Xing example while keeping your selected style. Nothing is saved until you click Save changes.",
      onConfirm: () => {
        setActiveText(null);
        setData(initialData);
      },
      title: "Load the example resume?",
      tone: "accent",
    });
  };

  const confirmCurrentAction = () => {
    const action = confirmation?.onConfirm;
    setConfirmation(null);
    action?.();
  };

  const waitForResumeLayout = () =>
    new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });

  const measureAtFitLevel = async (fitLevel: number) => {
    setStyle((current) => ({ ...current, fitLevel }));
    await waitForResumeLayout();
    return getResumeContentHeight() <= PRINT_SAFE_HEIGHT;
  };

  const autoFitToOnePage = async () => {
    setAutoFitting(true);
    try {
      if (await measureAtFitLevel(0)) return;
      if (!(await measureAtFitLevel(100))) return;

      let low = 0;
      let high = 100;
      for (let step = 0; step < 7; step += 1) {
        const middle = Math.ceil((low + high) / 2);
        if (await measureAtFitLevel(middle)) high = middle;
        else low = middle;
      }
      setStyle((current) => ({ ...current, fitLevel: high }));
    } finally {
      setAutoFitting(false);
    }
  };

  return (
    <main className="studio-shell">
      <header className="app-header no-print">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-glyph">
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="brand-copy">
            <div className="brand-title-row">
              <h1>Quicky Resume</h1>
              <span className="creator-credit">Built by Tian Xing</span>
            </div>
          </div>
        </div>
        <button
          aria-live="polite"
          className={`save-button${hasUnsavedChanges ? " unsaved" : ""}${saveError ? " error" : ""}`}
          disabled={!hasUnsavedChanges}
          onClick={saveResume}
          title={saveError || (hasUnsavedChanges ? "Save changes on this device" : "All changes are saved")}
          type="button"
        >
          <span className="save-dot" aria-hidden="true" />
          <span>{saveError ? "Try save again" : hasUnsavedChanges ? "Save changes" : "Saved"}</span>
        </button>
      </header>

      <div className="workspace">
        <aside className="editor-panel no-print">
          <nav className="tab-list" aria-label="Resume editor">
            {(["content", "style", "export"] as const).map((tab) => (
              <button
                className={activeTab === tab ? "tab active" : "tab"}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="editor-scroll">
            {activeTab === "content" && (
              <>
                <section className="panel-block">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Header</p>
                      <h2>Personal details</h2>
                    </div>
                    <div className="content-actions">
                      <button
                        className="example-button"
                        onClick={loadExample}
                        title="Load the default example resume"
                        type="button"
                      >
                        Example
                      </button>
                      <button
                        className="clear-all-button"
                        onClick={clearAllText}
                        title="Clear text while keeping sections and styling"
                        type="button"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                  <div className="field-grid two">
                    <label className="field">
                      <span>Name</span>
                      <input value={data.name} onChange={(event) => updateContact("name", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Headline</span>
                      <input value={data.headline} onChange={(event) => updateContact("headline", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input value={data.email} onChange={(event) => updateContact("email", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Phone</span>
                      <input value={data.phone} onChange={(event) => updateContact("phone", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Location</span>
                      <input placeholder="City, State" value={data.location} onChange={(event) => updateContact("location", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Portfolio</span>
                      <input value={data.portfolio} onChange={(event) => updateContact("portfolio", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Additional link</span>
                      <input value={data.secondaryLink} onChange={(event) => updateContact("secondaryLink", event.target.value)} />
                    </label>
                    <label className="field upload-field">
                      <span>Optional photo</span>
                      <input accept="image/png,image/jpeg" onChange={handlePhoto} type="file" />
                    </label>
                  </div>
                </section>

                <section className="panel-block">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Structure</p>
                      <h2>Resume sections</h2>
                    </div>
                    <span className="helper">Drag or use arrows</span>
                  </div>

                  <div className="section-stack">
                    {data.sections.map((section, sectionIndex) => (
                      <article
                        className={draggedSection === section.id ? "section-card dragging" : "section-card"}
                        key={section.id}
                        onDragOver={(event: DragEvent) => event.preventDefault()}
                        onDrop={() => dropSection(section.id)}
                      >
                        <div className="section-card-head">
                          <span
                            aria-label={`Drag ${section.title} to reorder`}
                            className="drag-handle"
                            draggable
                            onDragEnd={() => setDraggedSection(null)}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              setDraggedSection(section.id);
                            }}
                            role="button"
                            title="Drag to reorder"
                          >
                            ⋮⋮
                          </span>
                          <input
                            aria-label="Section title"
                            className="section-title-input"
                            value={section.title}
                            onChange={(event) => updateSection(section.id, { title: event.target.value })}
                          />
                          <div className="section-actions">
                            <button disabled={sectionIndex === 0} onClick={() => moveSection(section.id, -1)} title="Move up" type="button">↑</button>
                            <button disabled={sectionIndex === data.sections.length - 1} onClick={() => moveSection(section.id, 1)} title="Move down" type="button">↓</button>
                            <button className="danger-action" onClick={() => removeSection(section.id)} title="Remove section" type="button">×</button>
                          </div>
                        </div>

                        <div className="entry-stack">
                          {section.entries.map((entry, entryIndex) => (
                            <div className="entry-editor" key={entry.id}>
                              {section.kind !== "summary" && (
                                <div className="entry-editor-head">
                                  <span>Item {entryIndex + 1}</span>
                                  <button onClick={() => removeEntry(section, entry.id)} type="button">Remove</button>
                                </div>
                              )}

                              {section.kind !== "summary" && (
                                <div className="field-grid two">
                                  <label className="field">
                                    <span>{section.kind === "education" ? "School" : section.kind === "skills" ? "Category" : "Title"}</span>
                                    <input value={entry.heading} onChange={(event) => updateEntry(section.id, entry.id, { heading: event.target.value })} />
                                  </label>
                                  {section.kind !== "skills" && section.kind !== "awards" && (
                                    <label className="field">
                                      <span>{section.kind === "education" ? "Degree" : "Organization / role"}</span>
                                      <input value={entry.subheading} onChange={(event) => updateEntry(section.id, entry.id, { subheading: event.target.value })} />
                                    </label>
                                  )}
                                  {section.kind !== "skills" && (
                                    <label className="field">
                                      <span>Date</span>
                                      <input value={entry.date} onChange={(event) => updateEntry(section.id, entry.id, { date: event.target.value })} />
                                    </label>
                                  )}
                                  {section.kind === "projects" && (
                                    <label className="field">
                                      <span>Link</span>
                                      <input value={entry.link || ""} onChange={(event) => updateEntry(section.id, entry.id, { link: event.target.value })} />
                                    </label>
                                  )}
                                </div>
                              )}

                              <label className="field">
                                <span>{section.kind === "summary" ? "Summary" : section.kind === "skills" ? "Skills" : "Details"}</span>
                                <textarea
                                  rows={section.kind === "summary" ? 5 : 2}
                                  value={entry.details}
                                  onChange={(event) => updateEntry(section.id, entry.id, { details: event.target.value })}
                                />
                              </label>

                              {(section.kind === "experience" || section.kind === "projects" || section.kind === "custom") && (
                                <label className="field">
                                  <span>Bullets <small>one per line</small></span>
                                  <textarea
                                    rows={3}
                                    value={entry.bullets.join("\n")}
                                    onChange={(event) => updateEntry(section.id, entry.id, { bullets: event.target.value.split("\n") })}
                                  />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>

                        {section.kind !== "summary" && (
                          <button className="text-button" onClick={() => addEntry(section)} type="button">+ Add item</button>
                        )}
                      </article>
                    ))}
                  </div>

                  <div className="add-section-row">
                    <label className="field">
                      <span>Add another section</span>
                      <select defaultValue="" onChange={(event) => {
                        if (event.target.value) addSection(event.target.value as SectionKind);
                        event.target.value = "";
                      }}>
                        <option disabled value="">Choose a section…</option>
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
              </>
            )}

            {activeTab === "style" && (
              <section className="panel-block style-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Presentation</p>
                    <h2>Choose your layout</h2>
                  </div>
                </div>

                <fieldset className="choice-group">
                  <legend>Research-backed layouts</legend>
                  <div className="theme-grid">
                    {resumeThemes.map((theme) => (
                      <button
                        aria-pressed={style.layout === theme.id}
                        className={style.layout === theme.id ? "theme-card selected" : "theme-card"}
                        key={theme.id}
                        onClick={() => applyResumeTheme(theme.id)}
                        type="button"
                      >
                        <span aria-hidden="true" className={`theme-swatch theme-swatch-${theme.id}`}>
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="theme-card-copy">
                          <strong>{theme.label}</strong>
                          <small>{theme.bestFor}</small>
                          <span>{theme.description}</span>
                        </span>
                        <span aria-hidden="true" className="theme-check">✓</span>
                      </button>
                    ))}
                  </div>
                  <p className="theme-guidance">
                    All five keep standard headings, readable type, and a single-column content flow.
                    Choosing one also arranges sections around that job context; you can still reorder them.
                  </p>
                </fieldset>

                <fieldset className="choice-group">
                  <legend>Fine-tune typeface</legend>
                  <div className="choice-grid">
                    {([
                      ["modern", "Modern", "Clear and ATS-friendly"],
                      ["classic", "Classic", "Editorial and traditional"],
                      ["humanist", "Humanist", "Warm and approachable"],
                    ] as const).map(([value, label, note]) => (
                      <label className={style.font === value ? "choice-card selected" : "choice-card"} key={value}>
                        <input
                          checked={style.font === value}
                          name="font"
                          onChange={() => setStyle((current) => ({ ...current, font: value }))}
                          type="radio"
                        />
                        <strong>{label}</strong>
                        <span>{note}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="choice-group">
                  <legend>Spacing</legend>
                  <div className="segmented">
                    {(["comfortable", "compact"] as const).map((value) => (
                      <button
                        className={style.density === value ? "selected" : ""}
                        key={value}
                        onClick={() => setStyle((current) => ({ ...current, density: value }))}
                        type="button"
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="field color-field">
                  <span>Accent color</span>
                  <div>
                    <input
                      aria-label="Accent color"
                      type="color"
                      value={style.accent}
                      onChange={(event) => setStyle((current) => ({ ...current, accent: event.target.value }))}
                    />
                    <input
                      value={style.accent}
                      onChange={(event) => setStyle((current) => ({ ...current, accent: event.target.value }))}
                    />
                  </div>
                </label>

                <div className="photo-control-card">
                  <div className="photo-control-heading">
                    {data.photo ? (
                      <img alt={`${data.name} photo preview`} height="54" src={data.photo} width="54" />
                    ) : (
                      <span aria-hidden="true" className="photo-placeholder">Photo</span>
                    )}
                    <span>
                      <strong>Resume photo</strong>
                      <small>PNG or JPG; cropped automatically</small>
                    </span>
                  </div>
                  <div className="photo-action-row">
                    <label className="photo-upload-action">
                      {data.photo ? "Replace photo" : "Upload photo"}
                      <input accept="image/png,image/jpeg" onChange={handlePhoto} type="file" />
                    </label>
                    {data.photo && (
                      <button className="photo-remove-action" onClick={removePhoto} type="button">
                        Remove
                      </button>
                    )}
                  </div>
                  {photoError && <p className="photo-error" role="alert">{photoError}</p>}
                  <label className="toggle-row photo-toggle">
                    <span>
                      <strong>Show photo</strong>
                      <small>{data.photo ? "Include the uploaded photo" : "Upload a photo to enable this"}</small>
                    </span>
                    <input
                      checked={style.showPhoto && Boolean(data.photo)}
                      disabled={!data.photo}
                      onChange={(event) => setStyle((current) => ({ ...current, showPhoto: event.target.checked }))}
                      type="checkbox"
                    />
                  </label>
                </div>

                <button className="secondary-button" onClick={resetResume} type="button">Reset starter content</button>
              </section>
            )}

            {activeTab === "export" && (
              <section className="panel-block export-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Output</p>
                    <h2>Download your resume</h2>
                  </div>
                </div>

                <div className="smart-fit-card">
                  <div className="smart-fit-heading">
                    <span>
                      <strong>Smart one-page fit</strong>
                      <small>Spacing first, typography last</small>
                    </span>
                    <output>{style.fitLevel}%</output>
                  </div>
                  <input
                    aria-label="Smart one-page fit strength"
                    className="smart-fit-slider"
                    disabled={autoFitting}
                    max="100"
                    min="0"
                    onChange={(event) =>
                      setStyle((current) => ({ ...current, fitLevel: Number(event.target.value) }))
                    }
                    step="1"
                    type="range"
                    value={style.fitLevel}
                  />
                  <div className="smart-fit-scale">
                    <span>Roomy</span>
                    <span className={pageCount === 1 ? "fit-status success" : "fit-status"}>
                      {pageCount === 1 ? "Fits one page" : `${pageCount} pages`}
                    </span>
                    <span>Maximum fit</span>
                  </div>
                  <button
                    className="fit-action"
                    disabled={autoFitting}
                    onClick={autoFitToOnePage}
                    type="button"
                  >
                    {autoFitting ? "Finding the best fit…" : "Find the lightest one-page fit"}
                  </button>
                  <p>
                    Nothing is removed. Smart fit tightens gaps and margins before making small,
                    readability-safe type adjustments.
                  </p>
                </div>

                <div className="format-grid" role="radiogroup" aria-label="Export format">
                  {([
                    ["pdf", "PDF", "Best for applications"],
                    ["png", "PNG", "Sharp image"],
                    ["jpg", "JPG", "Smaller image"],
                  ] as const).map(([value, label, note]) => (
                    <button
                      aria-checked={exportFormat === value}
                      className={exportFormat === value ? "format-card selected" : "format-card"}
                      key={value}
                      onClick={() => setExportFormat(value)}
                      role="radio"
                      type="button"
                    >
                      <strong>{label}</strong>
                      <span>{note}</span>
                    </button>
                  ))}
                </div>

                {exportFormat !== "pdf" && (
                  <label className="field range-field">
                    <span>Image resolution <strong>{exportScale}×</strong></span>
                    <input
                      max="3"
                      min="1"
                      onChange={(event) => setExportScale(Number(event.target.value))}
                      step="1"
                      type="range"
                      value={exportScale}
                    />
                  </label>
                )}

                {exportFormat === "jpg" && (
                  <label className="field range-field">
                    <span>JPG quality <strong>{Math.round(jpgQuality * 100)}%</strong></span>
                    <input
                      max="0.98"
                      min="0.55"
                      onChange={(event) => setJpgQuality(Number(event.target.value))}
                      step="0.01"
                      type="range"
                      value={jpgQuality}
                    />
                  </label>
                )}

                <div className="estimate-card">
                  <div>
                    <span>Approximate file size</span>
                    <strong>≈ {formatBytes(estimatedBytes)}</strong>
                  </div>
                  <div>
                    <span>Document length</span>
                    <strong>{pageCount} {pageCount === 1 ? "page" : "pages"}</strong>
                  </div>
                </div>

                {exportFormat === "pdf" && (
                  <p className="export-note">
                    PDF opens the print dialog. Choose “Save as PDF” for selectable text and better applicant-system compatibility.
                  </p>
                )}

                <button className="primary-button" disabled={exporting} onClick={exportResume} type="button">
                  {exporting ? "Preparing file…" : exportFormat === "pdf" ? "Open PDF export" : `Download ${exportFormat.toUpperCase()}`}
                </button>
                <p className="fine-print">The estimate changes with format, resolution, content, and photos. Final size may vary.</p>
              </section>
            )}
          </div>
        </aside>

        <section
          className="preview-stage"
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (!target.closest("[data-inline-edit], [data-font-tools]")) setActiveText(null);
          }}
        >
          <div className="preview-toolbar no-print">
            <span>{pageCount} {pageCount === 1 ? "page" : "pages"}</span>
          </div>

          <div className="paper-wrap">
            <div
              className={`resume-paper layout-${style.layout} font-${style.font} density-${style.density}`}
              ref={resumeRef}
              style={{ "--resume-accent": style.accent, ...resumeFitVariables } as React.CSSProperties}
            >
              <header className={style.showPhoto && data.photo ? "resume-header with-photo" : "resume-header"}>
                <div>
                  <InlineEdit
                    {...inlineFontProps("contact:name", "var(--name-size, 34px)")}
                    as="h2"
                    label="Name"
                    onCommit={(value) => updateContact("name", value)}
                    placeholder="Your Name"
                    value={data.name}
                  />
                  <InlineEdit
                    {...inlineFontProps("contact:headline", "var(--headline-size, 13px)")}
                    as="p"
                    className="resume-headline"
                    label="Professional headline"
                    onCommit={(value) => updateContact("headline", value)}
                    placeholder="Professional headline"
                    value={data.headline}
                  />
                  <div className="contact-line">
                    {([
                      ["email", data.email],
                      ["phone", data.phone],
                      ["location", data.location],
                      ["portfolio", data.portfolio],
                      ["secondaryLink", data.secondaryLink],
                    ] as const)
                      .filter(Boolean)
                      .filter(([, item]) => Boolean(item))
                      .map(([key, item]) => (
                        <InlineEdit
                          {...inlineFontProps(`contact:${key}`, "var(--contact-size, 10px)")}
                          as="span"
                          key={key}
                          label={key === "secondaryLink" ? "Additional link" : key}
                          onCommit={(value) => updateContact(key, value)}
                          value={item}
                        />
                      ))}
                  </div>
                </div>
                {style.showPhoto && data.photo && (
                  <img
                    alt={`${data.name} portrait`}
                    height={82}
                    src={data.photo}
                    width={82}
                  />
                )}
              </header>

              <div className="resume-body">
                {data.sections.map((section) => (
                  <section className={`resume-section kind-${section.kind}`} key={section.id}>
                    <InlineEdit
                      {...inlineFontProps(`section:${section.id}:title`, "var(--section-title-size, 11px)")}
                      as="h3"
                      label={`${section.title} section title`}
                      onCommit={(value) => updateSection(section.id, { title: value })}
                      placeholder="Section title"
                      value={section.title}
                    />

                    {section.kind === "summary" ? (
                      <InlineEdit
                        {...inlineFontProps(
                          `entry:${section.entries[0]?.id || section.id}:details`,
                          "var(--paper-font-size, 12px)",
                        )}
                        as="p"
                        className="summary-text"
                        label="Professional summary"
                        multiline
                        onCommit={(value) => {
                          const entry = section.entries[0];
                          if (entry) updateEntry(section.id, entry.id, { details: value });
                        }}
                        placeholder="Click to write a professional summary"
                        value={section.entries[0]?.details || ""}
                      />
                    ) : section.kind === "skills" ? (
                      <div className="skill-list">
                        {section.entries.map((entry) => (
                          <div className="skill-row" key={entry.id}>
                            <InlineEdit
                              {...inlineFontProps(`entry:${entry.id}:heading`, "var(--skill-text-size, 10px)")}
                              as="strong"
                              label="Skill category"
                              onCommit={(value) => updateEntry(section.id, entry.id, { heading: value })}
                              placeholder="Category"
                              value={entry.heading}
                            />
                            <InlineEdit
                              {...inlineFontProps(`entry:${entry.id}:details`, "var(--skill-text-size, 10px)")}
                              as="span"
                              label={`${entry.heading || "Skill"} details`}
                              onCommit={(value) => updateEntry(section.id, entry.id, { details: value })}
                              placeholder="Skills"
                              value={entry.details}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="resume-entry-list">
                        {section.entries.map((entry) => (
                          <article className="resume-entry" key={entry.id}>
                            <div className="resume-entry-heading">
                              <div>
                                <InlineEdit
                                  {...inlineFontProps(`entry:${entry.id}:heading`, "var(--entry-title-size, 13px)")}
                                  as="h4"
                                  label={`${section.title} item title`}
                                  onCommit={(value) => updateEntry(section.id, entry.id, { heading: value })}
                                  placeholder="Item title"
                                  value={entry.heading}
                                />
                                {entry.subheading && (
                                  <InlineEdit
                                    {...inlineFontProps(
                                      `entry:${entry.id}:subheading`,
                                      "var(--entry-subtitle-size, 11px)",
                                    )}
                                    as="p"
                                    label={`${entry.heading} supporting information`}
                                    onCommit={(value) => updateEntry(section.id, entry.id, { subheading: value })}
                                    value={entry.subheading}
                                  />
                                )}
                              </div>
                              {entry.date && (
                                <InlineEdit
                                  {...inlineFontProps(`entry:${entry.id}:date`, "var(--entry-date-size, 10px)")}
                                  as="time"
                                  label={`${entry.heading} date`}
                                  onCommit={(value) => updateEntry(section.id, entry.id, { date: value })}
                                  value={entry.date}
                                />
                              )}
                            </div>
                            {entry.link && (
                              <InlineEdit
                                {...inlineFontProps(`entry:${entry.id}:link`, "var(--entry-link-size, 9.5px)")}
                                as="p"
                                className="entry-link"
                                label={`${entry.heading} link`}
                                onCommit={(value) => updateEntry(section.id, entry.id, { link: value })}
                                value={entry.link}
                              />
                            )}
                            {entry.details && (
                              <InlineEdit
                                {...inlineFontProps(`entry:${entry.id}:details`, "var(--entry-text-size, 10.5px)")}
                                as="p"
                                className="entry-details"
                                label={`${entry.heading} details`}
                                multiline
                                onCommit={(value) => updateEntry(section.id, entry.id, { details: value })}
                                value={entry.details}
                              />
                            )}
                            {entry.bullets.some((bullet) => bullet.trim()) && (
                              <ul>
                                {entry.bullets.map((bullet, index) =>
                                  bullet.trim() ? (
                                    <InlineEdit
                                      {...inlineFontProps(
                                        `entry:${entry.id}:bullet:${index}`,
                                        "var(--entry-text-size, 10.5px)",
                                      )}
                                      as="li"
                                      key={index}
                                      label={`${entry.heading} bullet ${index + 1}`}
                                      multiline
                                      onCommit={(value) => updateBullet(section.id, entry, index, value)}
                                      value={bullet}
                                    />
                                  ) : null,
                                )}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
              {activeText && (
                <div
                  aria-label={`Font size controls for ${activeText.label}`}
                  className="inline-font-tools no-print"
                  data-font-tools=""
                  data-html2canvas-ignore="true"
                  onMouseDown={(event) => event.preventDefault()}
                  role="group"
                  style={{ top: `${activeText.top}px` }}
                >
                  <button
                    aria-label={`Decrease font size for ${activeText.label}`}
                    onClick={() => adjustActiveFont(-1)}
                    title="Decrease font size"
                    type="button"
                  >
                    −
                  </button>
                  <button
                    aria-label={`Increase font size for ${activeText.label}`}
                    onClick={() => adjustActiveFont(1)}
                    title="Increase font size"
                    type="button"
                  >
                    +
                  </button>
                  <button
                    aria-label={`Reset font size for ${activeText.label}`}
                    disabled={!style.fontAdjustments[activeText.id]}
                    onClick={() => adjustActiveFont("reset")}
                    title="Reset font size"
                    type="button"
                  >
                    ↺
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {confirmation && (
        <dialog
          aria-labelledby="confirmation-title"
          className={`confirmation-dialog no-print tone-${confirmation.tone}`}
          onCancel={(event) => {
            event.preventDefault();
            setConfirmation(null);
          }}
          ref={confirmationDialogRef}
        >
          <div className="confirmation-heading">
            <span className="confirmation-symbol" aria-hidden="true">
              <i />
              <i />
            </span>
            <div>
              <p className="eyebrow">{confirmation.eyebrow}</p>
              <h2 id="confirmation-title">{confirmation.title}</h2>
            </div>
          </div>
          <p className="confirmation-message">{confirmation.message}</p>
          <div className="confirmation-actions">
            <button
              className="confirmation-cancel"
              onClick={() => setConfirmation(null)}
              ref={confirmationCancelRef}
              type="button"
            >
              Keep editing
            </button>
            <button className="confirmation-accept" onClick={confirmCurrentAction} type="button">
              {confirmation.confirmLabel}
            </button>
          </div>
        </dialog>
      )}

      <details className="version-widget no-print">
        <summary aria-label="Open the Quicky Resume version 0.2.4 changelog">v0.2.4</summary>
        <aside className="changelog-card" aria-label="Quicky Resume changelog">
          <div className="changelog-heading">
            <div>
              <p className="eyebrow">Product updates</p>
              <h2>Changelog</h2>
            </div>
            <span>Latest</span>
          </div>
          <section className="changelog-release">
            <div>
              <strong>v0.2.4</strong>
              <time dateTime="2026-07-28">Jul 28, 2026</time>
            </div>
            <ul>
              <li>Branded confirmation dialogs</li>
              <li>HVD Peace wordmark and simplified header</li>
            </ul>
          </section>
          <section className="changelog-release">
            <div>
              <strong>v0.2.3</strong>
              <time dateTime="2026-07-28">Jul 28, 2026</time>
            </div>
            <ul>
              <li>Default example action added to Content</li>
              <li>Simplified preview toolbar</li>
            </ul>
          </section>
          <section className="changelog-release">
            <div>
              <strong>v0.2.2</strong>
              <time dateTime="2026-07-28">Jul 28, 2026</time>
            </div>
            <ul>
              <li>Manual save button replaces automatic saving</li>
              <li>Unsaved-change status and leave-page warning</li>
            </ul>
          </section>
          <section className="changelog-release">
            <div>
              <strong>v0.2.1</strong>
              <time dateTime="2026-07-28">Jul 28, 2026</time>
            </div>
            <ul>
              <li>Clear all resume text while preserving sections</li>
              <li>Revised Tian Xing starter resume</li>
            </ul>
          </section>
          <section className="changelog-release">
            <div>
              <strong>v0.2.0</strong>
              <time dateTime="2026-07-28">Jul 28, 2026</time>
            </div>
            <ul>
              <li>New artistic Quicky Resume brand mark</li>
              <li>Creator credit and in-app version history</li>
              <li>Latest Tian Xing resume added as the starter</li>
            </ul>
          </section>
          <section className="changelog-release">
            <div>
              <strong>v0.1.0</strong>
              <time dateTime="2026-07-27">Jul 27, 2026</time>
            </div>
            <ul>
              <li>Five professional resume layouts</li>
              <li>Inline editing, smart one-page fit, and exports</li>
            </ul>
          </section>
          <p className="font-credit">
            HVD Peace by{" "}
            <a href="https://www.fontspace.com/hvd-peace-font-f23071" rel="noreferrer" target="_blank">
              HVD Fonts
            </a>
            {" "}· CC BY 3.0
          </p>
        </aside>
      </details>
    </main>
  );
}
