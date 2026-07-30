import type { ResumeData } from "./resume-model";

export type Severity = "suggestion" | "warning";

export type Finding = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  entryId: string;
  entryHeading: string;
  bulletIndex: number | null;
  text: string;
  rule: string;
  message: string;
  severity: Severity;
};

const WEAK_OPENERS = [
  "responsible for",
  "duties included",
  "tasked with",
  "worked on",
  "helped with",
  "helped to",
  "assisted with",
  "assisted in",
  "participated in",
  "involved in",
  "in charge of",
  "was part of",
];
const WEAK_VERBS = new Set([
  "helped",
  "assisted",
  "worked",
  "participated",
  "handled",
  "dealt",
  "supported",
  "attended",
  "tried",
  "used",
]);
const FIRST_PERSON = /\b(i|i'm|i've|my|me|myself)\b/i;
const PASSIVE = /\b(was|were|been|being)\b\s+\w+(ed|en)\b/i;
const HAS_METRIC =
  /(\d[\d,.]*\s*(%|percent|k\b|m\b|bn\b|x\b)?)|(\$\s?\d)|(\b\d+\+)|\b(doubled|tripled|halved)\b/i;
const MAX_WORDS = 34;
const MIN_WORDS = 4;

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

function checkBullet(
  text: string,
  base: Omit<Finding, "id" | "rule" | "message" | "severity">,
): Finding[] {
  const findings: Finding[] = [];
  const trimmed = text.trim();
  if (!trimmed) return findings;
  const lower = trimmed.toLocaleLowerCase();
  const wordList = words(trimmed);
  const add = (rule: string, message: string, severity: Severity) =>
    findings.push({
      ...base,
      id: `${base.entryId}:${base.bulletIndex ?? "details"}:${rule}`,
      rule,
      message,
      severity,
    });

  const weakOpener = WEAK_OPENERS.find((opener) => lower.startsWith(opener));
  if (weakOpener) {
    add("weak-opener", `Starts with “${weakOpener}”. Lead with the action you took instead.`, "warning");
  } else if (WEAK_VERBS.has(wordList[0]?.toLocaleLowerCase().replace(/[^a-z]/g, ""))) {
    add("weak-verb", `“${wordList[0]}” is a low-impact opening verb. Try a more specific action.`, "suggestion");
  }
  if (!HAS_METRIC.test(trimmed)) {
    add("no-metric", "Consider adding scale, volume, a number, or a concrete result.", "suggestion");
  }
  if (FIRST_PERSON.test(trimmed)) {
    add("first-person", "Resume bullets conventionally drop “I” and “my”.", "warning");
  }
  if (PASSIVE.test(trimmed)) {
    add("passive-voice", "This may read as passive voice. Active phrasing is usually clearer.", "suggestion");
  }
  if (wordList.length > MAX_WORDS) {
    add("too-long", `${wordList.length} words. Bullets over about ${MAX_WORDS} are easy to skim past.`, "suggestion");
  } else if (wordList.length < MIN_WORDS) {
    add("too-short", "Very short. Consider adding the outcome or context.", "suggestion");
  }
  return findings;
}

export function reviewResume(data: ResumeData): Finding[] {
  const findings: Finding[] = [];
  for (const section of data.sections) {
    if (section.kind === "skills") continue;
    for (const entry of section.entries) {
      entry.bullets.forEach((bullet, bulletIndex) => {
        findings.push(
          ...checkBullet(bullet, {
            sectionId: section.id,
            sectionTitle: section.title,
            entryId: entry.id,
            entryHeading: entry.heading || "Untitled item",
            bulletIndex,
            text: bullet,
          }),
        );
      });
      if (section.kind === "experience" && entry.details.trim()) {
        findings.push(
          ...checkBullet(entry.details, {
            sectionId: section.id,
            sectionTitle: section.title,
            entryId: entry.id,
            entryHeading: entry.heading || "Untitled item",
            bulletIndex: null,
            text: entry.details,
          }),
        );
      }
    }
  }
  return findings;
}

export type ReviewSummary = {
  findings: Finding[];
  warnings: number;
  suggestions: number;
  bulletsChecked: number;
  bulletsWithMetrics: number;
};

export function summariseReview(data: ResumeData): ReviewSummary {
  const findings = reviewResume(data);
  let bulletsChecked = 0;
  let bulletsWithMetrics = 0;
  for (const section of data.sections) {
    if (section.kind === "skills") continue;
    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        if (!bullet.trim()) continue;
        bulletsChecked += 1;
        if (HAS_METRIC.test(bullet)) bulletsWithMetrics += 1;
      }
    }
  }
  return {
    findings,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    suggestions: findings.filter((finding) => finding.severity === "suggestion").length,
    bulletsChecked,
    bulletsWithMetrics,
  };
}
