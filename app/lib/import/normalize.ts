/** Text cleanup applied to every extracted line, whatever the source format. */

const LIGATURES: [RegExp, string][] = [
  [/ﬀ/g, "ff"],
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  [/ﬃ/g, "ffi"],
  [/ﬄ/g, "ffl"],
  [/ﬅ/g, "st"],
  [/ﬆ/g, "st"],
];

/**
 * Normalises the characters PDF producers emit that would otherwise show up
 * verbatim in the resume: ligature glyphs, curly punctuation, non-breaking and
 * zero-width spaces, and soft hyphens.
 */
export function normaliseText(value: string): string {
  let text = value;
  for (const [pattern, replacement] of LIGATURES) text = text.replace(pattern, replacement);
  return text
    .replace(/­/g, "")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/…/g, "...")
    .replace(/[      ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bullet glyphs that begin a list item, plus the ASCII stand-ins for them. */
export const BULLET_PREFIX =
  /^\s*(?:[•·▪◦‣∙⁃⁌⁍●○■□❖✿✱*»→⇒]|[-–—](?=\s))\s*/;

export const stripBullet = (line: string) => line.replace(BULLET_PREFIX, "").trim();
export const isBulletLine = (line: string) => BULLET_PREFIX.test(line);

/**
 * Rejoins words broken across a line break by a hyphen.
 *
 * Only applied when the next line starts lowercase, so genuine compounds at a
 * line end ("multi-region", "first-author") survive intact.
 */
export function dehyphenate(lines: string[]): string[] {
  const output: string[] = [];
  for (const line of lines) {
    const previous = output[output.length - 1];
    if (
      previous &&
      /[A-Za-zÀ-ɏ]-$/.test(previous) &&
      /^[a-zß-ɏ]/.test(line)
    ) {
      output[output.length - 1] = previous.slice(0, -1) + line;
      continue;
    }
    output.push(line);
  }
  return output;
}

/** Upper-case ratio, ignoring digits and punctuation. Used to spot headings. */
export function capsRatio(value: string): number {
  const letters = value.replace(/[^A-Za-zÀ-ɏ]/g, "");
  if (!letters) return 0;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  return upper / letters.length;
}

export const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

/**
 * Detects CSS letter-spacing that survived text extraction.
 *
 * A heading set with `letter-spacing` reaches pdf.js as one string whose glyphs
 * are already separated — "EDUCATION" arrives as "E D U C AT I O N" — so the
 * gaps cannot be measured geometrically and have to be spotted in the text.
 */
export function isLetterSpaced(value: string): boolean {
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return false;
  const short = tokens.filter((token) => token.length <= 2).length;
  return short / tokens.length >= 0.7;
}

/**
 * Removes letter-spacing gaps. The genuine word break is indistinguishable
 * from the letter gaps once extracted, so everything closes up and callers
 * compare against equally space-free text.
 */
export const collapseLetterSpacing = (value: string) => value.replace(/\s+/g, "");
