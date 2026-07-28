/**
 * Kept as the public import surface. The implementation lives in ./import,
 * split by stage: extraction, layout analysis, heading detection, parsing.
 */
export {
  importByOcr,
  importResumeFile,
  linesFromText,
  parseLines,
  type ImportResult,
  type OcrRetry,
} from "./import";
export type { OcrProgress } from "./import/ocr";

import { linesFromText } from "./import/extract";
import { parseLines } from "./import/parse";
import type { ResumeData } from "./resume-model";

/** Convenience wrapper used by tests: parse already-split plain text lines. */
export function parseResumeLines(lines: string[]): ResumeData {
  return parseLines(linesFromText(lines.join("\n"))).data;
}
