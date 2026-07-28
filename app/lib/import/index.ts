import type { ResumeData } from "../resume-model";
import { extractDocxLines } from "./docx";
import { extractPdfLines, linesFromText, type TextLine } from "./extract";
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
  | { ok: true; data: ResumeData; warnings: string[]; summary: string }
  | { ok: false; reason: string };

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const isDocx = (file: File) =>
  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  /\.docx$/i.test(file.name);
const isText = (file: File) => file.type.startsWith("text/") || /\.(txt|md|markdown)$/i.test(file.name);

export async function importResumeFile(file: File): Promise<ImportResult> {
  try {
    let lines: TextLine[];

    if (isPdf(file)) {
      lines = await extractPdfLines(file);
      if (!lines.length) {
        return {
          ok: false,
          reason:
            "No text was found in that PDF. It is most likely a scan — an image-only PDF cannot be read without OCR. Export a text PDF from the original document, or paste the text into a .txt file.",
        };
      }
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
    return { ok: true, data, warnings, summary };
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
