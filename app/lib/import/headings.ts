import type { SectionKind } from "../resume-model";
import type { TextLine } from "./extract";
import { capsRatio, collapseLetterSpacing, isLetterSpaced, wordCount } from "./normalize";

export type HeadingMatch = {
  kind: SectionKind;
  title: string;
  /** True when the text matched known vocabulary rather than looking like one. */
  known: boolean;
};

/**
 * Section vocabulary. Patterns allow the qualifiers resumes put around a
 * heading ("Professional Experience", "Relevant Coursework") so the match does
 * not depend on the exact wording.
 */
const VOCABULARY: { pattern: RegExp; kind: SectionKind; title: string }[] = [
  {
    pattern:
      /^(?:work|professional|relevant|related|industry|employment|career|additional)?\s*(?:experience|history)$|^employment(?:\s+history)?$|^work\s+history$|^career\s+summary$/i,
    kind: "experience",
    title: "Experience",
  },
  {
    pattern: /^education(?:\s*(?:&|and)\s*training)?$|^academic(?:\s+background|\s+history)?$|^academics$/i,
    kind: "education",
    title: "Education",
  },
  {
    pattern:
      /^(?:selected|personal|side|key|notable|academic|technical)?\s*projects?$|^portfolio$|^project\s+experience$/i,
    kind: "projects",
    title: "Projects",
  },
  {
    pattern:
      /^(?:technical|core|key|professional|relevant|additional)?\s*(?:skills?|competencies|proficiencies|expertise)$|^technologies$|^tools?(?:\s*&\s*technologies)?$|^areas?\s+of\s+expertise$/i,
    kind: "skills",
    title: "Skills",
  },
  {
    pattern:
      /^(?:awards?|honors?|honours?|achievements?|accomplishments?)(?:\s*(?:&|and)\s*(?:awards?|honors?|honours?))?$|^recognition$/i,
    kind: "awards",
    title: "Awards",
  },
  {
    pattern:
      /^(?:professional\s+)?summary$|^profile$|^objective$|^about(?:\s+me)?$|^overview$|^statement$|^personal\s+statement$|^career\s+objective$/i,
    kind: "summary",
    title: "Profile",
  },
  { pattern: /^certifications?$|^licen[cs]es?(?:\s*(?:&|and)\s*certifications?)?$/i, kind: "custom", title: "Certifications" },
  { pattern: /^publications?$|^papers?$|^research$/i, kind: "custom", title: "Publications" },
  { pattern: /^volunteer(?:ing|\s+experience)?$|^community(?:\s+involvement)?$/i, kind: "custom", title: "Volunteering" },
  { pattern: /^languages?$/i, kind: "custom", title: "Languages" },
  { pattern: /^interests?$|^hobbies$|^activities$/i, kind: "custom", title: "Interests" },
  { pattern: /^leadership$|^affiliations?$|^memberships?$/i, kind: "custom", title: "Leadership" },
  { pattern: /^references?$/i, kind: "custom", title: "References" },
  { pattern: /^coursework$|^relevant\s+coursework$/i, kind: "custom", title: "Coursework" },
  { pattern: /^contact(?:\s+(?:info|information|details))?$/i, kind: "custom", title: "Contact" },
];

/** Section headings are short; anything longer is a sentence. */
const MAX_HEADING_WORDS = 5;
const MAX_HEADING_CHARS = 46;

/**
 * Vocabulary-only match.
 *
 * The header block is delimited by these, never by the typographic heuristic
 * below — a person's name is also short, large, and set in a distinct face, so
 * the heuristic alone would mistake it for a section heading and swallow the
 * contact details that follow it.
 */
export function knownHeading(text: string): HeadingMatch | null {
  return lookUp(text);
}

/**
 * The same patterns with their whitespace matchers removed, for comparing
 * against letter-spaced headings that have been closed up.
 */
const SPACELESS = VOCABULARY.map((entry) => ({
  ...entry,
  pattern: new RegExp(entry.pattern.source.replace(/\\s[*+]/g, ""), "i"),
}));

function lookUp(text: string): HeadingMatch | null {
  const cleaned = text.replace(/[:.\u2022]+$/, "").replace(/\s{2,}/g, " ").trim();
  if (!cleaned || cleaned.length > MAX_HEADING_CHARS) return null;

  if (wordCount(cleaned) <= MAX_HEADING_WORDS) {
    const entry = VOCABULARY.find((candidate) => candidate.pattern.test(cleaned));
    if (entry) return { kind: entry.kind, title: entry.title, known: true };
  }

  if (isLetterSpaced(cleaned)) {
    const collapsed = collapseLetterSpacing(cleaned);
    const entry = SPACELESS.find((candidate) => candidate.pattern.test(collapsed));
    if (entry) return { kind: entry.kind, title: entry.title, known: true };
  }
  return null;
}

/** Title-cases an ALL CAPS heading so it does not shout in the resume. */
function presentTitle(text: string): string {
  const cleaned = text.replace(/[:.]+$/, "").trim();
  if (capsRatio(cleaned) < 0.9) return cleaned;
  return cleaned
    .toLocaleLowerCase()
    .replace(/(^|\s|\/|&\s)([a-zà-ÿ])/g, (_match, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase());
}

/**
 * Decides whether a line opens a new section.
 *
 * Known vocabulary wins outright. Otherwise a line may still be a heading on
 * typographic evidence — set in caps, in a larger face, or in a different font
 * from the body — which is how resumes mark bespoke sections the vocabulary
 * cannot anticipate.
 */
export function detectHeading(
  line: TextLine,
  context: { bodySize: number; nextLine?: TextLine },
): HeadingMatch | null {
  const text = line.text.trim();
  if (!text) return null;

  const known = lookUp(text);
  if (known) return known;

  if (text.length > MAX_HEADING_CHARS || wordCount(text) > MAX_HEADING_WORDS) return null;
  // A heading introduces something; a trailing line cannot be one.
  if (!context.nextLine) return null;
  // Sentence punctuation and contact details rule it out.
  if (/[.,;]$/.test(text) || /@|\d{3}[-.\s]\d{3}/.test(text)) return null;

  const isCaps = capsRatio(text) >= 0.85 && /[A-ZÀ-Þ]{2}/.test(text);
  const isLarger = line.size > context.bodySize * 1.08;
  const looksStyled = isCaps || (isLarger && line.emphasis) || (line.emphasis && isCaps);

  if (!looksStyled) return null;
  // The following line should be body text, not another heading-sized line.
  if (context.nextLine.size > line.size * 1.05) return null;

  return { kind: "custom", title: presentTitle(text), known: false };
}

/** Job-title words, used to tell a role from an employer within an entry. */
export const TITLE_WORDS =
  /\b(engineer|developer|manager|director|analyst|designer|scientist|coordinator|consultant|specialist|lead|head|officer|intern|associate|architect|administrator|president|founder|owner|partner|nurse|teacher|professor|lecturer|researcher|fellow|assistant|technician|accountant|attorney|lawyer|editor|producer|strategist|recruiter|buyer|planner|supervisor|chief|principal|staff|senior|junior|vp|cto|ceo|coo|cfo|advisor|adviser|agent|ambassador|apprentice|artist|auditor|barista|bookkeeper|captain|chef|clerk|counsel|curator|dean|dentist|dietitian|doctor|driver|economist|electrician|examiner|executive|foreman|guard|inspector|instructor|investigator|journalist|librarian|machinist|marketer|mechanic|mediator|paralegal|paramedic|pharmacist|photographer|physician|pilot|plumber|programmer|psychologist|receptionist|representative|scout|secretary|steward|surgeon|surveyor|therapist|trainer|translator|tutor|underwriter|veterinarian|writer)\b/i;

/** Institution words, used to tell a school from a degree. */
export const SCHOOL_WORDS =
  /\b(university|universität|college|institute|instituto|school|academy|polytechnic|conservatory|seminary|universidad|université)\b/i;

/** Degree words, so a qualification is never mistaken for the institution. */
export const DEGREE_WORDS =
  /\b(bachelor|b\.?s\.?c?\.?|b\.?a\.?|master|m\.?s\.?c?\.?|m\.?a\.?|m\.?b\.?a\.?|ph\.?d\.?|doctor|doctorate|associate|diploma|certificate|j\.?d\.?|m\.?d\.?|b\.?eng\.?|m\.?eng\.?|b\.?f\.?a\.?|m\.?f\.?a\.?)\b/i;
