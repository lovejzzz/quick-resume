import {
  makeId,
  type ResumeData,
  type ResumeEntry,
  type ResumeSection,
  type SectionKind,
} from "./resume-model";

/**
 * Best-effort import of an existing resume so users do not start from a blank
 * page. PDF text extraction runs entirely in the browser via a dynamically
 * imported pdf.js, so the heavy dependency stays out of the main bundle and no
 * file is ever uploaded anywhere.
 *
 * Layout-driven PDFs vary far too much for this to be exact. The goal is a
 * usable first draft that the user then corrects.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
// Allows a leading "(" so "(415) 555-0142" keeps its area-code bracket.
const PHONE = /(\+?\(?\d[\d\s().-]{7,}\d)/;
const LINK = /\b((?:https?:\/\/|www\.)[^\s,;]+|[\w-]+\.(?:com|org|net|io|dev|me|co)\/[^\s,;]*)/i;
const LINK_GLOBAL = new RegExp(LINK.source, "gi");
const LOCATION = /^[A-Z][A-Za-z.\s-]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+)\b/;

/** Headings we know how to place, longest phrases first so they win the match. */
const HEADING_MAP: { pattern: RegExp; kind: SectionKind; title: string }[] = [
  { pattern: /^(work\s+)?experience$|^employment( history)?$|^professional experience$/i, kind: "experience", title: "Experience" },
  { pattern: /^education$|^academic background$/i, kind: "education", title: "Education" },
  { pattern: /^projects?$|^selected projects?$|^personal projects?$/i, kind: "projects", title: "Projects" },
  { pattern: /^(technical\s+)?skills?$|^competencies$|^technologies$/i, kind: "skills", title: "Skills" },
  { pattern: /^awards?$|^honors?( & awards?)?$|^achievements?$/i, kind: "awards", title: "Awards" },
  { pattern: /^(professional\s+)?summary$|^profile$|^objective$|^about( me)?$/i, kind: "summary", title: "Profile" },
  { pattern: /^certifications?$|^licenses?$/i, kind: "custom", title: "Certifications" },
  { pattern: /^publications?$/i, kind: "custom", title: "Publications" },
  { pattern: /^volunteer( experience)?$/i, kind: "custom", title: "Volunteering" },
  { pattern: /^languages?$/i, kind: "custom", title: "Languages" },
  { pattern: /^interests?$|^hobbies$/i, kind: "custom", title: "Interests" },
];

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
/** A year, optionally with a `/MM` or `.MM` suffix, e.g. 2026 or 2026/02. */
const YEAR = "(?:19|20)\\d{2}(?:[/.]\\d{1,2})?";
/** One endpoint of a date range: "May 2021", "2021", "2026/02". */
const DATE_POINT = `(?:\\b${MONTH}\\s+)?${YEAR}`;
const RANGE_END = `(?:${DATE_POINT}|present|current|now|ongoing)`;

/**
 * Does this line carry a date at all? Month names are anchored on word
 * boundaries so "Summary" is not read as containing "mar".
 */
const DATE_RANGE = new RegExp(`\\b(?:${YEAR}|${MONTH}\\s+${YEAR}|present|current|ongoing)\\b`, "i");

/** A date range sitting at the end of a line, which is where resumes put it. */
const TRAILING_DATE = new RegExp(
  `(${DATE_POINT}\\s*(?:[-–—]|\\bto\\b)\\s*${RANGE_END}|${DATE_POINT})\\s*$`,
  "i",
);

const BULLET_PREFIX = /^\s*[•·▪◦‣∙*\-–—]\s+/;

export type ImportResult =
  | { ok: true; data: ResumeData; warnings: string[] }
  | { ok: false; reason: string };

/** Reads a PDF into plain text lines, preserving visual line breaks. */
async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  // The worker ships with the package; point pdf.js at it as a module worker so
  // the static export does not need any extra copy step.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    // Group text items into visual lines by their y position.
    const rows = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = item.transform as number[];
      const y = Math.round(transform[5]);
      const row = rows.get(y) ?? [];
      row.push({ x: transform[4], text: item.str });
      rows.set(y, row);
    }
    [...rows.entries()]
      .sort((left, right) => right[0] - left[0])
      .forEach(([, row]) => {
        const text = row
          .sort((left, right) => left.x - right.x)
          .map((cell) => cell.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) lines.push(text);
      });
  }
  await document.destroy();
  return lines;
}

function matchHeading(line: string) {
  const cleaned = line.replace(/[:.]+$/, "").trim();
  // Headings are short and rarely contain sentence punctuation.
  if (cleaned.length > 40 || cleaned.split(/\s+/).length > 4) return null;
  return HEADING_MAP.find((candidate) => candidate.pattern.test(cleaned)) ?? null;
}

function blankEntry(): ResumeEntry {
  return { id: makeId(), heading: "", subheading: "", date: "", details: "", bullets: [] };
}

/** Splits a heading line like "Engineer — Acme, 2020-2024" into its parts. */
function splitHeadingLine(line: string): { heading: string; subheading: string; date: string } {
  let rest = line;
  let date = "";
  // Pull a trailing date range off the end.
  const dateMatch = rest.match(TRAILING_DATE);
  if (dateMatch) {
    date = dateMatch[1].trim();
    rest = rest.slice(0, dateMatch.index).trim().replace(/[|,–—-]+$/, "").trim();
  }
  const parts = rest.split(/\s+[|·—–]\s+|\s{2,}|,\s+(?=[A-Z])/).filter(Boolean);
  return {
    heading: (parts[0] ?? rest).trim(),
    subheading: parts.slice(1).join(", ").trim(),
    date,
  };
}

export function parseResumeLines(lines: string[]): ResumeData {
  const clean = lines.map((line) => line.trim()).filter(Boolean);

  const data: ResumeData = {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    portfolio: "",
    secondaryLink: "",
    photo: "",
    sections: [],
  };

  // The contact block is whatever precedes the first recognised heading.
  let firstHeadingIndex = clean.findIndex((line) => matchHeading(line));
  if (firstHeadingIndex < 0) firstHeadingIndex = Math.min(clean.length, 6);

  const header = clean.slice(0, firstHeadingIndex);
  const headerBlob = header.join(" ");
  data.email = headerBlob.match(EMAIL)?.[0] ?? "";
  data.phone = headerBlob.match(PHONE)?.[0]?.trim() ?? "";

  const links = [...headerBlob.matchAll(LINK_GLOBAL)]
    .map((match) => match[0])
    .filter((link) => !link.includes("@"));
  data.portfolio = links[0] ?? "";
  data.secondaryLink = links[1] ?? "";

  for (const line of header) {
    if (!data.name && !EMAIL.test(line) && !PHONE.test(line) && line.split(/\s+/).length <= 5) {
      data.name = line.replace(/[|·].*$/, "").trim();
      continue;
    }
    if (!data.location && LOCATION.test(line) && !EMAIL.test(line)) {
      data.location = line.match(LOCATION)?.[0].trim() ?? "";
      continue;
    }
    if (
      !data.headline &&
      data.name &&
      line !== data.name &&
      !EMAIL.test(line) &&
      !PHONE.test(line) &&
      !LINK.test(line) &&
      line.split(/\s+/).length <= 12
    ) {
      data.headline = line;
    }
  }

  // Walk the remaining lines, opening a new section at each known heading.
  let section: ResumeSection | null = null;
  let entry: ResumeEntry | null = null;

  const closeEntry = () => {
    if (section && entry && (entry.heading || entry.details || entry.bullets.length)) {
      section.entries.push(entry);
    }
    entry = null;
  };
  const closeSection = () => {
    closeEntry();
    if (section && section.entries.length) data.sections.push(section);
    section = null;
  };

  for (const line of clean.slice(firstHeadingIndex)) {
    const heading = matchHeading(line);
    if (heading) {
      closeSection();
      section = { id: makeId(), kind: heading.kind, title: heading.title, entries: [] };
      continue;
    }
    if (!section) continue;

    const bulletMatch = BULLET_PREFIX.test(line);
    const body = line.replace(BULLET_PREFIX, "").trim();

    if (section.kind === "summary") {
      entry ??= blankEntry();
      entry.details = entry.details ? `${entry.details} ${body}` : body;
      continue;
    }

    if (section.kind === "skills") {
      // "Languages: TypeScript, Go" splits into a labelled row; anything else
      // becomes an unlabelled row.
      const [label, ...rest] = body.split(/:\s*/);
      const skillEntry = blankEntry();
      if (rest.length) {
        skillEntry.heading = label.trim();
        skillEntry.details = rest.join(": ").trim();
      } else {
        skillEntry.details = body;
      }
      section.entries.push(skillEntry);
      continue;
    }

    if (bulletMatch) {
      entry ??= blankEntry();
      entry.bullets.push(body);
      continue;
    }

    const openEntry = (line: string) => {
      closeEntry();
      const parts = splitHeadingLine(line);
      entry = blankEntry();
      entry.heading = parts.heading;
      entry.subheading = parts.subheading;
      entry.date = parts.date;
    };

    if (!entry) {
      openEntry(body);
      continue;
    }

    if (DATE_RANGE.test(body)) {
      // A second date means a new item; the first one just completes the item
      // already open, for resumes that put the employer and dates on line two.
      if (entry.date) openEntry(body);
      else {
        const parts = splitHeadingLine(body);
        entry.date = parts.date;
        if (!entry.subheading) entry.subheading = parts.heading;
      }
      continue;
    }

    // Many PDFs drop their list-marker glyphs during text extraction, so an
    // unprefixed line inside an open item is far more likely to be an
    // accomplishment bullet than a subtitle. Only a short, title-like line
    // still standing in for a missing subheading is treated as one.
    const wordCount = body.split(/\s+/).length;
    if (!entry.subheading && wordCount <= 8 && !/[.!?]$/.test(body)) {
      entry.subheading = body;
    } else {
      entry.bullets.push(body);
    }
  }
  closeSection();

  return data;
}

function validate(data: ResumeData, warnings: string[]) {
  if (!data.name) warnings.push("Could not identify a name — add it in Content.");
  if (!data.sections.length) {
    warnings.push("No standard section headings were recognised, so sections are empty.");
  }
  if (!data.email && !data.phone) warnings.push("No email or phone was found.");
}

export async function importResumeFile(file: File): Promise<ImportResult> {
  const warnings: string[] = [];
  try {
    let lines: string[];
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      lines = await extractPdfLines(file);
      if (!lines.length) {
        return {
          ok: false,
          reason:
            "No text was found in that PDF. It is probably a scan — an image-only PDF cannot be read without OCR.",
        };
      }
    } else if (/\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith("text/")) {
      lines = (await file.text()).split(/\r?\n/);
    } else {
      return {
        ok: false,
        reason: "Unsupported file. Import a PDF, or plain text copied from your current resume.",
      };
    }

    const data = parseResumeLines(lines);
    validate(data, warnings);
    return { ok: true, data, warnings };
  } catch {
    return { ok: false, reason: "That file could not be read. Try exporting it as a PDF again." };
  }
}
