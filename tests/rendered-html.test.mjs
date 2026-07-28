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

test("server-renders Quick Resume and its example case", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Quick Resume<\/title>/i);
  assert.match(html, /Quick Resume/);
  assert.match(html, /Tian Xing/);
  assert.match(html, /Educational Technologist/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps the example data separate from the editor", async () => {
  const [page, example, model, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/examples/tian-xing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/resume-model.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import \{ tianXingExample \}/);
  assert.match(page, /const initialData: ResumeData = tianXingExample/);
  assert.match(example, /export const tianXingExample: ResumeData/);
  assert.match(example, /name: "Tian Xing"/);
  assert.match(model, /export type ResumeData/);
  assert.match(packageJson, /"name": "quick-resume"/);
});
