/** Field-level patterns shared by the importer. */

export const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;

/**
 * Phone numbers, permissive enough for international forms but anchored so a
 * long identifier or a date range cannot masquerade as one.
 */
export const PHONE =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3}[\s.-]?\d{3,4}(?![\d-])/;

export const LINK =
  /\b(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|dev|me|co|ai|app|edu|gov|uk|ca|de|fr|nl|au|xyz|tech|design|studio)(?:\/[^\s,;|·•]*)?/i;

/** Recognisable profile hosts, so the better link wins the portfolio slot. */
const KNOWN_HOSTS = /(linkedin|github|gitlab|behance|dribbble|medium|substack|orcid|scholar\.google)/i;

export const MONTH_NAMES =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const SEASONS = "spring|summer|fall|autumn|winter";
const YEAR = "(?:19|20)\\d{2}";
/** One end of a range: "May 2021", "Summer 2019", "03/2021", "2021", "2026/02". */
const POINT = `(?:(?:${MONTH_NAMES}|${SEASONS})\\.?\\s+)?${YEAR}(?:[/.-]\\d{1,2})?|\\d{1,2}[/.]${YEAR}`;
const OPEN_END = "present|current|now|ongoing|to\\s+date|date";
const DASH = "(?:[-–—~]|\\bto\\b|\\buntil\\b)";

/**
 * Does this line carry a date at all?
 *
 * A year is required. The open-ended terms are deliberately excluded here —
 * "now", "current", and "date" are ordinary words, and accepting them marked
 * prose such as "the runbook now used company-wide" as dated.
 */
export const HAS_DATE = new RegExp(
  `\\b(?:${YEAR}\\b|(?:${MONTH_NAMES}|${SEASONS})\\.?\\s+${YEAR}|\\d{1,2}[/.]${YEAR})`,
  "i",
);

/** A full range, anywhere in the line. */
export const DATE_RANGE = new RegExp(
  `((?:${POINT})\\s*${DASH}\\s*(?:(?:${POINT})|${OPEN_END}))`,
  "i",
);

/** A single date, used when no range is present. */
export const SINGLE_DATE = new RegExp(`((?:${POINT}))`, "i");

/**
 * LinkedIn appends an elapsed-time suffix to every role. It is noise once the
 * range itself has been captured.
 */
export const DURATION_SUFFIX = /\s*\((?:\d+\s+(?:yrs?|years?|mos?|months?)[\s,]*)+\)\s*/gi;

/**
 * "City, ST", "City, State", "City, State, Country" — including accented
 * names. The optional third part matters: LinkedIn writes locations as
 * "Boston, Massachusetts, United States", and stopping at the state would
 * leave enough of the string unmatched to fail the caller's sanity check.
 */
export const LOCATION =
  /\b([A-ZÀ-Þ][\wÀ-ÿ.'-]*(?:[ ][A-ZÀ-Þ][\wÀ-ÿ.'-]*){0,3},\s*(?:[A-Z]{2}\b|[A-ZÀ-Þ][a-zà-ÿ]+(?:\s+[A-ZÀ-Þ][a-zà-ÿ]+){0,2})(?:,\s*[A-ZÀ-Þ][a-zà-ÿ]+(?:\s+[A-ZÀ-Þ][a-zà-ÿ]+){0,2})?)/;

/** Separators used between contact details on one line. */
export const CONTACT_SPLIT = /\s*(?:[|•·●∙‧⋅]|(?:\s[–—-]\s)|(?:\s{3,}))\s*/;

export function extractDate(line: string): { date: string; rest: string } {
  const range = line.match(DATE_RANGE);
  if (range) {
    return {
      date: normaliseDate(range[1]),
      rest: (line.slice(0, range.index) + line.slice((range.index ?? 0) + range[1].length)).trim(),
    };
  }
  const single = line.match(SINGLE_DATE);
  if (single) {
    return {
      date: normaliseDate(single[1]),
      rest: (line.slice(0, single.index) + line.slice((single.index ?? 0) + single[1].length)).trim(),
    };
  }
  return { date: "", rest: line };
}

function normaliseDate(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*[-–—~]\s*/, " – ").trim();
}

/** Trims separator debris left behind after a field is pulled out of a line. */
export const tidy = (value: string) =>
  value
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|•·,;–—-]+/, "")
    .replace(/[\s|•·,;–—-]+$/, "")
    .trim();

export function classifyLink(link: string): "profile" | "other" {
  return KNOWN_HOSTS.test(link) ? "profile" : "other";
}
