import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expectations } from "./fixtures/expectations";
// @ts-expect-error -- plain JS helper, no type declarations needed
import { writeDocxFixture } from "./fixtures/make-docx.mjs";
// @ts-expect-error -- plain JS helper, no type declarations needed
import { writeGarbledPdf, writeNearEmptyPdf } from "./fixtures/make-pdfs.mjs";

/**
 * End-to-end import coverage over a corpus of realistic resume layouts.
 *
 * Each HTML fixture is rendered to a real PDF and imported through the actual
 * UI, so extraction, layout analysis, and parsing are all exercised the way a
 * user exercises them. The fixtures encode the failure modes that matter:
 * letter-spaced headings, sidebars, running headers, wrapped bullets, and
 * right-aligned dates.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP = join(HERE, "..", "test-results", "fixtures");

const SECTION_WORDS: Record<string, string[]> = {
  summary: ["summary", "profile", "objective"],
  experience: ["experience"],
  education: ["education"],
  skills: ["skill", "technical"],
  awards: ["award", "honor"],
  projects: ["project"],
};

async function importInto(page: Page, path: string) {
  await page.goto("/");
  await expect(page.locator(".resume-paper h2")).toBeVisible();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.locator(".import-action input[type=file]").setInputFiles(path);
  await expect(page.locator(".import-message")).toBeVisible({ timeout: 30_000 });

  return page.evaluate(() => {
    const text = (selector: string) =>
      [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim() ?? "");
    return {
      name: document.querySelector(".resume-paper h2")?.textContent?.trim() ?? "",
      headline: document.querySelector(".resume-headline")?.textContent?.trim() ?? "",
      contact: text(".contact-line > *").join(" | "),
      sectionTitles: text(".resume-section h3").join(" ").toLowerCase(),
      entryHeadings: text(".resume-entry h4"),
      bodyText: [...text(".resume-section li"), ...text(".entry-details")],
      all: (document.querySelector(".resume-paper")?.textContent ?? "").toLowerCase(),
    };
  });
}

test.beforeAll(async () => {
  await mkdir(TMP, { recursive: true });
});

for (const expected of expectations) {
  test(`imports ${expected.label} — ${expected.challenge}`, async ({ page, browser }) => {
    let path = join(HERE, "fixtures", "resumes", expected.file);

    if (expected.file.endsWith(".html")) {
      // Render the fixture to a genuine PDF so text extraction runs for real.
      const maker = await browser.newPage();
      await maker.setContent(await readFile(path, "utf8"));
      path = join(TMP, expected.file.replace(/\.html$/, ".pdf"));
      await maker.pdf({ path, format: "Letter" });
      await maker.close();
    }

    const got = await importInto(page, path);

    expect(got.name, "name").toBe(expected.name);
    if (expected.headline) expect(got.headline, "headline").toContain(expected.headline);
    expect(got.contact, "email").toContain(expected.email);
    if (expected.phone) {
      expect(got.contact.replace(/\s+/g, " "), "phone").toContain(expected.phone);
    }
    if (expected.location) expect(got.contact, "location").toContain(expected.location);
    if (expected.link) expect(got.contact, "link").toContain(expected.link);

    for (const kind of expected.sections) {
      const words = SECTION_WORDS[kind] ?? [kind];
      expect(
        words.some((word) => got.sectionTitles.includes(word)),
        `section ${kind} (got: ${got.sectionTitles})`,
      ).toBe(true);
    }

    for (const heading of expected.entryHeadings) {
      expect(
        got.entryHeadings.some((value) => value.toLowerCase().includes(heading.toLowerCase())),
        `entry "${heading}" (got: ${got.entryHeadings.join(" / ")})`,
      ).toBe(true);
    }

    for (const bullet of expected.bullets) {
      expect(
        got.bodyText.some((value) => value.toLowerCase().includes(bullet.toLowerCase())),
        `bullet "${bullet}"`,
      ).toBe(true);
    }

    for (const absent of expected.absent ?? []) {
      expect(got.all, `page furniture "${absent}" must not survive`).not.toContain(
        absent.toLowerCase(),
      );
    }
  });
}

test("reads a Word .docx, using its list and bold metadata", async ({ page }) => {
  // Generated rather than committed, so the fixture stays reviewable as text.
  const path: string = await writeDocxFixture(join(TMP, "sample.docx"));
  const got = await importInto(page, path);

  expect(got.name).toBe("Rosa Delgado");
  expect(got.headline).toContain("Operations Manager");
  expect(got.contact).toContain("rosa.delgado@example.com");
  expect(got.contact).toContain("Portland, OR");
  expect(got.sectionTitles).toContain("experience");
  expect(got.sectionTitles).toContain("education");
  expect(got.entryHeadings).toContain("Operations Manager");
  expect(got.entryHeadings).toContain("Logistics Coordinator");
  // Word marks list items with numbering metadata rather than a glyph.
  expect(got.bodyText.some((line) => line.includes("34%"))).toBe(true);
  expect(got.bodyText.some((line) => line.includes("22 across two shifts"))).toBe(true);
  // Line breaks inside a paragraph become spaces, never control characters.
  expect(got.all).not.toMatch(/[\u0000-\u0008\u000e-\u001f]/);
});

test.describe("failure diagnosis", () => {
  async function importAndReadError(page: Page, path: string) {
    await page.goto("/");
    await expect(page.locator(".resume-paper h2")).toBeVisible();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.locator(".import-action input[type=file]").setInputFiles(path);
    const message = page.locator(".import-message.error");
    await expect(message).toBeVisible({ timeout: 30_000 });
    return (await message.textContent()) ?? "";
  }

  test("calls a scan a scan, not a broken file", async ({ page, browser }) => {
    // Rasterise a real resume, then embed the bitmap so the PDF has ink but no
    // text layer — exactly what a scanner produces.
    const shot = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await shot.setContent(await readFile(join(HERE, "fixtures", "resumes", "classic.html"), "utf8"));
    const png = await shot.screenshot({ fullPage: true });
    await shot.close();

    const embed = await browser.newPage();
    await embed.setContent(
      `<body style="margin:0"><img style="width:100%;display:block" src="data:image/png;base64,${png.toString("base64")}"></body>`,
    );
    const path = join(TMP, "scan.pdf");
    await embed.pdf({ path, format: "Letter", printBackground: true });
    await embed.close();

    const text = await importAndReadError(page, path);
    expect(text).toMatch(/no text layer/i);
    expect(text).toMatch(/scan or a photo/i);
    // It must not be described as blank — the page is full of content.
    expect(text).not.toMatch(/blank/i);
  });

  test("identifies a broken font encoding rather than blaming the user", async ({ page }) => {
    const path: string = await writeGarbledPdf(join(TMP, "garbled.pdf"));
    const text = await importAndReadError(page, path);
    expect(text).toMatch(/character map|nonsense/i);
    // The message quotes the garbage so the diagnosis is checkable.
    expect(text).toMatch(/Wypfh/);
    expect(text).not.toMatch(/scan or a photo/i);
  });

  test("calls a near-empty PDF blank", async ({ page }) => {
    const path: string = await writeNearEmptyPdf(join(TMP, "near-empty.pdf"));
    const text = await importAndReadError(page, path);
    expect(text).toMatch(/blank/i);
  });
});

test.describe("text recognition", () => {
  /** Rasterises a resume so the PDF has ink but no text layer. */
  async function makeScan(browser: Browser) {
    const shot = await browser.newPage({ viewport: { width: 816, height: 1056 } });
    await shot.setContent(await readFile(join(HERE, "fixtures", "resumes", "classic.html"), "utf8"));
    const png = await shot.screenshot({ fullPage: true });
    await shot.close();
    const embed = await browser.newPage();
    await embed.setContent(
      `<body style="margin:0"><img style="width:100%;display:block" src="data:image/png;base64,${png.toString("base64")}"></body>`,
    );
    const path = join(TMP, "scan-ocr.pdf");
    await embed.pdf({ path, format: "Letter", printBackground: true });
    await embed.close();
    return path;
  }

  test("offers recognition for a scan, and reads it", async ({ page, browser }) => {
    test.slow();
    const path = await makeScan(browser);

    await page.goto("/");
    await expect(page.locator(".resume-paper h2")).toBeVisible();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.locator(".import-action input[type=file]").setInputFiles(path);

    // The offer states the cost up front rather than downloading silently.
    const offer = page.locator(".ocr-offer");
    await expect(offer).toBeVisible({ timeout: 30_000 });
    await expect(offer).toContainText(/6\.7 MB/);
    await expect(offer).toContainText(/check the result/i);

    await page.getByRole("button", { name: /^Read /i }).click();
    await expect(page.locator(".ocr-progress")).toBeVisible({ timeout: 20_000 });

    await expect(page.locator(".import-message")).toBeVisible({ timeout: 180_000 });
    // Structure survives the round trip through pixels.
    await expect(page.locator(".resume-paper h2")).toHaveText(/Raghunathan/);
    await expect(page.locator(".resume-section h3")).not.toHaveCount(0);
    const bullets = await page.locator(".resume-section li").allTextContents();
    expect(bullets.some((line) => /nightly ETL/i.test(line))).toBe(true);
    // Recognised bullet glyphs must not survive as text.
    expect(bullets.every((line) => !/^[+«»<>~©°*]/.test(line.trim()))).toBe(true);
  });

  test("quotes the contact details it read so errors are visible", async ({ page, browser }) => {
    test.slow();
    const path = await makeScan(browser);
    await page.goto("/");
    await expect(page.locator(".resume-paper h2")).toBeVisible();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.locator(".import-action input[type=file]").setInputFiles(path);
    await page.getByRole("button", { name: /^Read /i }).click();

    const message = page.locator(".import-message");
    await expect(message).toBeVisible({ timeout: 180_000 });
    // Naming the values is what lets someone spot a confidently-wrong reading.
    await expect(message).toContainText(/check these character by character/i);
    await expect(message).toContainText(/Email read as/i);
  });

  test("recognition can be cancelled", async ({ page, browser }) => {
    test.slow();
    const path = await makeScan(browser);
    await page.goto("/");
    await expect(page.locator(".resume-paper h2")).toBeVisible();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.locator(".import-action input[type=file]").setInputFiles(path);
    await page.getByRole("button", { name: /^Read /i }).click();

    const progress = page.locator(".ocr-progress");
    await expect(progress).toBeVisible({ timeout: 20_000 });
    // Cancelling while Tesseract is actively reading must interrupt the job,
    // not merely set a flag that a one-page import never checks again.
    await expect(progress).toContainText(/Reading page 1 of 1/i, { timeout: 30_000 });
    await progress.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator(".import-message.error")).toContainText(/cancelled/i, {
      timeout: 60_000,
    });
  });
});

test("rejects an unsupported file with a useful reason", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".resume-paper h2")).toBeVisible();
  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.locator(".import-action input[type=file]").setInputFiles({
    name: "resume.rtf",
    mimeType: "application/rtf",
    buffer: Buffer.from("{\\rtf1 not supported}"),
  });

  const message = page.locator(".import-message.error");
  await expect(message).toBeVisible();
  await expect(message).toContainText(/unsupported/i);
});
