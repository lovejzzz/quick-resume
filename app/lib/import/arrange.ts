import type { TextLine } from "./extract";

/*
 * Named `arrange` rather than `layout` on purpose: any file called layout.ts
 * inside app/ is claimed by the Next App Router as a route layout.
 */

/** Explicit page markers, dropped wherever they appear. */
const PAGE_MARKER = /^(?:page\s*)?\d+\s*(?:of|\/)\s*\d+$|^page\s+\d+$|^-\s*\d+\s*-$|^\d{1,2}$/i;

const FURNITURE_BAND = 0.12;

const fingerprint = (text: string) =>
  text
    .toLocaleLowerCase()
    // Page numbers vary between otherwise identical running heads.
    .replace(/\d+/g, "#")
    .replace(/[^a-z#]+/g, " ")
    .trim();

/**
 * Removes running headers, footers, and page numbers.
 *
 * A line is furniture when it sits in the top or bottom band of its page and an
 * equivalent line appears in the same band on another page. Single-page
 * documents keep everything except explicit page markers, because there is
 * nothing to corroborate against.
 */
export function removePageFurniture(lines: TextLine[]): TextLine[] {
  const withoutMarkers = lines.filter((line) => !PAGE_MARKER.test(line.text.trim()));
  const pages = new Set(withoutMarkers.map((line) => line.page));
  if (pages.size < 2) return withoutMarkers;

  const bounds = new Map<number, { top: number; bottom: number }>();
  for (const page of pages) {
    const ys = withoutMarkers.filter((line) => line.page === page).map((line) => line.y);
    bounds.set(page, { top: Math.min(...ys), bottom: Math.max(...ys) });
  }

  const inBand = (line: TextLine) => {
    const bound = bounds.get(line.page);
    if (!bound) return false;
    const height = bound.bottom - bound.top;
    if (height <= 0) return false;
    const offset = (line.y - bound.top) / height;
    return offset <= FURNITURE_BAND || offset >= 1 - FURNITURE_BAND;
  };

  // Counted by occurrence rather than by distinct page: when a document's
  // logical pages do not align with the PDF's, a running header can appear
  // twice within one physical page.
  const seen = new Map<string, number>();
  for (const line of withoutMarkers) {
    if (!inBand(line)) continue;
    const key = fingerprint(line.text);
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  const repeated = new Set(
    [...seen.entries()].filter(([, count]) => count >= 2).map(([key]) => key),
  );

  return withoutMarkers.filter(
    (line) => !(inBand(line) && repeated.has(fingerprint(line.text))),
  );
}

/** Orders lines the way a person reads them: page, then column, then down. */
export function readingOrder(lines: TextLine[]): TextLine[] {
  return [...lines].sort(
    (left, right) => left.page - right.page || left.column - right.column || left.y - right.y,
  );
}

/** Median body font size, used as the baseline for "is this bigger?" tests. */
export function bodySize(lines: TextLine[]): number {
  const sizes = lines.map((line) => line.size).sort((left, right) => left - right);
  return sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
}
