import type { PageSize } from "./resume-model";

export type PageGeometry = {
  id: PageSize;
  label: string;
  note: string;
  /** CSS `@page size` keyword. */
  cssSize: string;
  /** Paper width in CSS pixels at 96dpi. */
  widthPx: number;
  /** Paper height in CSS pixels at 96dpi. */
  heightPx: number;
  /**
   * Usable height before content spills onto a second sheet. Browsers reserve a
   * little vertical space when printing edge-to-edge, so this sits under the
   * full sheet height.
   */
  printSafeHeightPx: number;
};

const LETTER: PageGeometry = {
  id: "letter",
  label: "US Letter",
  note: "8.5 × 11 in — US, Canada",
  cssSize: "letter",
  widthPx: 816,
  heightPx: 1056,
  printSafeHeightPx: 1038,
};

const A4: PageGeometry = {
  id: "a4",
  label: "A4",
  note: "210 × 297 mm — most other countries",
  cssSize: "A4",
  // 210mm / 297mm at 96dpi.
  widthPx: 794,
  heightPx: 1123,
  printSafeHeightPx: 1104,
};

export const pageGeometries: PageGeometry[] = [LETTER, A4];

export const getPageGeometry = (id: PageSize): PageGeometry =>
  pageGeometries.find((geometry) => geometry.id === id) ?? LETTER;
