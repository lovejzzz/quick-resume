#!/usr/bin/env node
/**
 * Injects a precache manifest into the exported service worker.
 *
 * A service worker does not intercept the navigation that registers it, so
 * without a precache step the shell is only cached from the *second* visit
 * onward — and a user who goes offline before then gets nothing. Build output
 * uses content-hashed filenames, so the list has to be generated here rather
 * than hand-written in `public/sw.js`.
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";

const OUT_DIR = "out";
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/**
 * Deliberately excluded from precache. Both are large and only needed for an
 * opt-in action, so they are cached at runtime the first time they are used
 * instead of costing every visitor a background download.
 */
const EXCLUDE = [
  /pdf\.worker/i,
  /us-colleges\.json$/i,
  // The OCR engine is opt-in and ~7 MB; it is cached at runtime on first use.
  /^ocr\//,
  /\.map$/,
  /^sw\.js$/,
  /\.nojekyll$/,
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

const all = await walk(OUT_DIR);
const html = await readFile(join(OUT_DIR, "index.html"), "utf8");

// Only the chunks the shell actually references are worth precaching; Next
// emits others for routes this app does not have.
const referenced = new Set(
  [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|woff2))"/g)].map((match) => match[1]),
);

const manifest = all
  .map((file) => posix.join(...relative(OUT_DIR, file).split(sep)))
  .filter((path) => !EXCLUDE.some((pattern) => pattern.test(path)))
  .filter((path) => {
    if (path === "index.html") return true;
    if (/^(favicon\.png|manifest\.webmanifest|og-editorial\.jpg)$/.test(path)) return true;
    return referenced.has(`${BASE_PATH}/${path}`);
  })
  .map((path) => (path === "index.html" ? `${BASE_PATH}/` : `${BASE_PATH}/${path}`));

const swPath = join(OUT_DIR, "sw.js");
const source = await readFile(swPath, "utf8");
if (!source.includes("__PRECACHE_MANIFEST__")) {
  throw new Error("sw.js is missing the __PRECACHE_MANIFEST__ placeholder.");
}

const bytes = (
  await Promise.all(
    manifest.map(async (path) => {
      const local = path === `${BASE_PATH}/` ? "index.html" : path.slice(BASE_PATH.length + 1);
      return (await stat(join(OUT_DIR, local))).size;
    }),
  )
).reduce((total, size) => total + size, 0);

await writeFile(
  swPath,
  source
    .replace("__PRECACHE_MANIFEST__", JSON.stringify(manifest))
    .replace("__SHELL_URL__", JSON.stringify(`${BASE_PATH}/`)),
);

console.log(`sw.js: precaching ${manifest.length} files (${(bytes / 1024).toFixed(0)} KB)`);
