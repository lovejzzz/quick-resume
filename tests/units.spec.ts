import { expect, test } from "@playwright/test";
import { analyseJobMatch } from "../app/lib/ats";
import { summariseReview } from "../app/lib/coach";
import { judgeAccent } from "../app/lib/contrast";
import { parseResumeLines } from "../app/lib/import-resume";
import { getPageGeometry } from "../app/lib/page-size";
import type { ResumeData } from "../app/lib/resume-model";
import { coerceResumeStyle, migrateWorkspace, parseBackup } from "../app/lib/storage";

/** Pure-function coverage for the logic behind the new panels. */

const resume = (overrides: Partial<ResumeData> = {}): ResumeData => ({
  name: "Test Person",
  headline: "Engineer",
  email: "a@b.co",
  phone: "",
  location: "",
  portfolio: "",
  secondaryLink: "",
  photo: "",
  sections: [],
  ...overrides,
});

test.describe("storage migration", () => {
  test("turns a v1 payload into a single document", () => {
    const workspace = migrateWorkspace({
      data: { name: "Legacy", sections: [] },
      style: { accent: "#123456" },
    });
    expect(workspace.documents).toHaveLength(1);
    expect(workspace.documents[0].data.name).toBe("Legacy");
    expect(workspace.documents[0].style.accent).toBe("#123456");
  });

  test("repairs malformed documents rather than throwing", () => {
    const workspace = migrateWorkspace({
      version: 2,
      activeId: "missing",
      documents: [{ data: { sections: "not-an-array", name: 42 } }],
    });
    expect(workspace.documents[0].data.sections).toEqual([]);
    expect(workspace.documents[0].data.name).toBe("");
    // activeId pointed at nothing, so it falls back to the first document.
    expect(workspace.activeId).toBe(workspace.documents[0].id);
  });

  test("falls back to the starter for junk input", () => {
    for (const junk of [null, "string", 12, [], {}]) {
      const workspace = migrateWorkspace(junk);
      expect(workspace.documents.length).toBeGreaterThan(0);
    }
  });

  test("rejects a non-hex accent so it cannot reach a CSS variable", () => {
    expect(coerceResumeStyle({ accent: "red; background: url(x)" }).accent).toBe("#28605d");
    expect(coerceResumeStyle({ accent: "#ABC" }).accent).toBe("#ABC");
  });

  test("clamps out-of-range numbers", () => {
    const style = coerceResumeStyle({ fitLevel: 5000, fontAdjustments: { a: 900, b: "x" } });
    expect(style.fitLevel).toBe(100);
    expect(style.fontAdjustments.a).toBe(8);
    expect(style.fontAdjustments.b).toBeUndefined();
  });

  test("parses a backup and re-keys the documents", () => {
    const first = parseBackup(
      JSON.stringify({ kind: "quicky-resume-backup", documents: [{ data: { name: "X", sections: [] } }] }),
    );
    const second = parseBackup(
      JSON.stringify({ kind: "quicky-resume-backup", documents: [{ data: { name: "X", sections: [] } }] }),
    );
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.documents[0].id).not.toBe(second.documents[0].id);
  });

  test("reports a helpful reason for bad JSON", () => {
    const result = parseBackup("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/valid JSON/i);
  });
});

test.describe("page geometry", () => {
  test("A4 is narrower and taller than Letter", () => {
    const letter = getPageGeometry("letter");
    const a4 = getPageGeometry("a4");
    expect(a4.widthPx).toBeLessThan(letter.widthPx);
    expect(a4.heightPx).toBeGreaterThan(letter.heightPx);
    expect(a4.printSafeHeightPx).toBeLessThan(a4.heightPx);
  });

  test("an unknown size falls back to Letter", () => {
    expect(getPageGeometry("tabloid" as "letter").id).toBe("letter");
  });
});

test.describe("keyword matching", () => {
  const data = resume({
    sections: [
      {
        id: "s1",
        kind: "experience",
        title: "Experience",
        entries: [
          {
            id: "e1",
            heading: "Engineer",
            subheading: "Acme",
            date: "2020",
            details: "",
            bullets: ["Built Kubernetes clusters for 40 services"],
          },
        ],
      },
    ],
  });

  test("separates present from absent terms", () => {
    const report = analyseJobMatch(
      "Kubernetes engineer wanted. Kubernetes required. Terraform required. Terraform expertise essential.",
      data,
    );
    const missing = report.missing.map((hit) => hit.term);
    const matched = report.matched.map((hit) => hit.term);
    expect(matched.some((term) => term.includes("kubernetes"))).toBe(true);
    expect(missing.some((term) => term.includes("terraform"))).toBe(true);
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test("matches across singular and plural forms", () => {
    const report = analyseJobMatch("We need cluster experience. Clusters clusters clusters.", data);
    expect(report.matched.some((hit) => hit.term.startsWith("cluster"))).toBe(true);
  });

  test("returns an empty report for stop-word-only text", () => {
    expect(analyseJobMatch("the and of to a an", data).totalTerms).toBe(0);
  });
});

test.describe("bullet coaching", () => {
  const withBullet = (bullet: string) =>
    summariseReview(
      resume({
        sections: [
          {
            id: "s",
            kind: "experience",
            title: "Experience",
            entries: [
              { id: "e", heading: "Role", subheading: "", date: "", details: "", bullets: [bullet] },
            ],
          },
        ],
      }),
    );

  test("flags a weak opener", () => {
    const rules = withBullet("Responsible for managing the team roadmap").findings.map((f) => f.rule);
    expect(rules).toContain("weak-opener");
  });

  test("flags first-person phrasing", () => {
    expect(withBullet("I led the migration of 12 services").findings.map((f) => f.rule)).toContain(
      "first-person",
    );
  });

  test("does not ask for a metric when one is present", () => {
    const rules = withBullet("Shipped 14 releases, cutting latency 38%").findings.map((f) => f.rule);
    expect(rules).not.toContain("no-metric");
  });

  test("asks for a metric when none is present", () => {
    expect(withBullet("Shipped releases and improved latency").findings.map((f) => f.rule)).toContain(
      "no-metric",
    );
  });

  test("counts bullets carrying numbers", () => {
    const summary = withBullet("Reduced build time by 45%");
    expect(summary.bulletsChecked).toBe(1);
    expect(summary.bulletsWithMetrics).toBe(1);
  });
});

test.describe("accent contrast", () => {
  test("passes for a dark accent and fails for a pale one", () => {
    expect(judgeAccent("#28605d")?.level).toBe("pass");
    expect(judgeAccent("#ffff66")?.level).toBe("fail");
  });

  test("returns null for a value that is not a colour", () => {
    expect(judgeAccent("not-a-colour")).toBeNull();
  });
});

test.describe("resume import", () => {
  test("pulls contact details and sections out of plain lines", () => {
    const data = parseResumeLines([
      "Jane Doe",
      "Senior Product Designer",
      "jane@example.com | 555-123-4567",
      "Portland, OR",
      "Experience",
      "Lead Designer — Acme Corp 2021-2024",
      "• Redesigned onboarding, lifting activation 22%",
      "• Ran a design system used by 8 teams",
      "Education",
      "Reed College 2017-2021",
      "Skills",
      "Tools: Figma, Sketch",
    ]);

    expect(data.name).toBe("Jane Doe");
    expect(data.email).toBe("jane@example.com");
    expect(data.headline).toBe("Senior Product Designer");

    const experience = data.sections.find((section) => section.kind === "experience");
    expect(experience?.entries[0].heading).toContain("Lead Designer");
    expect(experience?.entries[0].bullets).toHaveLength(2);

    const skills = data.sections.find((section) => section.kind === "skills");
    expect(skills?.entries[0].heading).toBe("Tools");
    expect(skills?.entries[0].details).toBe("Figma, Sketch");

    expect(data.sections.some((section) => section.kind === "education")).toBe(true);
  });

  test("produces an empty but valid resume from unrecognisable input", () => {
    const data = parseResumeLines(["asdf", "qwer"]);
    expect(Array.isArray(data.sections)).toBe(true);
  });

  test("keeps a school name intact when a year follows it", () => {
    // A greedy month-prefix pattern used to eat "niversity" out of the heading.
    const data = parseResumeLines(["Education", "Carnegie Mellon University 2014-2018"]);
    const education = data.sections.find((section) => section.kind === "education");
    expect(education?.entries[0].heading).toBe("Carnegie Mellon University");
    expect(education?.entries[0].date).toBe("2014-2018");
  });

  test("treats unprefixed lines as bullets when the marker glyph is missing", () => {
    // Chromium-generated PDFs drop list markers during text extraction.
    const data = parseResumeLines([
      "Experience",
      "Staff Engineer — Northwind Systems 2021-2024",
      "Cut p99 latency 43% by rewriting the ingest pipeline.",
      "Led migration of 60 services onto Kubernetes.",
    ]);
    const entry = data.sections[0].entries[0];
    expect(entry.heading).toBe("Staff Engineer");
    expect(entry.subheading).toBe("Northwind Systems");
    expect(entry.bullets).toHaveLength(2);
  });

  test("keeps the bracket on a US phone number", () => {
    const data = parseResumeLines(["Jordan Rivera", "(415) 555-0142", "Experience", "Role 2020"]);
    expect(data.phone).toBe("(415) 555-0142");
  });

  test("does not read a month name out of the middle of a word", () => {
    // "Summary" contains "mar"; it must not register as carrying a date.
    const data = parseResumeLines([
      "Experience",
      "Analyst — Acme 2020-2022",
      "Summarised findings for leadership.",
    ]);
    expect(data.sections[0].entries).toHaveLength(1);
  });

  test("attaches a date that sits on the line below the title", () => {
    const data = parseResumeLines(["Experience", "Staff Engineer", "Northwind Systems 2021-2024"]);
    const entry = data.sections[0].entries[0];
    expect(entry.heading).toBe("Staff Engineer");
    expect(entry.date).toBe("2021-2024");
  });
});
