import type { ResumeData } from "./resume-model";

/**
 * Client-side keyword gap analysis. A job description is tokenised, ranked by
 * frequency, and diffed against the resume so the writer can see which terms a
 * keyword-matching applicant tracking system will not find.
 *
 * Nothing leaves the browser.
 */

const STOP_WORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below
   between both but by can cannot could did do does doing down during each few for from further had has
   have having he her here hers herself him himself his how i if in into is it its itself me more most
   my myself nor not of off on once only or other ought our ours ourselves out over own same she should
   so some such than that the their theirs them themselves then there these they this those through to
   too under until up very was we were what when where which while who whom why with would you your
   yours yourself yourselves will shall may might must also across within upon per via etc using use
   used one two three new role job work working experience years year team teams strong ability able
   including include includes required require requirements responsibilities qualifications preferred
   plus skills skill knowledge understanding excellent good great best help helps helping support
   supporting company candidate candidates position opportunity looking seeking join us our we you
   your they their it this that these those who whom what when how why be been being have has had do
   does did will would can could should may might must
   essential daily weekly monthly matters wanted hiring hire apply applicant applicants applying
   ideal ideally successful desired desirable nice must-have familiarity proficiency proficient
   demonstrated proven track record ensure ensuring various multiple several etc please note
   responsibility duty duties day-to-day cross-functional partner partners stakeholder stakeholders`
    .split(/\s+/)
    .filter(Boolean),
);

/** Terms worth surfacing even though they are short or look like stop words. */
const KEEP_SHORT = new Set(["ai", "ml", "qa", "ux", "ui", "bi", "hr", "go", "r", "c"]);

export type KeywordHit = {
  term: string;
  count: number;
  matched: boolean;
};

export type MatchReport = {
  score: number;
  matched: KeywordHit[];
  missing: KeywordHit[];
  totalTerms: number;
};

function normalise(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[‘’“”]/g, "'")
    // Keep +, #, and . so terms like c++, c#, and node.js survive.
    .replace(/[^a-z0-9+#.\s-]/g, " ");
}

/** Crude but predictable singularisation so "designers" matches "designer". */
function stem(term: string): string {
  if (term.length <= 3) return term;
  if (term.endsWith("ies")) return `${term.slice(0, -3)}y`;
  if (term.endsWith("sses") || term.endsWith("shes") || term.endsWith("ches")) {
    return term.slice(0, -2);
  }
  if (term.endsWith("s") && !term.endsWith("ss") && !term.endsWith("us")) {
    return term.slice(0, -1);
  }
  return term;
}

function tokenise(text: string): string[] {
  return normalise(text)
    .split(/[\s-]+/)
    .map((token) => token.replace(/^[.+#]+|[.+#]+$/g, (match, offset: number) =>
      // Trailing punctuation goes, but keep it when it is part of the term
      // itself (c++, c#, .net).
      offset === 0 && match === "." ? match : match === "." ? "" : match,
    ))
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function isMeaningful(token: string): boolean {
  if (KEEP_SHORT.has(token)) return true;
  if (token.length < 3) return false;
  if (STOP_WORDS.has(token)) return false;
  if (/^\d+$/.test(token)) return false;
  return true;
}

/** Flattens every piece of user-authored resume text into one search corpus. */
export function resumeCorpus(data: ResumeData): string {
  const parts: string[] = [data.name, data.headline, data.location];
  for (const section of data.sections) {
    parts.push(section.title);
    for (const entry of section.entries) {
      parts.push(entry.heading, entry.subheading, entry.details, entry.link ?? "");
      parts.push(...entry.bullets);
    }
  }
  return parts.filter(Boolean).join(" \n ");
}

export function analyseJobMatch(
  jobDescription: string,
  data: ResumeData,
  limit = 28,
): MatchReport {
  const tokens = tokenise(jobDescription).filter(isMeaningful);
  if (!tokens.length) {
    return { score: 0, matched: [], missing: [], totalTerms: 0 };
  }

  // Rank single terms by frequency, keeping the first spelling seen.
  const counts = new Map<string, { term: string; count: number }>();
  for (const token of tokens) {
    const key = stem(token);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { term: token, count: 1 });
  }

  // Two-word phrases that recur are usually the real requirements
  // ("product design", "machine learning"), so score them above bare tokens.
  const phrases = new Map<string, { term: string; count: number }>();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = stem(tokens[index]);
    const right = stem(tokens[index + 1]);
    // A word repeated back to back ("clusters clusters") is emphasis or noise,
    // never a real phrase, and letting it through would mask the single term.
    if (left === right) continue;
    const key = `${left} ${right}`;
    const existing = phrases.get(key);
    if (existing) existing.count += 1;
    else phrases.set(key, { term: `${tokens[index]} ${tokens[index + 1]}`, count: 1 });
  }

  const ranked = [
    ...[...phrases.entries()]
      .filter(([, value]) => value.count >= 2)
      .map(([key, value]) => ({ key, ...value, weight: value.count * 2.2 })),
    ...[...counts.entries()].map(([key, value]) => ({
      key,
      ...value,
      weight: value.count,
    })),
  ].sort((left, right) => right.weight - left.weight);

  // Drop single terms already represented by a surfaced phrase.
  const seenWords = new Set<string>();
  const selected: typeof ranked = [];
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    const words = candidate.key.split(" ");
    if (words.length === 1 && seenWords.has(words[0])) continue;
    selected.push(candidate);
    words.forEach((word) => seenWords.add(word));
  }

  const corpusTokens = tokenise(resumeCorpus(data)).map(stem);
  const corpusSet = new Set(corpusTokens);
  const corpusText = ` ${corpusTokens.join(" ")} `;

  const hits: KeywordHit[] = selected.map((candidate) => {
    const words = candidate.key.split(" ");
    const matched =
      words.length === 1
        ? corpusSet.has(words[0])
        : corpusText.includes(` ${candidate.key} `);
    return { term: candidate.term, count: candidate.count, matched };
  });

  const matched = hits.filter((hit) => hit.matched);
  return {
    score: hits.length ? Math.round((matched.length / hits.length) * 100) : 0,
    matched,
    missing: hits.filter((hit) => !hit.matched),
    totalTerms: hits.length,
  };
}
