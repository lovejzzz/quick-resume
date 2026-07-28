/**
 * Works out *why* a PDF yielded no usable text.
 *
 * "No text" collapses several different problems together, and they need
 * different answers. A page with no text layer at all is a scan. A page whose
 * text decodes to nonsense has a broken font encoding — the characters are
 * there, but the map from glyph to character is missing or wrong, which is what
 * a subsetted font without a ToUnicode table produces. A document with text on
 * some pages only is usually a scan with a cover sheet, or the reverse.
 */

export type PdfHealth =
  | { kind: "ok" }
  | { kind: "empty" }
  | { kind: "image-only"; pages: number }
  | { kind: "undecodable"; sample: string }
  | { kind: "partial"; textPages: number; totalPages: number };

export type PageStats = {
  page: number;
  textChars: number;
  images: number;
  text: string;
};

/**
 * Function words and resume vocabulary across the major Latin-script
 * languages. Restricting this to English would make a French or German resume
 * score zero and look like garbage, so the non-English entries are what keep
 * the check safe rather than merely accurate.
 */
const COMMON_WORDS = new Set(
  `the and for with to of in a is at on as by from an or be was were has have had
   experience education skills work project projects manager engineer developer
   designer analyst director senior junior lead team university college school
   bachelor master science arts business management development design research
   data software product marketing sales support service customer client company
   present current year years month months new inc llc ltd department
   responsible including using across within their our other more most
   et le la les des du de pour avec dans sur une un est aux par ans
   experiences formation competences entreprise developpeur ingenieur
   el los las por para con una uno del al es en experiencia educacion
   habilidades empresa ingeniero desarrollador universidad anos
   und der die das den dem ein eine fur mit von bei auf ist als aus im
   erfahrung ausbildung kenntnisse unternehmen entwickler jahre
   di il lo gli per con una del della sono anni esperienza istruzione
   e o os as um uma do da dos das em anos formacao empresa
   van het een en met voor bij is op aan jaar ervaring opleiding`
    .split(/\s+/)
    .filter(Boolean),
);

const LATIN = /[A-Za-zÀ-ÿ]/g;
const VOWELS = /[aeiouyAEIOUYàáâãäåèéêëìíîïòóôõöùúûüÿ]/g;

/**
 * How much this text looks like natural language.
 *
 * Deliberately conservative: a false positive here would block a perfectly good
 * import, so the caller only acts on a strong signal.
 */
export function languageScore(text: string): {
  latinRatio: number;
  vowelRatio: number;
  commonWordRatio: number;
  words: number;
  puaRatio: number;
} {
  const codes = [...text];
  const total = codes.length || 1;
  const pua = codes.filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    // Private use area, plus the replacement character.
    return (code >= 0xe000 && code <= 0xf8ff) || code === 0xfffd;
  }).length;

  const latin = (text.match(LATIN) ?? []).length;
  const vowels = (text.match(VOWELS) ?? []).length;
  const words = text.toLocaleLowerCase().match(/[a-zà-ÿ]{2,}/g) ?? [];
  const hits = words.filter((word) => COMMON_WORDS.has(word)).length;

  return {
    latinRatio: latin / total,
    vowelRatio: latin ? vowels / latin : 0,
    commonWordRatio: words.length ? hits / words.length : 0,
    words: words.length,
    puaRatio: pua / total,
  };
}

/*
 * Thresholds measured across the fixture corpus: real resumes score
 * 0.391-0.410 for vowels and 0.128-0.233 for common words, while text from a
 * broken encoding scores 0.318 and 0.000. Both conditions must fail together
 * before anything is rejected, so an unusual but genuine resume survives.
 */
const MIN_VOWEL_RATIO = 0.36;
/** Enough words that the statistics mean something. */
const MIN_WORDS_TO_JUDGE = 40;
const MIN_COMMON_WORD_RATIO = 0.05;
/** Above this share of unmappable glyphs, the encoding is definitively broken. */
const MAX_PUA_RATIO = 0.15;
/** Fewer characters than this on a page means it carries no real content. */
const MIN_PAGE_CHARS = 24;

export function diagnose(pages: PageStats[]): PdfHealth {
  if (!pages.length) return { kind: "empty" };

  const allText = pages.map((page) => page.text).join(" ");
  const score = languageScore(allText);

  // An unmappable-glyph run is unambiguous, whatever the length.
  if (allText.length > 0 && score.puaRatio > MAX_PUA_RATIO) {
    return { kind: "undecodable", sample: sampleOf(allText) };
  }

  const pagesWithText = pages.filter((page) => page.textChars >= MIN_PAGE_CHARS);
  const pagesWithImages = pages.filter((page) => page.images > 0);

  if (!pagesWithText.length) {
    return pagesWithImages.length
      ? { kind: "image-only", pages: pages.length }
      : { kind: "empty" };
  }

  /*
   * Only judge legibility for Latin-script text. Vowel frequency says nothing
   * about Chinese or Arabic, and treating those as broken would reject
   * perfectly good resumes.
   */
  const latinDominant = score.latinRatio > 0.5;
  if (
    latinDominant &&
    score.words >= MIN_WORDS_TO_JUDGE &&
    score.vowelRatio < MIN_VOWEL_RATIO &&
    score.commonWordRatio < MIN_COMMON_WORD_RATIO
  ) {
    return { kind: "undecodable", sample: sampleOf(allText) };
  }

  if (pagesWithText.length < pages.length && pagesWithImages.length) {
    return { kind: "partial", textPages: pagesWithText.length, totalPages: pages.length };
  }

  return { kind: "ok" };
}

const sampleOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 48);

/** Whether OCR could plausibly recover this document. */
export const isRecoverableByOcr = (health: PdfHealth) =>
  health.kind === "image-only" || health.kind === "undecodable" || health.kind === "partial";

/**
 * User-facing explanation. Each case gets the action that actually helps, and
 * `undecodable` is called out separately because the page looks perfectly
 * readable on screen — the problem is invisible without this message.
 */
export function explain(health: PdfHealth): string {
  switch (health.kind) {
    case "image-only":
      return health.pages === 1
        ? "That PDF has no text layer — it is a scan or a photo of a document."
        : `That PDF has no text layer — all ${health.pages} pages are images, so it is a scan or a photo.`;
    case "undecodable":
      return `That PDF's fonts carry no character map, so its text extracts as nonsense (“${health.sample}…”) even though the page looks fine on screen.`;
    case "partial":
      return `Only ${health.textPages} of ${health.totalPages} pages have readable text; the rest are images.`;
    case "empty":
      return "That PDF appears to be blank.";
    case "ok":
      return "";
  }
}
