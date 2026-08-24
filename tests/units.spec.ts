import { expect, test } from "@playwright/test";
import { tianXingExample } from "../app/examples/tian-xing";
import { compareJobTerms } from "../app/lib/ats";
import { summariseReview } from "../app/lib/coach";
import { judgeAccent } from "../app/lib/contrast";
import { EXPORT_QUALITY_LEVELS, getExportQuality } from "../app/lib/export-quality";
import { getOcrPagePlan, parseResumeLines } from "../app/lib/import-resume";
import { getPageGeometry } from "../app/lib/page-size";
import { buildPreflight } from "../app/lib/preflight";
import { coerceResumeData, coerceResumeStyle, defaultStyle, migrateWorkspace, parseBackup } from "../app/lib/storage";

/** Pure-function coverage for storage, layout, import, and contrast logic. */

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
    for (const invalid of ["#12345", "#1234567", "#0000", "#00000000"]) {
      expect(coerceResumeStyle({ accent: invalid }).accent).toBe("#28605d");
    }
  });

  test("clamps out-of-range numbers", () => {
    const style = coerceResumeStyle({
      fitLevel: 5000,
      fontAdjustments: { a: 900, b: "x" },
      photoSize: 5000,
    });
    expect(style.fitLevel).toBe(100);
    expect(style.fontAdjustments.a).toBe(8);
    expect(style.fontAdjustments.b).toBeUndefined();
    expect(style.photoSize).toBe(180);
    expect(coerceResumeStyle({ photoSize: -1 }).photoSize).toBe(48);
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

  test("accepts a historical bare document array and rejects future backups", () => {
    expect(parseBackup(JSON.stringify([{ data: { name: "Array", sections: [] } }]))).toMatchObject({
      ok: true,
    });
    const future = parseBackup(
      JSON.stringify({ kind: "quicky-resume-backup", version: 999, documents: [{}] }),
    );
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.reason).toMatch(/newer version/i);
  });

  test("strips remote photo sources from untrusted backup data", () => {
    expect(coerceResumeData({ photo: "https://tracker.example/pixel", sections: [] }).photo).toBe("");
    expect(
      coerceResumeData({ photo: "data:image/png;base64,aGVsbG8=", sections: [] }).photo,
    ).toMatch(/^data:image\/png/);
  });
});

test.describe("export quality", () => {
  test("provides twelve ordered levels and clamps invalid input", () => {
    const levels = Array.from({ length: EXPORT_QUALITY_LEVELS }, (_, index) =>
      getExportQuality(index + 1),
    );
    expect(levels).toHaveLength(12);
    expect(new Set(levels.map((level) => level.scale)).size).toBe(12);
    expect(levels[0].scale).toBeLessThan(levels[11].scale);
    expect(levels[0].jpegQuality).toBeLessThan(levels[11].jpegQuality);
    expect(getExportQuality(-10).level).toBe(1);
    expect(getExportQuality(100).level).toBe(12);
  });
});

test.describe("private application checks", () => {
  test("finds prominent missing job terms", () => {
    const report = compareJobTerms(
      "WebGPU prototyping and accessibility testing. WebGPU prototyping is required.",
      tianXingExample,
    );
    expect(report.missing.some((hit) => hit.term.includes("webgpu"))).toBe(true);
    expect(report).not.toHaveProperty("score");
  });

  test("coaches weak bullets and builds export preflight", () => {
    const data = {
      ...tianXingExample,
      sections: [
        {
          id: "experience",
          kind: "experience" as const,
          title: "Experience",
          entries: [
            {
              id: "entry",
              heading: "Designer",
              subheading: "Studio",
              date: "2024",
              details: "",
              bullets: ["Responsible for projects"],
            },
          ],
        },
      ],
    };
    expect(summariseReview(data).findings.some((finding) => finding.rule === "weak-opener")).toBe(true);
    expect(
      buildPreflight(tianXingExample, defaultStyle, 2).some(
        (item) => item.id === "pages" && item.level === "warning" && item.category === "review",
      ),
    ).toBe(true);
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

test.describe("OCR limits", () => {
  test("makes long-document truncation explicit", () => {
    expect(getOcrPagePlan(4)).toEqual({
      pagesToRead: 4,
      totalPages: 4,
      truncated: false,
      warning: "",
    });
    expect(getOcrPagePlan(9)).toEqual({
      pagesToRead: 6,
      totalPages: 9,
      truncated: true,
      warning:
        "Only the first 6 of 9 pages were read. Import the remaining pages separately.",
    });
  });
});

test.describe("accent contrast", () => {
  test("passes for a dark accent and fails for a pale one", () => {
    expect(judgeAccent("#28605d")?.level).toBe("pass");
    expect(judgeAccent("#ffff66")?.level).toBe("fail");
  });

  test("returns null for a value that is not a colour", () => {
    expect(judgeAccent("not-a-colour")).toBeNull();
    expect(judgeAccent("#00000000")).toBeNull();
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
    expect(education?.entries[0].date).toBe("2014 \u2013 2018");
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

  test("normalises date ranges to a consistent en dash", () => {
    const data = parseResumeLines(["Experience", "Analyst \u2014 Acme Jan 2020-Mar 2022"]);
    expect(data.sections[0].entries[0].date).toBe("Jan 2020 \u2013 Mar 2022");
  });

  test("attaches a date that sits on the line below the title", () => {
    const data = parseResumeLines(["Experience", "Staff Engineer", "Northwind Systems 2021-2024"]);
    const entry = data.sections[0].entries[0];
    expect(entry.heading).toBe("Staff Engineer");
    expect(entry.date).toBe("2021 \u2013 2024");
  });
});
