import {
  makeId,
  type ResumeData,
  type ResumeEntry,
  type ResumeSection,
  type SectionKind,
} from "../resume-model";
import type { TextLine } from "./extract";
import { DEGREE_WORDS, SCHOOL_WORDS, TITLE_WORDS, detectHeading, knownHeading } from "./headings";
import { bodySize, readingOrder, removePageFurniture } from "./arrange";
import { capsRatio, dehyphenate, isBulletLine, stripBullet, wordCount } from "./normalize";
import {
  CONTACT_SPLIT,
  DURATION_SUFFIX,
  EMAIL,
  HAS_DATE,
  LINK,
  LOCATION,
  PHONE,
  classifyLink,
  extractDate,
  tidy,
} from "./patterns";

const blankEntry = (): ResumeEntry => ({
  id: makeId(),
  heading: "",
  subheading: "",
  date: "",
  details: "",
  bullets: [],
});

const emptyResume = (): ResumeData => ({
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  portfolio: "",
  secondaryLink: "",
  photo: "",
  sections: [],
});


/**
 * Detects a wrapped line: the tail of a sentence the layout pushed onto the
 * next row. Resume lines start with a capital, a digit, or a bullet glyph, so a
 * lower-case opening after an unterminated line is a continuation rather than a
 * new item.
 */
function isContinuation(previous: TextLine, line: TextLine): boolean {
  if (previous.page !== line.page || previous.column !== line.column) return false;
  if (isBulletLine(line.text)) return false;
  // A contact detail is its own line even when it opens lower-case, as an
  // email address does.
  if (EMAIL.test(line.text) || PHONE.test(line.text) || LINK.test(line.text)) return false;
  // An entry that opens with a date is a new item, however it is capitalised.
  if (HAS_DATE.test(line.text)) return false;
  // A finished sentence does not continue.
  if (/[.!?:;]$/.test(previous.text)) return false;
  return /^[a-zà-ÿ]/.test(line.text);
}

/* ------------------------------------------------------------------ header */

/**
 * Picks the candidate name: the largest text near the top of page one that is
 * not a contact detail. Falls back to the first line when every line is set at
 * the same size, as in plain text.
 */
function findName(lines: TextLine[]): TextLine | null {
  // Only the opening of each column can hold the name.
  const head = lines.slice(0, 20);
  const plausible = head.filter(
    (line) =>
      wordCount(line.text) <= 6 &&
      line.text.length <= 60 &&
      !EMAIL.test(line.text) &&
      !PHONE.test(line.text) &&
      !LINK.test(line.text) &&
      !/\d/.test(line.text) &&
      // Only real section vocabulary disqualifies a line here.
      !knownHeading(line.text),
  );
  if (!plausible.length) return null;
  const largest = Math.max(...plausible.map((line) => line.size));
  return plausible.find((line) => line.size === largest) ?? plausible[0];
}

/** Pulls email, phone, links, and location out of the pre-heading block. */
function parseHeader(header: TextLine[], data: ResumeData, nameLine: TextLine | null) {
  const tokens: string[] = [];
  for (const line of header) {
    if (nameLine && line === nameLine) continue;
    tokens.push(...line.text.split(CONTACT_SPLIT).map((token) => token.trim()).filter(Boolean));
  }

  const leftovers: string[] = [];
  const links: string[] = [];

  for (const token of tokens) {
    let rest = token;

    const email = rest.match(EMAIL);
    if (email && !data.email) {
      data.email = email[0];
      rest = tidy(rest.replace(email[0], ""));
    }

    const phone = rest.match(PHONE);
    if (phone && !data.phone) {
      data.phone = phone[0].trim();
      rest = tidy(rest.replace(phone[0], ""));
    }

    // Match links only after removing addresses, or "example.com" gets mined
    // out of "someone@example.com".
    const withoutEmails = rest.replace(new RegExp(EMAIL.source, "g"), " ");
    const link = withoutEmails.match(LINK);
    if (link) {
      links.push(link[0]);
      rest = tidy(rest.replace(link[0], ""));
    }

    if (!rest) continue;

    const location = rest.match(LOCATION);
    // A location token is mostly the location itself; a sentence that happens
    // to contain "Something, Somewhere" is not one.
    if (location && !data.location && location[0].length >= rest.length * 0.6) {
      data.location = location[0].trim();
      rest = tidy(rest.replace(location[0], ""));
    }

    if (rest) leftovers.push(rest);
  }

  // Profile links (LinkedIn, GitHub, …) are the more useful primary link.
  links.sort((left, right) => Number(classifyLink(right) === "profile") - Number(classifyLink(left) === "profile"));
  data.portfolio = links[0] ?? "";
  data.secondaryLink = links[1] ?? "";

  if (!data.headline) {
    const headline = leftovers.find(
      (token) => wordCount(token) >= 2 && wordCount(token) <= 12 && !/^\d/.test(token),
    );
    if (headline) data.headline = headline;
  }
}

/* ----------------------------------------------------------------- entries */

type Block = { head: TextLine[]; bullets: string[] };

/**
 * Groups a section's lines into one block per resume item.
 *
 * `baseX` is the section's dominant left margin. Many PDF producers drop the
 * glyph from a list item but keep its indent, so a line starting to the right
 * of the margin is treated as a bullet even without a marker.
 */
function blocksFrom(lines: TextLine[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  const baseX = lines.length ? Math.min(...lines.map((line) => line.x)) : 0;
  const indentStep = Math.max(3, (lines[0]?.size ?? 10) * 0.35);

  for (const line of lines) {
    const text = line.text;
    if (isBulletLine(text)) {
      current ??= { head: [], bullets: [] };
      current.bullets.push(stripBullet(text));
      continue;
    }

    const hasDate = HAS_DATE.test(text);
    const indented = line.x > baseX + indentStep;
    // A long, date-free line inside an open item reads as an accomplishment,
    // not as another title line.
    const looksLikeProse = !hasDate && wordCount(text) >= 7;

    if (current && current.head.length > 0 && (indented || looksLikeProse)) {
      current.bullets.push(stripBullet(text));
      continue;
    }

    const startsNew =
      !current ||
      current.bullets.length > 0 ||
      (hasDate && current.head.some((head) => HAS_DATE.test(head.text))) ||
      current.head.length >= 3;

    if (startsNew) {
      if (current) blocks.push(current);
      current = { head: [], bullets: [] };
    }
    current!.head.push(line);
  }
  if (current) blocks.push(current);

  return blocks.filter((block) => block.head.length || block.bullets.length);
}

/**
 * Assigns the head lines of a block to heading, subheading, and date.
 *
 * Resumes disagree about ordering — a LinkedIn export puts the employer above
 * the role, most templates do the reverse — so the role is chosen by evidence
 * (emphasis, then title vocabulary) rather than by position.
 */
function readBlock(block: Block, kind: SectionKind): ResumeEntry {
  const entry = blankEntry();
  const parts: { text: string; emphasis: boolean; size: number }[] = [];

  for (const line of block.head) {
    const cleaned = line.text.replace(DURATION_SUFFIX, " ").trim();
    const { date, rest } = extractDate(cleaned);
    if (date && !entry.date) entry.date = date;
    const remainder = tidy(date ? rest : cleaned);
    if (remainder) parts.push({ text: remainder, emphasis: line.emphasis, size: line.size });
  }

  if (!parts.length) {
    entry.bullets = block.bullets;
    return entry;
  }

  // A single head line may still carry "Role — Employer" or "Role, Employer".
  if (parts.length === 1) {
    const split = parts[0].text.split(/\s*[|·]\s+|\s+[—–]\s+|,\s+(?=[A-ZÀ-Þ])/).map((piece) => piece.trim()).filter(Boolean);
    if (split.length > 1) {
      parts.length = 0;
      for (const piece of split) parts.push({ text: piece, emphasis: false, size: 0 });
    }
  }

  const isEducation = kind === "education";
  const primaryTest = isEducation ? SCHOOL_WORDS : TITLE_WORDS;

  let primaryIndex = parts.findIndex((part) => primaryTest.test(part.text));
  if (isEducation && primaryIndex < 0) {
    // Prefer whichever line is not the degree.
    const degreeIndex = parts.findIndex((part) => DEGREE_WORDS.test(part.text));
    if (degreeIndex >= 0) primaryIndex = parts.findIndex((_part, index) => index !== degreeIndex);
  }
  if (primaryIndex < 0) {
    const emphasised = parts.findIndex((part) => part.emphasis);
    primaryIndex = emphasised >= 0 ? emphasised : 0;
  }

  entry.heading = parts[primaryIndex].text;
  const remaining = parts.filter((_part, index) => index !== primaryIndex);
  if (remaining.length) entry.subheading = remaining[0].text;
  if (remaining.length > 1) entry.details = remaining.slice(1).map((part) => part.text).join(" ");

  entry.bullets = block.bullets;
  return entry;
}

/* ---------------------------------------------------------------- sections */

function buildSkills(lines: TextLine[]): ResumeEntry[] {
  const entries: ResumeEntry[] = [];
  for (const line of lines) {
    const text = stripBullet(line.text);
    if (!text) continue;
    const entry = blankEntry();
    const [label, ...rest] = text.split(/:\s*/);
    if (rest.length && wordCount(label) <= 4) {
      entry.heading = label.trim();
      entry.details = rest.join(": ").trim();
    } else {
      entry.details = text;
    }
    entries.push(entry);
  }
  return entries;
}

function buildSummary(lines: TextLine[]): ResumeEntry[] {
  const entry = blankEntry();
  entry.details = lines.map((line) => stripBullet(line.text)).join(" ").trim();
  return entry.details ? [entry] : [];
}

/* -------------------------------------------------------------------- main */

export type ParseReport = {
  data: ResumeData;
  warnings: string[];
  /** Human-readable summary of what was recovered, shown after an import. */
  summary: string;
};

export function parseLines(rawLines: TextLine[]): ParseReport {
  const cleaned = removePageFurniture(rawLines);
  const ordered = readingOrder(cleaned);

  // Rejoin lines the layout broke: hyphenated words first, then soft wraps.
  const lines: TextLine[] = [];
  for (const line of ordered) {
    const previous = lines[lines.length - 1];

    if (previous) {
      const [merged] = dehyphenate([previous.text, line.text]);
      if (merged !== previous.text) {
        lines[lines.length - 1] = { ...previous, text: merged };
        continue;
      }
      if (isContinuation(previous, line)) {
        lines[lines.length - 1] = { ...previous, text: `${previous.text} ${line.text}` };
        continue;
      }
    }
    lines.push({ ...line });
  }

  const data = emptyResume();
  if (!lines.length) {
    return { data, warnings: ["No text could be read from that file."], summary: "" };
  }

  const size = bodySize(lines);
  const headingAt = new Map<number, ReturnType<typeof detectHeading>>();
  for (let index = 0; index < lines.length; index += 1) {
    const match = detectHeading(lines[index], { bodySize: size, nextLine: lines[index + 1] });
    if (match) headingAt.set(index, match);
  }

  /*
   * The header is per column, not per document. In a two-column resume the
   * sidebar is read first, so a single document-wide cut-off would end the
   * header inside the sidebar and never reach the name in the main column.
   */
  const firstPage = lines[0].page;
  const headerIndices = new Set<number>();
  const columns = [...new Set(lines.filter((line) => line.page === firstPage).map((line) => line.column))];
  for (const column of columns) {
    const indices = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.page === firstPage && line.column === column)
      .map(({ index }) => index);
    let stop = indices.findIndex((index) => knownHeading(lines[index].text) !== null);
    if (stop < 0) stop = Math.min(indices.length, 5);
    for (const index of indices.slice(0, stop)) headerIndices.add(index);
  }

  const header = [...headerIndices].sort((left, right) => left - right).map((index) => lines[index]);
  // The name is the largest plausible text anywhere on page one, because it may
  // sit in whichever column the layout put first.
  const nameLine = findName(lines.filter((line) => line.page === firstPage));
  if (nameLine) data.name = nameLine.text;
  parseHeader(header.length ? header : lines.slice(0, 5), data, nameLine);

  // Walk the remainder, opening a section at each heading.
  let current: { kind: SectionKind; title: string; lines: TextLine[] } | null = null;
  const flush = () => {
    if (!current) return;
    const entries =
      current.kind === "skills"
        ? buildSkills(current.lines)
        : current.kind === "summary"
          ? buildSummary(current.lines)
          : blocksFrom(current.lines).map((block) => readBlock(block, current!.kind));
    const populated = entries.filter(
      (entry) => entry.heading || entry.details || entry.bullets.length,
    );
    if (populated.length) {
      data.sections.push({
        id: makeId(),
        kind: current.kind,
        title: current.title,
        entries: populated,
      } satisfies ResumeSection);
    }
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (headerIndices.has(index)) continue;
    const heading = headingAt.get(index);
    if (heading) {
      flush();
      // A "Contact" sidebar heading is metadata, not a resume section.
      current =
        heading.title === "Contact"
          ? null
          : { kind: heading.kind, title: heading.title, lines: [] };
      continue;
    }
    if (!current) {
      // Text before any heading, or inside a Contact block, may still hold
      // details the header block missed.
      harvestStray(lines[index], data);
      continue;
    }
    current.lines.push(lines[index]);
  }
  flush();

  return { data, ...describe(data) };
}

/** Recovers contact details that live outside the header, as in a sidebar. */
function harvestStray(line: TextLine, data: ResumeData) {
  const text = line.text;
  if (!data.email) {
    const email = text.match(EMAIL);
    if (email) data.email = email[0];
  }
  if (!data.phone) {
    const phone = text.match(PHONE);
    if (phone) data.phone = phone[0].trim();
  }
  if (!data.portfolio) {
    const link = text.replace(new RegExp(EMAIL.source, "g"), " ").match(LINK);
    if (link) data.portfolio = link[0];
  }
  if (!data.location && wordCount(text) <= 5) {
    const location = text.match(LOCATION);
    if (location && location[0].length >= text.length * 0.6) data.location = location[0].trim();
  }
  if (!data.headline && wordCount(text) >= 2 && wordCount(text) <= 10 && capsRatio(text) < 0.9) {
    if (!EMAIL.test(text) && !PHONE.test(text) && !LINK.test(text) && !/\d/.test(text)) {
      data.headline = text;
    }
  }
}

function describe(data: ResumeData): { warnings: string[]; summary: string } {
  const warnings: string[] = [];
  if (!data.name) warnings.push("No name was identified.");
  if (!data.email && !data.phone) warnings.push("No email or phone was found.");
  if (!data.sections.length) warnings.push("No standard section headings were recognised.");

  const entries = data.sections.reduce((total, section) => total + section.entries.length, 0);
  const bullets = data.sections.reduce(
    (total, section) =>
      total + section.entries.reduce((count, entry) => count + entry.bullets.length, 0),
    0,
  );
  const summary = data.sections.length
    ? `Found ${data.sections.length} section${data.sections.length === 1 ? "" : "s"}, ` +
      `${entries} item${entries === 1 ? "" : "s"}, and ${bullets} bullet${bullets === 1 ? "" : "s"}.`
    : "";

  return { warnings, summary };
}
