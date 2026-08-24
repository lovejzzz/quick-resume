import { tianXingExample } from "../examples/tian-xing";
import { getResumeFont } from "./resume-fonts";
import {
  makeId,
  type PageSize,
  type ResumeData,
  type ResumeDocument,
  type ResumeEntry,
  type ResumeLayout,
  type ResumeSection,
  type ResumeStyle,
  type SectionKind,
} from "./resume-model";
import { getResumeTheme } from "./resume-themes";
import { DEFAULT_PHOTO_SIZE, MAX_PHOTO_SIZE, MIN_PHOTO_SIZE } from "./fit";

export const STORAGE_KEY = "quick-resume";
export const RECOVERY_KEY = "quick-resume:recovery";
export const CORRUPT_KEY = "quick-resume:unreadable";
export const SCHEMA_VERSION = 2;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENTS = 50;
const MAX_PHOTO_CHARACTERS = 5 * 1024 * 1024;

export type Workspace = {
  activeId: string;
  documents: ResumeDocument[];
};

export const defaultStyle: ResumeStyle = {
  accent: "#28605d",
  font: "modern",
  density: "comfortable",
  fitLevel: 0,
  fontAdjustments: {},
  layout: "modern",
  pageSize: "letter",
  photoSize: DEFAULT_PHOTO_SIZE,
  photoX: 664,
  photoY: 66,
  resumeFont: "calibri",
  showPhoto: false,
};

const SECTION_KINDS: SectionKind[] = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "awards",
  "custom",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Persisted data is repaired rather than rejected. A single malformed field
 * must never be able to take the whole editor down on load, because the bad
 * value would be re-read on every subsequent visit.
 */
function coerceEntry(value: unknown): ResumeEntry {
  const raw = isObject(value) ? value : {};
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.filter((bullet): bullet is string => typeof bullet === "string")
    : [];
  const entry: ResumeEntry = {
    id: asString(raw.id) || makeId(),
    heading: asString(raw.heading),
    subheading: asString(raw.subheading),
    date: asString(raw.date),
    details: asString(raw.details),
    bullets,
  };
  if (typeof raw.link === "string") entry.link = raw.link;
  return entry;
}

function coerceSection(value: unknown): ResumeSection {
  const raw = isObject(value) ? value : {};
  const kind = SECTION_KINDS.includes(raw.kind as SectionKind)
    ? (raw.kind as SectionKind)
    : "custom";
  const entries = Array.isArray(raw.entries) ? raw.entries.map(coerceEntry) : [];
  return {
    id: asString(raw.id) || makeId(),
    kind,
    title: asString(raw.title, "Section"),
    // A section with no entries renders as an orphan heading; give it one.
    entries: entries.length ? entries : [coerceEntry({})],
  };
}

export function coerceResumeData(value: unknown): ResumeData {
  const raw = isObject(value) ? value : {};
  const sections = Array.isArray(raw.sections) ? raw.sections.map(coerceSection) : [];
  const rawPhoto = asString(raw.photo);
  const photo =
    rawPhoto.length <= MAX_PHOTO_CHARACTERS &&
    /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(rawPhoto)
      ? rawPhoto
      : "";
  return {
    name: asString(raw.name),
    headline: asString(raw.headline),
    email: asString(raw.email),
    phone: asString(raw.phone),
    location: asString(raw.location),
    portfolio: asString(raw.portfolio),
    secondaryLink: asString(raw.secondaryLink),
    // Backups are user-controlled input. Never allow a crafted backup to turn
    // the resume photo into a third-party network request.
    photo,
    sections,
  };
}

export function coerceResumeStyle(value: unknown): ResumeStyle {
  const raw = isObject(value) ? value : {};
  const layout = raw.layout as ResumeLayout;
  const fontAdjustments: Record<string, number> = {};
  if (isObject(raw.fontAdjustments)) {
    for (const [key, adjustment] of Object.entries(raw.fontAdjustments)) {
      if (typeof adjustment === "number" && Number.isFinite(adjustment)) {
        fontAdjustments[key] = clamp(adjustment, -4, 8);
      }
    }
  }
  const accent = asString(raw.accent, defaultStyle.accent);
  return {
    // Reject anything that is not a plain hex colour; the value is written
    // straight into a CSS custom property.
    accent: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)
      ? accent
      : defaultStyle.accent,
    font: (["modern", "classic", "humanist"] as const).includes(
      raw.font as ResumeStyle["font"],
    )
      ? (raw.font as ResumeStyle["font"])
      : defaultStyle.font,
    density: raw.density === "compact" ? "compact" : "comfortable",
    fitLevel: clamp(Math.round(asNumber(raw.fitLevel, 0)), 0, 100),
    fontAdjustments,
    layout: getResumeTheme(layout).id === layout ? layout : defaultStyle.layout,
    pageSize: (raw.pageSize === "a4" ? "a4" : "letter") as PageSize,
    photoSize: clamp(
      Math.round(asNumber(raw.photoSize, defaultStyle.photoSize)),
      MIN_PHOTO_SIZE,
      MAX_PHOTO_SIZE,
    ),
    photoX: asNumber(raw.photoX, defaultStyle.photoX),
    photoY: asNumber(raw.photoY, defaultStyle.photoY),
    resumeFont: getResumeFont(raw.resumeFont as ResumeStyle["resumeFont"]).id,
    showPhoto: asBoolean(raw.showPhoto, false),
  };
}

function coerceDocument(value: unknown, index: number): ResumeDocument {
  const raw = isObject(value) ? value : {};
  const data = coerceResumeData(raw.data);
  return {
    id: asString(raw.id) || makeId(),
    title: asString(raw.title) || data.name || `Resume ${index + 1}`,
    data,
    style: coerceResumeStyle(raw.style),
    updatedAt: asNumber(raw.updatedAt, 0),
  };
}

export function createDocument(
  title: string,
  data: ResumeData = tianXingExample,
  style: ResumeStyle = defaultStyle,
): ResumeDocument {
  return { id: makeId(), title, data, style, updatedAt: Date.now() };
}

export function starterWorkspace(): Workspace {
  const document = createDocument("My resume", tianXingExample, defaultStyle);
  return { activeId: document.id, documents: [document] };
}

/**
 * Accepts any historical shape and returns something renderable.
 *
 * v1 stored a bare `{ data, style }` pair with no version marker; v2 stores a
 * versioned list of documents. Unrecognised payloads fall back to the starter
 * rather than throwing.
 */
export function migrateWorkspace(value: unknown): Workspace {
  if (!isObject(value)) return starterWorkspace();

  // v1: a single unversioned resume.
  if (!("version" in value) && ("data" in value || "style" in value)) {
    const data = coerceResumeData(value.data);
    const document: ResumeDocument = {
      id: makeId(),
      title: data.name || "My resume",
      data,
      style: coerceResumeStyle(value.style),
      updatedAt: Date.now(),
    };
    return { activeId: document.id, documents: [document] };
  }

  const documents = Array.isArray(value.documents)
    ? value.documents.slice(0, MAX_DOCUMENTS).map(coerceDocument)
    : [];
  if (!documents.length) return starterWorkspace();

  const activeId = asString(value.activeId);
  return {
    activeId: documents.some((document) => document.id === activeId)
      ? activeId
      : documents[0].id,
    documents,
  };
}

export function loadWorkspace(): Workspace {
  if (typeof window === "undefined") return starterWorkspace();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return starterWorkspace();
  try {
    return migrateWorkspace(JSON.parse(stored));
  } catch {
    // Keep the unreadable payload available for recovery instead of silently
    // replacing the only copy with the starter.
    try {
      window.localStorage.setItem(CORRUPT_KEY, stored);
      const recovery = window.localStorage.getItem(RECOVERY_KEY);
      if (recovery) return migrateWorkspace(JSON.parse(recovery));
    } catch {
      // Storage may itself be blocked; the editor still needs to open.
    }
    return starterWorkspace();
  }
}

export type SaveResult = { ok: true } | { ok: false; reason: string };

export function saveWorkspace(workspace: Workspace): SaveResult {
  try {
    const serialized = JSON.stringify({ version: SCHEMA_VERSION, ...workspace });
    const previous = window.localStorage.getItem(STORAGE_KEY);
    if (previous && previous !== serialized) {
      try {
        window.localStorage.setItem(RECOVERY_KEY, previous);
      } catch {
        // A recovery snapshot is best effort; failing to rotate it must not
        // prevent the current document from being saved.
      }
    }
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return { ok: true };
  } catch (error) {
    const isQuota =
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      reason: isQuota
        ? "This device is out of local storage. Remove a photo or delete an unused resume, then save again."
        : "Saving failed on this device. Your browser may be blocking local storage.",
    };
  }
}

/* ---------------------------------------------------------------- transfer */

export type ResumeBackup = {
  kind: "quicky-resume-backup";
  version: number;
  exportedAt: string;
  documents: ResumeDocument[];
};

export function serializeBackup(documents: ResumeDocument[]): string {
  const backup: ResumeBackup = {
    kind: "quicky-resume-backup",
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    documents,
  };
  return JSON.stringify(backup, null, 2);
}

export type ParsedBackup =
  | { ok: true; documents: ResumeDocument[] }
  | { ok: false; reason: string };

export function parseBackup(text: string): ParsedBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) {
    return { ok: false, reason: "That backup is too large to open safely in this browser." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "That file is not valid JSON." };
  }
  if (!isObject(parsed) && !Array.isArray(parsed)) {
    return { ok: false, reason: "That file does not contain a resume backup." };
  }

  // Accept a full backup, a bare document list, or a single exported resume.
  if (isObject(parsed) && "kind" in parsed && parsed.kind !== "quicky-resume-backup") {
    return { ok: false, reason: "That file belongs to a different application." };
  }
  if (
    isObject(parsed) &&
    typeof parsed.version === "number" &&
    parsed.version > SCHEMA_VERSION
  ) {
    return {
      ok: false,
      reason: "This backup was created by a newer version of Quicky Resume. Update the app before restoring it.",
    };
  }
  const rawDocuments = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.documents)
        ? parsed.documents
        : "data" in parsed
        ? [parsed]
        : null;

  if (!rawDocuments || !rawDocuments.length) {
    return { ok: false, reason: "No resumes were found in that file." };
  }
  if (rawDocuments.length > MAX_DOCUMENTS) {
    return { ok: false, reason: `That backup contains more than ${MAX_DOCUMENTS} resumes.` };
  }
  return {
    ok: true,
    // Re-key on import so a backup can be merged alongside existing resumes
    // without colliding with them.
    documents: rawDocuments.map(coerceDocument).map((document) => ({
      ...document,
      id: makeId(),
    })),
  };
}
