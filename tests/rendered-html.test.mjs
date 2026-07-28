import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders Quicky Resume and its example case", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Quicky Resume<\/title>/i);
  assert.match(html, /Quicky Resume/);
  assert.match(html, /Built by Tian Xing/);
  assert.match(html, /v0\.2\.5/);
  assert.match(html, /Changelog/);
  assert.match(html, /Tian Xing/);
  assert.match(html, /Educational Technologist/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps the example data and five layouts separate from the editor", async () => {
  const [page, example, model, themes, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/examples/tian-xing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/resume-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/resume-themes.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import \{ tianXingExample \}/);
  assert.match(page, /const initialData: ResumeData = tianXingExample/);
  assert.match(example, /export const tianXingExample: ResumeData/);
  assert.match(example, /name: "Tian Xing"/);
  assert.match(example, /date: "2026\/02-2026\/05"/);
  assert.match(example, /A website turn a syllabus into a full teachable course\./);
  assert.match(example, /heading: "BebopPuzzle\.com"/);
  assert.match(example, /A jazz ear training puzzle game\./);
  assert.match(example, /IPA International Photography Award 3rd place/);
  assert.doesNotMatch(example, /ECT Creative Excellence Award Recipient/);
  assert.doesNotMatch(example, /Dify/);
  assert.match(model, /export type ResumeData/);
  assert.match(model, /export type ResumeLayout/);
  assert.equal((themes.match(/id: "(classic|modern|executive|technical|academic)"/g) ?? []).length, 5);
  assert.match(page, /Research-backed layouts/);
  assert.match(packageJson, /"name": "quicky-resume"/);
  assert.match(packageJson, /"version": "0\.2\.5"/);
});

test("uses an illustrated brand mark and keeps version history out of resume exports", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /className="brand-mark" aria-hidden="true">QR</);
  assert.match(page, /className="brand-glyph"/);
  assert.match(page, /className="creator-credit">Built by Tian Xing/);
  assert.match(page, /className="version-widget no-print"/);
  assert.match(page, /Quicky Resume changelog/);
  assert.match(styles, /\.changelog-card/);
});

test("clear all removes editable text while preserving resume structure and presentation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const clearAllText = \(\) =>/);
  assert.match(page, /title: "Clear all resume text\?"/);
  assert.match(page, /Your section names, structure, selected style, and photo will stay in place\./);
  assert.match(page, /sections: current\.sections\.map/);
  assert.match(page, /entries: section\.entries\.map/);
  assert.match(page, /bullets: entry\.bullets\.map\(\(\) => ""\)/);
  assert.match(page, /className="clear-all-button"/);
});

test("loads the default example from Content and keeps the preview toolbar minimal", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const loadExample = \(\) =>/);
  assert.match(page, /setData\(initialData\)/);
  assert.match(page, /className="content-actions"/);
  assert.match(page, /className="example-button"/);
  assert.doesNotMatch(page, /Click text to edit/);
  assert.doesNotMatch(
    page,
    /<button onClick=\{\(\) => setActiveTab\("export"\)\} type="button">Export<\/button>/,
  );
});

test("uses branded confirmations and the licensed HVD Peace wordmark", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /window\.confirm/);
  assert.doesNotMatch(page, /Personal workspace/);
  assert.match(page, /className=\{`confirmation-dialog no-print/);
  assert.match(page, /confirmationDialogRef/);
  assert.match(page, /dialog\.showModal\(\)/);
  assert.match(page, /HVD Peace by/);
  assert.match(styles, /font-family: "HVD Peace"/);
  assert.match(styles, /HvdPeace-8qEJ\.ttf/);
  assert.match(styles, /\.confirmation-dialog::backdrop/);
});

test("saves only on request and warns before leaving with unsaved changes", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /const saveResume = \(\) =>/);
  assert.match(page, /window\.localStorage\.setItem\("quick-resume", snapshot\)/);
  assert.match(page, /lastSavedSnapshot\.current = snapshot/);
  assert.match(page, /className=\{`save-button/);
  assert.match(page, /Save changes/);
  assert.match(page, /window\.addEventListener\("beforeunload", warnBeforeLeaving\)/);
  assert.doesNotMatch(
    page,
    /window\.localStorage\.setItem\("quick-resume", JSON\.stringify\(\{ data, style \}\)\)/,
  );
});

test("opens Style first and keeps fit and photo controls in their intended panels", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const stylePanel = page.indexOf('{activeTab === "style"');
  const exportPanel = page.indexOf('{activeTab === "export"');
  const smartFit = page.indexOf("Smart one-page fit");

  assert.match(page, /useState<"content" \| "style" \| "export">\("style"\)/);
  assert.ok(stylePanel >= 0);
  assert.ok(exportPanel > stylePanel);
  assert.ok(smartFit > exportPanel);
  assert.ok([...page.matchAll(/Smart one-page fit/g)].every((match) => (match.index ?? -1) > exportPanel));
  assert.match(page, /className="photo-upload-action"/);
  assert.match(page, /const removePhoto = \(\) =>/);
  assert.match(page, /style\.showPhoto && data\.photo && \(\s*<img/);
  assert.doesNotMatch(page, /import Image from "next\/image"/);
});

test("adds a tab icon, U.S. college autocomplete, and reflowing photo positions", async () => {
  const [page, model, styles, layout, collegesText] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/resume-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/data/us-colleges.json", import.meta.url), "utf8"),
  ]);
  const colleges = JSON.parse(collegesText);

  assert.match(layout, /url: "\/favicon\.png"/);
  assert.match(page, /function SchoolAutocomplete/);
  assert.match(page, /fetch\("\/data\/us-colleges\.json"\)/);
  assert.match(page, /U\.S\. Department of Education · IPEDS/);
  assert.ok(colleges.length > 4_500);
  assert.ok(colleges.some((college) => college.name === "New York University"));
  assert.match(model, /photoPosition: "left" \| "top" \| "right"/);
  assert.match(page, /const dropPhoto = \(event: DragEvent<HTMLElement>\)/);
  assert.match(page, /onDragStart=\{\(event\) =>/);
  assert.match(page, /movePhoto\("left"\)/);
  assert.match(page, /movePhoto\("top"\)/);
  assert.match(page, /movePhoto\("right"\)/);
  assert.match(styles, /\.resume-header\.photo-left/);
  assert.match(styles, /\.resume-header\.photo-top/);
  assert.match(styles, /\.resume-header\.photo-right/);
});
