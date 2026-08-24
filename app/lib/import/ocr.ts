import { assetPath } from "../asset-path";
import { loadPdfjs, type TextLine } from "./extract";

/**
 * Optical character recognition for PDFs whose text cannot be read — either
 * because there is no text layer at all, or because the fonts carry no
 * character map so the layer decodes to nonsense. Both are fixed by reading the
 * rendered pixels instead of the file's text objects.
 *
 * Everything is same-origin and on-device: tesseract.js, its WASM core, and the
 * language model are all served from this site (see scripts/copy-ocr-assets.mjs)
 * rather than from a CDN, so importing a document still reveals nothing to
 * anyone.
 *
 * OCR output is not trustworthy the way a text layer is. Per-word confidence is
 * carried through so the caller can warn about the fields where a silent error
 * does the most damage — an email address nobody re-reads.
 */

export type OcrProgress = {
  phase: "loading" | "rendering" | "recognising";
  /** 0-1 across the whole job. */
  ratio: number;
  page?: number;
  pages?: number;
};

export type OcrResult = {
  lines: TextLine[];
  /** Mean per-word confidence, 0-100. */
  confidence: number;
  /** Words Tesseract was unsure of, lower-cased, for flagging risky fields. */
  uncertain: Set<string>;
  pagesProcessed: number;
  totalPages: number;
};

/** Below this, Tesseract is guessing. */
const LOW_CONFIDENCE = 75;
export const OCR_PAGE_LIMIT = 6;

export type OcrPagePlan = {
  pagesToRead: number;
  totalPages: number;
  truncated: boolean;
  warning: string;
};

/** Keeps the UI and worker on the same explicit long-document limit. */
export function getOcrPagePlan(
  totalPages: number,
  maxPages = OCR_PAGE_LIMIT,
): OcrPagePlan {
  const pagesToRead = Math.min(totalPages, Math.max(0, maxPages));
  const truncated = pagesToRead < totalPages;
  return {
    pagesToRead,
    totalPages,
    truncated,
    warning: truncated
      ? `Only the first ${pagesToRead} of ${totalPages} pages were read. Import the remaining pages separately.`
      : "",
  };
}

/**
 * Pages are rendered at roughly 200 dpi. Tesseract is trained around that, and
 * going higher costs time without improving a resume's large, clean type.
 */
const RENDER_SCALE = 200 / 72;

type TesseractWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type TesseractLine = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: TesseractWord[];
};

/** Renders one PDF page to a canvas for recognition. */
async function renderPage(page: {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: never;
  }) => { promise: Promise<void> };
}): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  // Tesseract does better against a known background than a transparent one.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport: viewport as never }).promise;
  return canvas;
}

/**
 * Converts Tesseract's line boxes into the same shape the PDF path produces, so
 * layout analysis and parsing are shared rather than duplicated.
 */
function toTextLines(lines: TesseractLine[], page: number, scale: number): TextLine[] {
  return lines
    .map((line) => {
      const text = line.text.replace(/\s+/g, " ").trim();
      if (!text) return null;
      const height = (line.bbox.y1 - line.bbox.y0) / scale;
      return {
        text,
        x: line.bbox.x0 / scale,
        right: line.bbox.x1 / scale,
        y: line.bbox.y0 / scale,
        // Cap height approximates font size closely enough for the heuristics
        // that compare line sizes against the body.
        size: Math.max(6, height * 0.78),
        page,
        // OCR cannot see font identity, so there is no emphasis signal; the
        // parser falls back to its vocabulary heuristics.
        emphasis: false,
        column: 0,
      } as TextLine;
    })
    .filter((line): line is TextLine => line !== null);
}

export type OcrOptions = {
  onProgress?: (progress: OcrProgress) => void;
  signal?: AbortSignal;
  /** Stops runaway jobs on very long documents. */
  maxPages?: number;
};

export async function ocrPdf(data: ArrayBuffer, options: OcrOptions = {}): Promise<OcrResult> {
  const { onProgress, signal } = options;
  const maxPages = options.maxPages ?? OCR_PAGE_LIMIT;

  const throwIfAborted = () => {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  };

  onProgress?.({ phase: "loading", ratio: 0 });
  throwIfAborted();

  const [{ createWorker }, pdfjs] = await Promise.all([import("tesseract.js"), loadPdfjs()]);
  throwIfAborted();

  const worker = await createWorker("eng", 1, {
    workerPath: assetPath("/ocr/worker.min.js"),
    corePath: assetPath("/ocr"),
    langPath: assetPath("/ocr"),
    // The vendored model is gzipped, and there is no CDN fallback by design.
    gzip: true,
  });

  let termination: Promise<unknown> | null = null;
  const terminateWorker = () => {
    termination ??= worker.terminate().catch(() => undefined);
    return termination;
  };
  const abortWorker = () => {
    void terminateWorker();
  };
  signal?.addEventListener("abort", abortWorker, { once: true });

  const raceWithAbort = <T>(promise: Promise<T>): Promise<T> => {
    if (!signal) return promise;
    if (signal.aborted) {
      return Promise.reject(new DOMException("Cancelled", "AbortError"));
    }
    return new Promise<T>((resolve, reject) => {
      const rejectOnAbort = () => reject(new DOMException("Cancelled", "AbortError"));
      signal.addEventListener("abort", rejectOnAbort, { once: true });
      promise.then(resolve, reject).finally(() => {
        signal.removeEventListener("abort", rejectOnAbort);
      });
    });
  };

  let loadingTask: ReturnType<typeof pdfjs.getDocument> | null = null;
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | null = null;
  const lines: TextLine[] = [];
  const uncertain = new Set<string>();
  let confidenceSum = 0;
  let wordCount = 0;
  let pageCount = 0;
  let totalPages = 0;

  try {
    throwIfAborted();
    loadingTask = pdfjs.getDocument({ data: data.slice(0) });
    document = await loadingTask.promise;
    throwIfAborted();
    totalPages = document.numPages;
    pageCount = getOcrPagePlan(totalPages, maxPages).pagesToRead;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      throwIfAborted();
      onProgress?.({
        phase: "rendering",
        ratio: (pageNumber - 1) / pageCount,
        page: pageNumber,
        pages: pageCount,
      });

      const page = await document.getPage(pageNumber);
      const canvas = await renderPage(page);
      throwIfAborted();

      onProgress?.({
        phase: "recognising",
        ratio: (pageNumber - 0.5) / pageCount,
        page: pageNumber,
        pages: pageCount,
      });

      const { data: recognised } = await raceWithAbort(
        worker.recognize(canvas, {}, { blocks: true }),
      );
      throwIfAborted();
      // Release the bitmap promptly; a 200 dpi Letter page is ~20 MB.
      canvas.width = 0;
      canvas.height = 0;

      const recognisedLines = (
        recognised.blocks?.flatMap((block) =>
          block.paragraphs.flatMap((paragraph) => paragraph.lines),
        ) ?? []
      ) as unknown as TesseractLine[];

      lines.push(...toTextLines(recognisedLines, pageNumber, RENDER_SCALE));

      for (const line of recognisedLines) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim();
          if (!text) continue;
          wordCount += 1;
          confidenceSum += word.confidence;
          if (word.confidence < LOW_CONFIDENCE) uncertain.add(text.toLocaleLowerCase());
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortWorker);
    // Tesseract does not settle an in-flight recognition promise when
    // terminate() is called. Cancellation must return immediately; cleanup can
    // finish in the background once the worker responds.
    if (signal?.aborted) void terminateWorker();
    else await terminateWorker();
    await loadingTask?.destroy().catch(() => undefined);
  }

  onProgress?.({ phase: "recognising", ratio: 1, page: pageCount, pages: pageCount });

  return {
    lines,
    confidence: wordCount ? confidenceSum / wordCount : 0,
    uncertain,
    pagesProcessed: pageCount,
    totalPages,
  };
}

/**
 * Flags the fields where an OCR slip is both likely and costly. A misread
 * character in a bullet is obvious on reading; one in an email address is not,
 * and it silently breaks the only way an employer can reply.
 */
export function riskyFieldWarnings(
  fields: { email: string; phone: string; portfolio: string },
  result: OcrResult,
): string[] {
  const warnings: string[] = [];

  const wasUncertain = (value: string) =>
    value
      .toLocaleLowerCase()
      .split(/[\s@./|-]+/)
      .filter(Boolean)
      .some((token) => result.uncertain.has(token));

  /*
   * Quote the values back rather than just saying "check your contact
   * details". Tesseract is often confidently wrong on a name — it read
   * "priya" as "priva" at full confidence — so a low-confidence flag alone
   * misses the very errors that matter most. Showing the text is what lets
   * someone actually spot it.
   */
  const contact = [
    ["Email", fields.email],
    ["Phone", fields.phone],
    ["Link", fields.portfolio],
  ].filter(([, value]) => value) as [string, string][];

  if (contact.length) {
    const flagged = contact.map(([label, value]) =>
      `${label} read as “${value}”${wasUncertain(value) ? " (unclear in the scan)" : ""}`,
    );
    warnings.push(
      `Recognition is not exact — check these character by character: ${flagged.join("; ")}.`,
    );
  } else {
    warnings.push("No contact details were recognised; add your email and phone by hand.");
  }

  if (result.confidence && result.confidence < 80) {
    warnings.push(
      `Overall recognition confidence was ${Math.round(result.confidence)}%, so expect errors throughout.`,
    );
  }
  return warnings;
}
