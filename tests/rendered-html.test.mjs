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
  assert.match(example, /date: "2026\/02-05"/);
  assert.match(example, /A website turn a syllabus into a full teachable course\./);
  assert.match(example, /heading: "Bebop Puzzle"/);
  assert.match(example, /A jazz ear training puzzle game\./);
  assert.match(example, /IPA International Photography Award 3rd place/);
  assert.doesNotMatch(example, /ECT Creative Excellence Award Recipient/);
  assert.doesNotMatch(example, /Dify/);
  assert.match(model, /export type ResumeData/);
  assert.match(model, /export type ResumeLayout/);
  assert.equal((themes.match(/id: "(classic|modern|executive|technical|academic)"/g) ?? []).length, 5);
  assert.match(page, /Research-backed layouts/);
  assert.match(packageJson, /"name": "quicky-resume"/);
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
