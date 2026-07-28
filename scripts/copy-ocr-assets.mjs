#!/usr/bin/env node
/**
 * Vendors the OCR runtime into public/ocr.
 *
 * tesseract.js otherwise fetches its worker, WASM core, and language data from
 * a CDN at run time. That would tell a third party that someone is importing a
 * document, which contradicts the whole point of doing this in the browser, and
 * it would stop OCR working offline. Copying the files here keeps every request
 * same-origin.
 *
 * All three core variants ship because tesseract.js feature-detects SIMD
 * support and asks for a specific filename; only one is ever downloaded.
 */
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const DESTINATION = "public/ocr";

const CORE_VARIANTS = [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
];

/**
 * The integer-quantised "best" model: markedly more accurate than the fast
 * model at 2.8 MB rather than 10.4 MB for the standard one.
 */
const LANGUAGE_DATA = "4.0.0_best_int/eng.traineddata.gz";

await mkdir(DESTINATION, { recursive: true });

const workerSource = join(dirname(require.resolve("tesseract.js/package.json")), "dist", "worker.min.js");
const coreDirectory = dirname(require.resolve("tesseract.js-core/package.json"));
const dataDirectory = dirname(require.resolve("@tesseract.js-data/eng/package.json"));

const copies = [
  [workerSource, join(DESTINATION, "worker.min.js")],
  ...CORE_VARIANTS.map((name) => [join(coreDirectory, name), join(DESTINATION, name)]),
  [join(dataDirectory, LANGUAGE_DATA), join(DESTINATION, "eng.traineddata.gz")],
];

for (const [from, to] of copies) {
  await copyFile(from, to);
}

const files = await readdir(DESTINATION);
const total = (
  await Promise.all(files.map(async (name) => (await stat(join(DESTINATION, name))).size))
).reduce((sum, size) => sum + size, 0);

console.log(
  `ocr assets: ${files.length} files, ${(total / 1024 / 1024).toFixed(1)} MB on disk ` +
    `(~6.7 MB downloaded on first use)`,
);
