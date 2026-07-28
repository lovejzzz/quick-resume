import { diagnose, type PageStats, type PdfHealth } from "./diagnose";
import { ensureMapHelpers } from "./map-helpers";
import { normaliseText } from "./normalize";

/** One reconstructed visual line of text, with the geometry used to read it. */
export type TextLine = {
  text: string;
  /** Left edge, in PDF user units from the page's left edge. */
  x: number;
  right: number;
  /** Baseline, measured downward from the page top so lines sort ascending. */
  y: number;
  size: number;
  page: number;
  /** True when the line's font differs from the page's dominant body font. */
  emphasis: boolean;
  /** Column index after layout analysis; 0 when the page is single-column. */
  column: number;
};

type Fragment = {
  text: string;
  x: number;
  width: number;
  y: number;
  size: number;
  font: string;
};

/**
 * A gap smaller than this fraction of the font size is letter-spacing or
 * kerning, not a word break. Joining blindly with spaces turns a letter-spaced
 * heading such as EDUCATION into "E D U C AT I O N".
 */
const WORD_GAP_RATIO = 0.2;

/** Lines whose baselines are closer than this share a visual row. */
const ROW_TOLERANCE_RATIO = 0.55;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Joins fragments left-to-right, inserting spaces only at real word gaps. */
function joinFragments(fragments: Fragment[]): string {
  const sorted = [...fragments].sort((left, right) => left.x - right.x);
  let text = "";
  let previousRight: number | null = null;
  for (const fragment of sorted) {
    if (previousRight !== null) {
      const gap = fragment.x - previousRight;
      const needsSpace = gap > WORD_GAP_RATIO * (fragment.size || 10);
      if (needsSpace && !text.endsWith(" ") && !fragment.text.startsWith(" ")) text += " ";
    }
    text += fragment.text;
    previousRight = fragment.x + fragment.width;
  }
  return normaliseText(text);
}

/**
 * Splits a page into columns by looking for a vertical gutter no text crosses.
 *
 * Two-column resumes interleave badly when read by y alone: a sidebar heading
 * lands between two lines of the main column. Returns fragment groups in
 * reading order (left column first).
 */
function splitColumns(fragments: Fragment[], pageWidth: number): Fragment[][] {
  if (fragments.length < 24) return [fragments];

  const left = Math.min(...fragments.map((fragment) => fragment.x));
  const right = Math.max(...fragments.map((fragment) => fragment.x + fragment.width));
  const span = right - left;
  if (span <= 0) return [fragments];

  const SAMPLES = 200;
  // Mark every sample point covered by at least one fragment.
  const covered = new Array<boolean>(SAMPLES).fill(false);
  for (const fragment of fragments) {
    const from = Math.max(0, Math.floor(((fragment.x - left) / span) * SAMPLES));
    const to = Math.min(SAMPLES - 1, Math.ceil(((fragment.x + fragment.width - left) / span) * SAMPLES));
    for (let index = from; index <= to; index += 1) covered[index] = true;
  }

  // The gutter has to sit away from both edges to be a column break.
  const lowerBound = Math.floor(SAMPLES * 0.18);
  const upperBound = Math.ceil(SAMPLES * 0.82);
  let best: { start: number; end: number } | null = null;
  let runStart: number | null = null;
  for (let index = lowerBound; index <= upperBound; index += 1) {
    if (!covered[index]) {
      runStart ??= index;
      continue;
    }
    if (runStart !== null) {
      if (!best || index - runStart > best.end - best.start) best = { start: runStart, end: index };
      runStart = null;
    }
  }
  if (runStart !== null && (!best || upperBound - runStart > best.end - best.start)) {
    best = { start: runStart, end: upperBound };
  }

  // A gutter narrower than 3% of the text width is just paragraph spacing.
  if (!best || (best.end - best.start) / SAMPLES < 0.03) return [fragments];

  const boundary = left + ((best.start + best.end) / 2 / SAMPLES) * span;
  const leftColumn = fragments.filter((fragment) => fragment.x + fragment.width <= boundary);
  const rightColumn = fragments.filter((fragment) => fragment.x + fragment.width > boundary);

  // Both sides must carry real content, and each must span enough of the page
  // height to be a column rather than a floated date or a caption.
  const share = Math.min(leftColumn.length, rightColumn.length) / fragments.length;
  if (share < 0.15) return [fragments];

  const verticalSpan = (group: Fragment[]) => {
    const ys = group.map((fragment) => fragment.y);
    return Math.max(...ys) - Math.min(...ys);
  };
  const pageSpan = verticalSpan(fragments);
  if (pageSpan > 0) {
    const ratio = Math.min(verticalSpan(leftColumn), verticalSpan(rightColumn)) / pageSpan;
    if (ratio < 0.45) return [fragments];
  }

  void pageWidth;
  return [leftColumn, rightColumn];
}

/** Groups fragments into visual rows, tolerating small baseline differences. */
function buildLines(fragments: Fragment[], page: number, column: number, bodyFont: string): TextLine[] {
  if (!fragments.length) return [];
  const bodySize = median(fragments.map((fragment) => fragment.size)) || 10;
  const tolerance = Math.max(1.5, bodySize * ROW_TOLERANCE_RATIO);

  const sorted = [...fragments].sort((left, right) => left.y - right.y || left.x - right.x);
  const rows: Fragment[][] = [];
  let current: Fragment[] = [];
  let anchor = sorted[0].y;

  for (const fragment of sorted) {
    if (current.length && Math.abs(fragment.y - anchor) > tolerance) {
      rows.push(current);
      current = [];
      anchor = fragment.y;
    }
    if (!current.length) anchor = fragment.y;
    current.push(fragment);
  }
  if (current.length) rows.push(current);

  return rows
    .map((row) => {
      const text = joinFragments(row);
      if (!text) return null;
      const sizes = row.map((fragment) => fragment.size);
      return {
        text,
        x: Math.min(...row.map((fragment) => fragment.x)),
        right: Math.max(...row.map((fragment) => fragment.x + fragment.width)),
        y: Math.min(...row.map((fragment) => fragment.y)),
        size: Math.max(...sizes),
        page,
        emphasis: row.some((fragment) => fragment.font !== bodyFont),
        column,
      } satisfies TextLine;
    })
    .filter((line): line is TextLine => line !== null);
}

export type PdfExtraction = {
  lines: TextLine[];
  health: PdfHealth;
  /** Kept so OCR can re-render pages without re-reading the file. */
  data: ArrayBuffer;
};

/** Loads pdf.js on demand and points it at its bundled worker. */
export async function loadPdfjs() {
  // pdf.js v5 relies on a proposal-stage Map method for every render path.
  ensureMapHelpers();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}


/** The slice of PDFPageProxy this needs, kept structural so it is testable. */
type RenderablePage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: never;
  }) => { promise: Promise<void> };
};

/**
 * Renders a page at a thumbnail scale and reports whether it draws anything.
 *
 * This separates a scanned page — which has no text but plenty of ink — from a
 * genuinely blank or corrupt one, so each can be explained differently.
 */
export async function pageHasInk(page: RenderablePage): Promise<boolean> {
  if (typeof document === "undefined") return false;
  try {
    const viewport = page.getViewport({ scale: 0.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport: viewport as never }).promise;

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let inked = 0;
    for (let index = 0; index < data.length; index += 4) {
      // Anything meaningfully darker than paper counts as ink.
      if (data[index] < 235 || data[index + 1] < 235 || data[index + 2] < 235) inked += 1;
    }
    // A stray artefact or a hairline rule is not content.
    return inked / (data.length / 4) > 0.004;
  } catch {
    return false;
  }
}

/** Reads a PDF into positioned lines, and reports what it found. */
export async function extractPdf(file: File): Promise<PdfExtraction> {
  const pdfjs = await loadPdfjs();

  const data = await file.arrayBuffer();
  // pdf.js takes ownership of the buffer it is given, so hand it a copy and
  // keep the original for a possible OCR pass.
  const document = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const lines: TextLine[] = [];
  const stats: PageStats[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      // Whether the page draws anything is established by rendering it at a
      // tiny scale and looking for non-white pixels. getOperatorList() would
      // also answer this but is broken in the bundled build, and rendering is
      // the same path OCR needs anyway.
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("");
      const images = pageText.trim().length
        ? 0
        : (await pageHasInk(page)) ? 1 : 0;

      stats.push({ page: pageNumber, textChars: pageText.trim().length, images, text: pageText });

      const fragments: Fragment[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = item.transform as number[];
        const size = Math.abs(transform[3]) || Math.hypot(transform[1], transform[3]) || 10;
        fragments.push({
          text: item.str,
          x: transform[4],
          width: item.width ?? 0,
          // Flip to a top-down axis so lines sort in reading order.
          y: viewport.height - transform[5],
          size,
          font: item.fontName ?? "",
        });
      }
      if (!fragments.length) continue;

      // The most-used font on the page is the body face; anything else is a
      // heading, a name, or bold emphasis.
      const fontCounts = new Map<string, number>();
      for (const fragment of fragments) {
        fontCounts.set(fragment.font, (fontCounts.get(fragment.font) ?? 0) + fragment.text.length);
      }
      const bodyFont =
        [...fontCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";

      splitColumns(fragments, viewport.width).forEach((group, columnIndex) => {
        lines.push(...buildLines(group, pageNumber, columnIndex, bodyFont));
      });
    }
  } finally {
    await document.destroy();
  }
  return { lines, health: diagnose(stats), data };
}

/** Back-compatible helper for callers that only want the lines. */
export async function extractPdfLines(file: File): Promise<TextLine[]> {
  return (await extractPdf(file)).lines;
}

/** Wraps plain text so downstream stages see the same shape as a PDF. */
export function linesFromText(text: string): TextLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, index) => {
      const trimmed = normaliseText(raw);
      if (!trimmed) return null;
      return {
        text: trimmed,
        // Leading whitespace is the only column signal plain text carries.
        x: raw.length - raw.trimStart().length,
        right: raw.length,
        y: index,
        size: 10,
        page: 1,
        emphasis: false,
        column: 0,
      } as TextLine;
    })
    .filter((line): line is TextLine => line !== null);
}
