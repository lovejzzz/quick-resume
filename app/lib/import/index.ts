import type { ResumeData } from "../resume-model";
import { extractDocxLines } from "./docx";
import { explain, isRecoverableByOcr, type PdfHealth } from "./diagnose";
import { extractPdf, linesFromText, type TextLine } from "./extract";
import {
  getOcrPagePlan,
  ocrPdf,
  riskyFieldWarnings,
  type OcrOptions,
} from "./ocr";
import { parseLines } from "./parse";

/**
 * Best-effort import of an existing resume so users do not start from a blank
 * page. Everything runs in the browser; no file is uploaded anywhere.
 *
 * The pipeline is: extract positioned text → remove page furniture → order by
 * column and position → detect section headings → group into entries. Layout
 * varies far too much for this to be exact, so the goal is a usable first draft
 * that the user then corrects.
 */
export type ImportResult =
  | { ok: true; data: ResumeData; warnings: string[]; summary: string; viaOcr?: boolean }
  | { ok: false; reason: string; health?: PdfHealth; canOcr?: boolean; retry?: OcrRetry };

/** Everything needed to run OCR over the file that just failed to import. */
export type OcrRetry = { data: ArrayBuffer; pages: number };

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const isDocx = (file: File) =>
  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  /\.docx$/i.test(file.name);
const isText = (file: File) => file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(file.name);


/**
 * What to actually do about it. Routing to OCR the reader already owns beats
 * anything shipped in the page: Preview and Notes run on-device, and the
 * cloud options are far more accurate than an in-browser engine.
 */
function advice(health: PdfHealth): string {
  switch (health.kind) {
    case "image-only":
    case "undecodable":
      return "Open it in Preview on a Mac, or upload it to Google Drive and open it with Google Docs, then paste the recovered text here as a .txt file. Exporting a fresh PDF from the original document also works.";
    case "empty":
      return "Check that you picked the right file.";
    default:
      return "";
  }
}

export async function importResumeFile(file: File): Promise<ImportResult> {
  try {
    let lines: TextLine[];
    let partialNote = "";

    if (isPdf(file)) {
      const extraction = await extractPdf(file);
      const { health } = extraction;

      if (health.kind !== "ok" && health.kind !== "partial") {
        const canOcr = isRecoverableByOcr(health);
        return {
          ok: false,
          reason: `${explain(health)} ${advice(health)}`.trim(),
          health,
          canOcr,
          retry: canOcr ? { data: extraction.data, pages: extraction.pages } : undefined,
        };
      }

      lines = extraction.lines;
      if (!lines.length) {
        return {
          ok: false,
          reason: `${explain(health)} ${advice(health)}`.trim(),
          health,
          canOcr: true,
          retry: { data: extraction.data, pages: extraction.pages },
        };
      }
      if (health.kind === "partial") partialNote = explain(health);
    } else if (isDocx(file)) {
      lines = await extractDocxLines(file);
      if (!lines.length) return { ok: false, reason: "That Word file appears to be empty." };
    } else if (isText(file)) {
      lines = linesFromText(await file.text());
      if (!lines.length) return { ok: false, reason: "That file is empty." };
    } else if (/\.docx?$/i.test(file.name)) {
      return {
        ok: false,
        reason:
          "Legacy .doc files are not supported. Open it in Word or Google Docs and save as .docx or PDF.",
      };
    } else {
      return {
        ok: false,
        reason: "Unsupported file. Import a PDF, a Word .docx, or plain text.",
      };
    }

    const { data, warnings, summary } = parseLines(lines);
    return {
      ok: true,
      data,
      warnings: partialNote ? [partialNote, ...warnings] : warnings,
      summary,
    };
  } catch (error) {
    const detail = error instanceof Error && /ZIP|document\.xml/i.test(error.message)
      ? " That Word file could not be opened."
      : "";
    return {
      ok: false,
      reason: `That file could not be read.${detail} Try exporting it as a PDF and importing again.`,
    };
  }
}

export { parseLines } from "./parse";
export { linesFromText } from "./extract";
export { getOcrPagePlan, OCR_PAGE_LIMIT } from "./ocr";


/**
 * Reads a PDF by recognising its rendered pixels, for documents whose text
 * layer is absent or unusable. Downloads the recognition engine on first use.
 */
export async function importByOcr(retry: OcrRetry, options: OcrOptions = {}): Promise<ImportResult> {
  try {
    const result = await ocrPdf(retry.data, options);
    if (!result.lines.length) {
      return {
        ok: false,
        reason: "Nothing legible was found in that scan. A sharper or straighter scan may work better.",
      };
    }

    const { data, warnings, summary } = parseLines(result.lines);
    const pagePlan = getOcrPagePlan(result.totalPages, result.pagesProcessed);
    return {
      ok: true,
      data,
      viaOcr: true,
      summary,
      warnings: [
        ...(pagePlan.warning ? [pagePlan.warning] : []),
        ...riskyFieldWarnings(data, result),
        ...warnings,
      ],
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, reason: "Reading cancelled." };
    }
    return {
      ok: false,
      reason: "The scan could not be read. Try a clearer copy, or paste the text in instead.",
    };
  }
}
