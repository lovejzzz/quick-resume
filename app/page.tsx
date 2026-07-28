"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ConfirmationDialog, type ConfirmationRequest } from "./components/ConfirmationDialog";
import { ContentPanel } from "./components/ContentPanel";
import { ExportPanel, type ExportFormat } from "./components/ExportPanel";
import { ResumePaper, type ActiveText } from "./components/ResumePaper";
import { StylePanel } from "./components/StylePanel";
import { VersionWidget } from "./components/VersionWidget";
import { useWorkspace } from "./hooks/useWorkspace";
import { PHOTO_GAP, PHOTO_SIZE, safeFilename } from "./lib/fit";
import { getPageGeometry } from "./lib/page-size";
import { tianXingExample } from "./examples/tian-xing";
import type { ResumeData, ResumeEntry, ResumeLayout, ResumeSection } from "./lib/resume-model";
import { getResumeTheme } from "./lib/resume-themes";
import { defaultStyle } from "./lib/storage";

type PhotoDragSession = {
  frame: number | null;
  paperHeight: number;
  paperWidth: number;
  pointerId: number;
  scale: number;
  startClientX: number;
  startClientY: number;
  x: number;
  y: number;
};

type Tab = "content" | "style" | "export";

const TABS: Tab[] = ["content", "style", "export"];

export default function Home() {
  const workspace = useWorkspace();
  const { activeDocument, setData, setStyle } = workspace;
  const data = activeDocument?.data ?? tianXingExample;
  const style = activeDocument?.style ?? defaultStyle;

  const [activeTab, setActiveTab] = useState<Tab>("style");
  const [exporting, setExporting] = useState(false);
  const [autoFitting, setAutoFitting] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [draggingPhoto, setDraggingPhoto] = useState(false);
  const [activeContentAnchor, setActiveContentAnchor] = useState("identity");
  const [activeText, setActiveText] = useState<ActiveText | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);

  const resumeRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLElement>(null);
  const paperViewportRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLButtonElement>(null);
  const photoDragRef = useRef<PhotoDragSession | null>(null);
  const contentScrollTarget = useRef<string | null>(null);
  const contentScrollTimer = useRef<number | null>(null);

  const geometry = getPageGeometry(style.pageSize);

  /* ------------------------------------------------------------ page setup */

  // `@page size` cannot read a CSS custom property, so the rule is swapped out
  // whenever the user changes paper size.
  useEffect(() => {
    const element = document.createElement("style");
    element.setAttribute("data-page-size", "");
    element.textContent = `@page { size: ${geometry.cssSize}; margin: 0; }`;
    document.head.appendChild(element);
    return () => element.remove();
  }, [geometry.cssSize]);

  /* --------------------------------------------------------- measurement */

  const getResumeContentHeight = useCallback(() => {
    const paper = resumeRef.current;
    const body = paper?.querySelector<HTMLElement>(".resume-body");
    if (!paper || !body) return 0;
    const paperBox = paper.getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const photoBox = photoRef.current?.getBoundingClientRect();
    const paperStyle = window.getComputedStyle(paper);
    const paddingBottom = Number.parseFloat(paperStyle.paddingBottom) || 0;
    const scale = paper.offsetWidth / paperBox.width || 1;
    const bodyBottom = (bodyBox.bottom - paperBox.top) * scale + paddingBottom;
    const photoBottom = photoBox ? (photoBox.bottom - paperBox.top) * scale : 0;
    return Math.max(bodyBottom, photoBottom);
  }, []);

  useEffect(() => {
    const updatePages = () => {
      if (!resumeRef.current) return;
      const height = getResumeContentHeight();
      setPageCount(
        height <= geometry.printSafeHeightPx ? 1 : Math.ceil(height / geometry.printSafeHeightPx),
      );
    };
    updatePages();
    const observer = new ResizeObserver(updatePages);
    if (resumeRef.current) observer.observe(resumeRef.current);
    return () => observer.disconnect();
  }, [data, geometry.printSafeHeightPx, getResumeContentHeight, style]);

  useEffect(() => {
    const stage = previewStageRef.current;
    const viewport = paperViewportRef.current;
    const paper = resumeRef.current;
    if (!stage || !viewport || !paper) return;

    const updatePreviewScale = () => {
      const stageStyle = window.getComputedStyle(stage);
      const availableWidth =
        stage.clientWidth -
        (Number.parseFloat(stageStyle.paddingLeft) || 0) -
        (Number.parseFloat(stageStyle.paddingRight) || 0);
      const scale = Math.max(0.34, Math.min(1, availableWidth / geometry.widthPx));
      viewport.style.setProperty("--preview-scale", scale.toFixed(4));
      viewport.style.height = `${Math.ceil(paper.scrollHeight * scale)}px`;
    };

    const frame = window.requestAnimationFrame(updatePreviewScale);
    const observer = new ResizeObserver(updatePreviewScale);
    observer.observe(stage);
    observer.observe(paper);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [data, geometry.widthPx, style]);

  /* -------------------------------------------------------------- photo */

  const clearPhotoFlow = useCallback(() => {
    const paper = resumeRef.current;
    if (!paper) return;
    paper.querySelectorAll<HTMLElement>("[data-photo-flow]").forEach((target) => {
      target.style.removeProperty("--photo-flow-left");
      target.style.removeProperty("--photo-flow-right");
      target.removeAttribute("data-photo-obstructed");
      target.removeAttribute("data-photo-side");
    });
  }, []);

  const applyPhotoFlow = useCallback(
    (x: number, y: number) => {
      const paper = resumeRef.current;
      const photo = photoRef.current;
      if (!paper || !photo || !style.showPhoto || !data.photo) {
        clearPhotoFlow();
        return;
      }

      photo.style.left = `${x}px`;
      photo.style.top = `${y}px`;
      const previousSides = new Map<HTMLElement, string | null>();
      paper.querySelectorAll<HTMLElement>("[data-photo-flow]").forEach((target) => {
        previousSides.set(target, target.getAttribute("data-photo-side"));
      });
      // On drop, text transitions are enabled again. Clearing the old margins
      // while they can animate makes getBoundingClientRect() observe an
      // in-between position and produces an almost-zero replacement margin.
      // Disable transitions for this synchronous clear/measure/apply pass so
      // the geometry is always based on the unwrapped document.
      paper.classList.add("photo-flow-measuring");
      try {
        clearPhotoFlow();

        const paperBox = paper.getBoundingClientRect();
        const scale = paper.offsetWidth / paperBox.width || 1;
        const photoRight = x + PHOTO_SIZE;
        const photoBottom = y + PHOTO_SIZE;

        for (const target of Array.from(paper.querySelectorAll<HTMLElement>("[data-photo-flow]"))) {
          const box = target.getBoundingClientRect();
          const left = (box.left - paperBox.left) * scale;
          const right = (box.right - paperBox.left) * scale;
          const top = (box.top - paperBox.top) * scale;
          const bottom = (box.bottom - paperBox.top) * scale;
          if (!(photoBottom + PHOTO_GAP > top && y - PHOTO_GAP < bottom)) continue;
          if (!(photoRight + PHOTO_GAP > left && x - PHOTO_GAP < right)) continue;

          const availableLeft = Math.max(0, x - PHOTO_GAP - left);
          const availableRight = Math.max(0, right - photoRight - PHOTO_GAP);
          const minimumReadableWidth = Math.min(190, (right - left) * 0.44);
          const previousSide = previousSides.get(target);
          const sideSwitchThreshold = 96;
          let useRight = availableRight >= availableLeft;
          if (
            previousSide === "right" &&
            availableRight >= minimumReadableWidth &&
            availableLeft - availableRight < sideSwitchThreshold
          ) {
            useRight = true;
          } else if (
            previousSide === "left" &&
            availableLeft >= minimumReadableWidth &&
            availableRight - availableLeft < sideSwitchThreshold
          ) {
            useRight = false;
          }
          if ((useRight ? availableRight : availableLeft) < minimumReadableWidth) continue;

          if (useRight) {
            target.style.setProperty("--photo-flow-left", `${Math.max(0, photoRight + PHOTO_GAP - left)}px`);
            target.setAttribute("data-photo-side", "right");
          } else {
            target.style.setProperty("--photo-flow-right", `${Math.max(0, right - x + PHOTO_GAP)}px`);
            target.setAttribute("data-photo-side", "left");
          }
          target.setAttribute("data-photo-obstructed", "true");
        }
      } finally {
        paper.classList.remove("photo-flow-measuring");
      }
    },
    [clearPhotoFlow, data.photo, style.showPhoto],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (style.showPhoto && data.photo) applyPhotoFlow(style.photoX, style.photoY);
      else clearPhotoFlow();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [applyPhotoFlow, clearPhotoFlow, data.photo, style.photoX, style.photoY, style.showPhoto]);

  const photoBounds = useCallback(
    () => ({
      height: Math.max(geometry.heightPx, resumeRef.current?.scrollHeight || geometry.heightPx),
      width: resumeRef.current?.offsetWidth || geometry.widthPx,
    }),
    [geometry.heightPx, geometry.widthPx],
  );

  const clampPhoto = (x: number, y: number, width: number, height: number) => ({
    x: Math.max(0, Math.min(width - PHOTO_SIZE, x)),
    y: Math.max(0, Math.min(height - PHOTO_SIZE, y)),
  });

  const movePhotoTo = useCallback(
    (x: number, y: number) => {
      const bounds = photoBounds();
      const next = clampPhoto(x, y, bounds.width, bounds.height);
      setStyle((current) => ({ ...current, photoX: next.x, photoY: next.y }));
    },
    [photoBounds, setStyle],
  );

  const placePhoto = (placement: "left" | "center" | "right") => {
    const { width } = photoBounds();
    const x =
      placement === "left" ? 54 : placement === "right" ? width - PHOTO_SIZE - 54 : (width - PHOTO_SIZE) / 2;
    movePhotoTo(x, 58);
  };

  const startPhotoDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const paper = resumeRef.current;
    if (!paper) return;
    const paperBox = paper.getBoundingClientRect();
    const bounds = photoBounds();
    photoDragRef.current = {
      frame: null,
      paperHeight: bounds.height,
      paperWidth: bounds.width,
      pointerId: event.pointerId,
      scale: paper.offsetWidth / paperBox.width || 1,
      startClientX: event.clientX,
      startClientY: event.clientY,
      x: style.photoX,
      y: style.photoY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setActiveText(null);
    setDraggingPhoto(true);
  };

  const movePhotoPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = photoDragRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    const next = clampPhoto(
      style.photoX + (event.clientX - session.startClientX) * session.scale,
      style.photoY + (event.clientY - session.startClientY) * session.scale,
      session.paperWidth,
      session.paperHeight,
    );
    session.x = next.x;
    session.y = next.y;
    if (session.frame !== null) return;
    session.frame = window.requestAnimationFrame(() => {
      session.frame = null;
      applyPhotoFlow(session.x, session.y);
    });
  };

  const finishPhotoDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = photoDragRef.current;
    if (!session || event.pointerId !== session.pointerId) return;
    if (session.frame !== null) window.cancelAnimationFrame(session.frame);
    applyPhotoFlow(session.x, session.y);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    photoDragRef.current = null;
    setDraggingPhoto(false);
    setStyle((current) => ({ ...current, photoX: session.x, photoY: session.y }));
  };

  const movePhotoWithKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, [number, number]> = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const distance = event.shiftKey ? 20 : 4;
    movePhotoTo(style.photoX + direction[0] * distance, style.photoY + direction[1] * distance);
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
        setData((current) => ({ ...current, photo: canvas.toDataURL("image/jpeg", 0.84) }));
        setStyle((current) => ({ ...current, showPhoto: true }));
        input.value = "";
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  /* --------------------------------------------------------------- editing */

  const updateContact = useCallback(
    (key: keyof Omit<ResumeData, "sections">, value: string) => {
      setData((current) => ({ ...current, [key]: value }));
    },
    [setData],
  );

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<ResumeSection>) => {
      setData((current) => ({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      }));
    },
    [setData],
  );

  const updateEntry = useCallback(
    (sectionId: string, entryId: string, patch: Partial<ResumeEntry>) => {
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
    },
    [setData],
  );

  const adjustActiveFont = (amount: number | "reset") => {
    if (!activeText) return;
    setStyle((current) => {
      const fontAdjustments = { ...current.fontAdjustments };
      if (amount === "reset") delete fontAdjustments[activeText.id];
      else {
        const value = fontAdjustments[activeText.id] || 0;
        fontAdjustments[activeText.id] = Math.max(-4, Math.min(8, value + amount));
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
      resumeFont: theme.resumeFont,
    }));
    setData((current) => {
      const priority = new Map(theme.sectionPriority.map((kind, index) => [kind, index]));
      return {
        ...current,
        sections: current.sections
          .map((section, index) => ({ section, index }))
          .sort(
            (left, right) =>
              (priority.get(left.section.kind) ?? theme.sectionPriority.length) -
                (priority.get(right.section.kind) ?? theme.sectionPriority.length) ||
              left.index - right.index,
          )
          .map(({ section }) => section),
      };
    });
    setActiveText(null);
  };

  /* ------------------------------------------------------- content anchors */

  const syncContentAnchor = useCallback(() => {
    const container = editorScrollRef.current;
    if (!container) return;
    const guide = container.getBoundingClientRect().top + 118;
    const anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-content-anchor]"));
    if (!anchors.length) return;
    let active = anchors[0];
    for (const anchor of anchors) {
      if (anchor.getBoundingClientRect().top <= guide) active = anchor;
      else break;
    }
    setActiveContentAnchor((current) =>
      current === active.dataset.contentAnchor ? current : active.dataset.contentAnchor || "identity",
    );
  }, []);

  useEffect(() => {
    if (activeTab !== "content") return;
    const container = editorScrollRef.current;
    if (!container) return;

    const release = () => {
      contentScrollTarget.current = null;
      if (contentScrollTimer.current !== null) window.clearTimeout(contentScrollTimer.current);
      contentScrollTimer.current = null;
      syncContentAnchor();
    };
    const handleScroll = () => {
      if (!contentScrollTarget.current) {
        syncContentAnchor();
        return;
      }
      if (contentScrollTimer.current !== null) window.clearTimeout(contentScrollTimer.current);
      contentScrollTimer.current = window.setTimeout(release, 140);
    };
    const interrupt = () => {
      if (contentScrollTarget.current) release();
    };

    const frame = window.requestAnimationFrame(() => {
      if (!contentScrollTarget.current) syncContentAnchor();
    });
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("scrollend", release);
    container.addEventListener("wheel", interrupt, { passive: true });
    container.addEventListener("touchstart", interrupt, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      if (contentScrollTimer.current !== null) window.clearTimeout(contentScrollTimer.current);
      contentScrollTimer.current = null;
      contentScrollTarget.current = null;
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("scrollend", release);
      container.removeEventListener("wheel", interrupt);
      container.removeEventListener("touchstart", interrupt);
    };
  }, [activeTab, data.sections, syncContentAnchor]);

  const scrollContentTo = (anchor: string) => {
    const container = editorScrollRef.current;
    const target =
      anchor === "identity"
        ? document.getElementById("content-identity")
        : anchor === "add-section"
          ? document.getElementById("content-add-section")
          : document.getElementById(`content-section-${anchor}`);
    if (!container || !target) return;
    const top =
      target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 12;
    contentScrollTarget.current = anchor;
    if (contentScrollTimer.current !== null) window.clearTimeout(contentScrollTimer.current);
    contentScrollTimer.current = window.setTimeout(() => {
      contentScrollTarget.current = null;
      contentScrollTimer.current = null;
      syncContentAnchor();
    }, 900);
    container.scrollTo({ top, behavior: "smooth" });
    setActiveContentAnchor(anchor);
  };

  /* ----------------------------------------------------------------- fit */

  const waitForLayout = () =>
    new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
    });

  const measureAtFitLevel = async (fitLevel: number) => {
    setStyle((current) => ({ ...current, fitLevel }));
    await waitForLayout();
    return getResumeContentHeight() <= geometry.printSafeHeightPx;
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

  /* -------------------------------------------------------------- export */

  const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    // Revoking synchronously can cancel the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  };

  const handleExport = async (format: ExportFormat, options: { scale: number; quality: number }) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setActiveText(null);

    if (format === "pdf") {
      await waitForLayout();
      if (style.fitLevel > 0 && getResumeContentHeight() > geometry.printSafeHeightPx) {
        await autoFitToOnePage();
        await waitForLayout();
      }
      window.print();
      return;
    }

    if (!resumeRef.current) return;
    const paperWrap = resumeRef.current.closest<HTMLElement>(".paper-wrap");
    setExporting(true);
    paperWrap?.classList.add("export-source");
    try {
      await waitForLayout();
      // html2canvas is only needed for image export, so it stays out of the
      // initial bundle.
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(resumeRef.current, {
        scale: options.scale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        onclone: (clonedDocument) => {
          clonedDocument.querySelector(".resume-paper")?.classList.add("export-clean");
        },
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(
          resolve,
          format === "png" ? "image/png" : "image/jpeg",
          format === "jpg" ? options.quality : undefined,
        ),
      );
      if (blob) downloadBlob(blob, `${safeFilename(data.name)}.${format}`);
    } finally {
      paperWrap?.classList.remove("export-source");
      setExporting(false);
    }
  };

  const handleExportBackup = () => {
    downloadBlob(
      new Blob([workspace.exportBackup()], { type: "application/json" }),
      `quicky-resume-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  const handleImportBackup = async (file: File) => {
    const result = workspace.importDocuments(await file.text());
    return result.ok
      ? { ok: true, count: result.documents.length }
      : { ok: false, reason: result.reason };
  };

  /* ------------------------------------------------------------ shortcuts */

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        workspace.save();
        return;
      }
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey);
      if (wantsUndo && workspace.canUndo) {
        event.preventDefault();
        setActiveText(null);
        workspace.undo();
      } else if (wantsRedo && workspace.canRedo) {
        event.preventDefault();
        setActiveText(null);
        workspace.redo();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [workspace]);

  /* --------------------------------------------------------- confirmations */

  const clearAllText = () =>
    setConfirmation({
      confirmLabel: "Clear all text",
      eyebrow: "Clear content",
      message:
        "Your section names, structure, selected style, and photo will stay in place. Undo restores this before you save.",
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

  const loadExample = () =>
    setConfirmation({
      confirmLabel: "Load example",
      eyebrow: "Default content",
      message:
        "This replaces the current resume content with the Tian Xing example while keeping your selected style. Nothing is saved until you click Save changes.",
      onConfirm: () => {
        setActiveText(null);
        setData(tianXingExample);
      },
      title: "Load the example resume?",
      tone: "accent",
    });

  const resetResume = () =>
    setConfirmation({
      confirmLabel: "Reset resume",
      eyebrow: "Start over",
      message:
        "This replaces all content and style settings for this resume with the original starter. Your saved copy will not change until you click Save changes.",
      onConfirm: () => {
        setActiveText(null);
        setData(tianXingExample);
        setStyle(() => ({ ...defaultStyle }));
      },
      title: "Reset to the starter?",
      tone: "danger",
    });

  const saveLabel = workspace.saveError
    ? "Try save again"
    : workspace.hasUnsavedChanges
      ? "Save changes"
      : "Saved";

  const tabLabels: Record<Tab, string> = {
    content: "Content",
    style: "Style",
    export: "Export",
  };

  return (
    <main className="studio-shell">
      <a className="skip-link" href="#resume-preview">
        Skip to resume preview
      </a>

      <header className="app-header no-print">
        <div className="brand-lockup">
          <div aria-hidden="true" className="brand-mark">
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

        <div className="header-actions">
          <div aria-label="Editing history" className="history-actions" role="group">
            <button
              aria-label="Undo last change"
              disabled={!workspace.canUndo}
              onClick={() => {
                setActiveText(null);
                workspace.undo();
              }}
              title="Undo last change (⌘/Ctrl+Z)"
              type="button"
            >
              Undo
            </button>
            <button
              aria-label="Redo last undone change"
              disabled={!workspace.canRedo}
              onClick={() => {
                setActiveText(null);
                workspace.redo();
              }}
              title="Redo last undone change (⌘/Ctrl+Shift+Z)"
              type="button"
            >
              Redo
            </button>
          </div>
          <button
            className={`save-button${workspace.hasUnsavedChanges ? " unsaved" : ""}${
              workspace.saveError ? " error" : ""
            }`}
            disabled={!workspace.hasUnsavedChanges}
            onClick={workspace.save}
            title={workspace.saveError || (workspace.hasUnsavedChanges ? "Save changes on this device (⌘/Ctrl+S)" : "All changes are saved")}
            type="button"
          >
            <span aria-hidden="true" className="save-dot" />
            <span>{saveLabel}</span>
          </button>
          <p aria-live="polite" className="sr-only">
            {workspace.saveError || (workspace.hasUnsavedChanges ? "Unsaved changes" : "All changes saved")}
          </p>
        </div>
      </header>

      <div className="workspace">
        <aside className="editor-panel no-print">
          <nav aria-label="Resume editor" className="tab-list">
            {TABS.map((tab) => (
              <button
                aria-current={activeTab === tab ? "page" : undefined}
                // The visible label is lowercase text restyled by CSS, so the
                // accessible name is set explicitly rather than inherited from
                // the rendered (text-transformed) content.
                aria-label={tabLabels[tab]}
                className={activeTab === tab ? "tab active" : "tab"}
                key={tab}
                onClick={() => setActiveTab(tab)}
                type="button"
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>

          <div className="editor-scroll" ref={editorScrollRef}>
            {activeTab === "content" && (
              <ContentPanel
                activeAnchor={activeContentAnchor}
                data={data}
                onClearAll={clearAllText}
                onLoadExample={loadExample}
                onPhotoChange={handlePhoto}
                onReplaceData={(next) => setData(next)}
                onScrollTo={scrollContentTo}
                scrollRef={editorScrollRef}
                setData={setData}
              />
            )}

            {activeTab === "style" && (
              <StylePanel
                data={data}
                onApplyTheme={applyResumeTheme}
                onPhotoChange={handlePhoto}
                onPlacePhoto={placePhoto}
                onRemovePhoto={() => {
                  setData((current) => ({ ...current, photo: "" }));
                  setStyle((current) => ({ ...current, showPhoto: false }));
                  setDraggingPhoto(false);
                  setPhotoError("");
                }}
                onReset={resetResume}
                photoError={photoError}
                setStyle={setStyle}
                style={style}
              />
            )}

            {activeTab === "export" && (
              <ExportPanel
                autoFitting={autoFitting}
                data={data}
                exporting={exporting}
                onAutoFit={autoFitToOnePage}
                onExport={handleExport}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                pageCount={pageCount}
                setStyle={setStyle}
                style={style}
              />
            )}
          </div>
        </aside>

        <section
          className="preview-stage"
          id="resume-preview"
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (!target.closest("[data-inline-edit], [data-font-tools]")) setActiveText(null);
          }}
          ref={previewStageRef}
        >
          <div className="preview-toolbar no-print">
            <span>
              {pageCount} {pageCount === 1 ? "page" : "pages"} · {geometry.label}
            </span>
          </div>

          <div className="paper-viewport" ref={paperViewportRef}>
            <div className="paper-wrap">
              <ResumePaper
                activeText={activeText}
                data={data}
                draggingPhoto={draggingPhoto}
                onActivateText={(id, label, top) => setActiveText({ id, label, top })}
                onAdjustFont={adjustActiveFont}
                onPhotoKeyDown={movePhotoWithKeyboard}
                onPhotoPointerDown={startPhotoDrag}
                onPhotoPointerFinish={finishPhotoDrag}
                onPhotoPointerMove={movePhotoPointer}
                onUpdateContact={updateContact}
                onUpdateEntry={updateEntry}
                onUpdateSection={updateSection}
                paperRef={resumeRef}
                photoRef={photoRef}
                style={style}
              />
            </div>
          </div>
        </section>
      </div>

      <ConfirmationDialog
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const action = confirmation?.onConfirm;
          setConfirmation(null);
          action?.();
        }}
        request={confirmation}
      />

      <VersionWidget />
    </main>
  );
}
