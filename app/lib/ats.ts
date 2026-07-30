import type { ResumeData } from "./resume-model";

/**
 * Literal client-side term comparison. Nothing leaves the browser.
 *
 * This deliberately does not score job fit or infer whether experience is
 * relevant. It only reports whether selected terms also appear in the resume.
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
   does did will would can could should may might must essential daily weekly monthly matters wanted
   hiring hire apply applicant applicants applying ideal ideally successful desired desirable nice
   familiarity proficiency proficient demonstrated proven track record ensure ensuring various
   multiple several please note responsibility duty duties day-to-day cross-functional partner
   partners stakeholder stakeholders`
    .split(/\s+/)
    .filter(Boolean),
);

const KEEP_SHORT = new Set(["ai", "ml", "qa", "ux", "ui", "bi", "hr", "go", "r", "c"]);

export type KeywordHit = {
  term: string;
  count: number;
  matched: boolean;
};

export type TermComparison = {
  matched: KeywordHit[];
  missing: KeywordHit[];
  totalTerms: number;
};

function normalise(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9+#.\s-]/g, " ");
}

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
    .map((token) =>
      token.replace(/^[.+#]+|[.+#]+$/g, (match, offset: number) =>
        offset === 0 && match === "." ? match : match === "." ? "" : match,
      ),
    )
    .map((token) => token.trim())
    .filter(Boolean);
}

function isMeaningful(token: string): boolean {
  if (KEEP_SHORT.has(token)) return true;
  if (token.length < 3 || STOP_WORDS.has(token) || /^\d+$/.test(token)) return false;
  return true;
}

export function resumeCorpus(data: ResumeData): string {
  const parts: string[] = [
    data.name,
    data.headline,
    data.email,
    data.phone,
    data.location,
    data.portfolio,
    data.secondaryLink,
  ];
  for (const section of data.sections) {
    parts.push(section.title);
    for (const entry of section.entries) {
      parts.push(entry.heading, entry.subheading, entry.details, entry.link ?? "", ...entry.bullets);
    }
  }
  return parts.filter(Boolean).join(" \n ");
}

export function compareJobTerms(
  jobDescription: string,
  data: ResumeData,
  limit = 28,
): TermComparison {
  const tokens = tokenise(jobDescription).filter(isMeaningful);
  if (!tokens.length) return { matched: [], missing: [], totalTerms: 0 };

  const counts = new Map<string, { term: string; count: number }>();
  for (const token of tokens) {
    const key = stem(token);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { term: token, count: 1 });
  }

  const phrases = new Map<string, { term: string; count: number }>();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = stem(tokens[index]);
    const right = stem(tokens[index + 1]);
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
    ...[...counts.entries()].map(([key, value]) => ({ key, ...value, weight: value.count })),
  ].sort((left, right) => right.weight - left.weight);

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
      words.length === 1 ? corpusSet.has(words[0]) : corpusText.includes(` ${candidate.key} `);
    return { term: candidate.term, count: candidate.count, matched };
  });
  const matched = hits.filter((hit) => hit.matched);
  return {
    matched,
    missing: hits.filter((hit) => !hit.matched),
    totalTerms: hits.length,
  };
}
