import { readFile } from "node:fs/promises";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { tianXingExample } from "../app/examples/tian-xing";
import { getPageGeometry } from "../app/lib/page-size";
import { defaultStyle, STORAGE_KEY } from "../app/lib/storage";

const RED_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAOUlEQVRIie3WuQkAMBADQde0tatAV2FwMHC54NCzZ/X0DoG8KC6aoKUqpk0zODOZoYqAV9Cxr+n6AqInYD2AewQjAAAAAElFTkSuQmCC";

async function openEditor(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Quicky Resume" })).toBeVisible();
  await expect(page.locator(".resume-paper h2")).toBeVisible();
}

async function openExport(page: Page) {
  await page.getByRole("button", { exact: true, name: "Export" }).click();
  await expect(page.getByRole("heading", { name: "Download your resume" })).toBeVisible();
}

async function choosePageSize(page: Page, size: "A4" | "US Letter") {
  await page.getByRole("button", { exact: true, name: "Style" }).click();
  const choice = page.getByRole("button", { name: new RegExp(`^${size}`) });
  await expect(choice).toHaveCount(1);
  await choice.click();
}

async function smartFitOnePage(page: Page) {
  await openExport(page);
  const fitButton = page.getByRole("button", { name: /find the lightest one-page fit/i });
  await fitButton.click();
  // Let React commit the busy state before waiting for the completed state;
  // otherwise a fast browser can observe the transient 100% measurement.
  await page.waitForTimeout(100);
  await expect(fitButton).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator(".fit-status")).toContainText(/fits one/i, { timeout: 20_000 });
}

async function downloadImage(
  page: Page,
  testInfo: TestInfo,
  format: "JPG" | "PNG",
  artifactName: string,
) {
  await openExport(page);
  await page.getByRole("radio", { name: new RegExp(`^${format}`) }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { exact: true, name: `Download ${format}` }).click();
  const download = await downloadPromise;
  const extension = format.toLocaleLowerCase();
  const path = testInfo.outputPath(`${artifactName}.${extension}`);
  await download.saveAs(path);
  await testInfo.attach(`${artifactName}.${extension}`, {
    contentType: format === "PNG" ? "image/png" : "image/jpeg",
    path,
  });
  return path;
}

async function inspectPdf(path: string, expected: { height: number; width: number }) {
  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, disableWorker: true }).promise;
  try {
    expect(document.numPages).toBe(1);
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    expect(viewport.width).toBeCloseTo(expected.width, 0);
    expect(viewport.height).toBeCloseTo(expected.height, 0);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    expect(text).toContain("Tian Xing");
    expect(text).toContain("Educational Technologist Intern");
  } finally {
    await document.destroy();
  }
}

test("downloads correctly sized Letter PNG and A4 JPG files", async ({ page }, testInfo) => {
  await openEditor(page);

  const letterPaper = await page.locator(".resume-paper").evaluate((element) => ({
    height: (element as HTMLElement).offsetHeight,
    width: (element as HTMLElement).offsetWidth,
  }));
  const letterPng = await downloadImage(page, testInfo, "PNG", "letter-resume");
  const letterMetadata = await sharp(letterPng).metadata();
  const letter = getPageGeometry("letter");
  expect(letterMetadata.format).toBe("png");
  expect(letterMetadata.width).toBe(letterPaper.width * 2);
  expect(letterMetadata.height).toBe(letterPaper.height * 2);
  expect(letterMetadata.width).toBe(letter.widthPx * 2);
  expect(letterMetadata.height).toBeGreaterThanOrEqual(letter.heightPx * 2);

  await choosePageSize(page, "A4");
  const a4Paper = await page.locator(".resume-paper").evaluate((element) => ({
    height: (element as HTMLElement).offsetHeight,
    width: (element as HTMLElement).offsetWidth,
  }));
  const a4Jpg = await downloadImage(page, testInfo, "JPG", "a4-resume");
  const a4Metadata = await sharp(a4Jpg).metadata();
  const a4 = getPageGeometry("a4");
  expect(a4Metadata.format).toBe("jpeg");
  expect(a4Metadata.width).toBe(a4Paper.width * 2);
  expect(a4Metadata.height).toBe(a4Paper.height * 2);
  expect(a4Metadata.width).toBe(a4.widthPx * 2);
  expect(a4Metadata.height).toBeGreaterThanOrEqual(a4.heightPx * 2);
});

test("invokes print and applies Letter and A4 print geometry", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "print", {
      configurable: true,
      value: () => {
        const state = window as typeof window & { __printCalls?: number };
        state.__printCalls = (state.__printCalls ?? 0) + 1;
      },
    });
  });
  await openEditor(page);

  await openExport(page);
  await page.getByRole("button", { exact: true, name: "Open PDF export" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __printCalls?: number }).__printCalls)).toBe(1);
  await expect
    .poll(() => page.locator("style[data-page-size]").textContent())
    .toContain("size: letter");

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".app-header")).toBeHidden();
  expect(await page.locator(".resume-paper").evaluate((element) => element.offsetWidth)).toBe(816);
  await page.emulateMedia({ media: "screen" });

  await choosePageSize(page, "A4");
  await openExport(page);
  await page.getByRole("button", { exact: true, name: "Open PDF export" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __printCalls?: number }).__printCalls)).toBe(2);
  await expect
    .poll(() => page.locator("style[data-page-size]").textContent())
    .toContain("size: A4");

  await page.emulateMedia({ media: "print" });
  expect(await page.locator(".resume-paper").evaluate((element) => element.offsetWidth)).toBe(794);
});

test("exports persistent text runaround after a photo drag", async ({ page }, testInfo) => {
  await page.addInitScript(
    ([key, payload]) => window.localStorage.setItem(key, payload),
    [
      STORAGE_KEY,
      JSON.stringify({
        activeId: "export-photo",
        documents: [
          {
            data: { ...tianXingExample, photo: RED_PHOTO },
            id: "export-photo",
            style: { ...defaultStyle, showPhoto: true },
            title: "Export photo",
            updatedAt: 1,
          },
        ],
        version: 2,
      }),
    ] as const,
  );
  await openEditor(page);

  const photo = page.locator(".resume-photo");
  const identity = page.locator(".resume-identity");
  await photo.scrollIntoViewIfNeeded();
  const photoBox = await photo.boundingBox();
  const identityBox = await identity.boundingBox();
  expect(photoBox).not.toBeNull();
  expect(identityBox).not.toBeNull();
  if (!photoBox || !identityBox) return;

  await page.mouse.move(photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    identityBox.x + identityBox.width * 0.28,
    identityBox.y + Math.min(identityBox.height / 2, 30),
    { steps: 8 },
  );
  await page.mouse.up();
  await page.waitForTimeout(350);

  await expect(identity).toHaveAttribute("data-photo-side", "right");
  const marginBeforeExport = await identity.evaluate((element) =>
    Math.max(
      Number.parseFloat(getComputedStyle(element).marginLeft) || 0,
      Number.parseFloat(getComputedStyle(element).marginRight) || 0,
    ),
  );
  expect(marginBeforeExport).toBeGreaterThan(40);

  const png = await downloadImage(page, testInfo, "PNG", "dragged-photo-resume");
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let redPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset] > 140 && data[offset + 1] < 100 && data[offset + 2] < 100) redPixels += 1;
  }
  expect(redPixels).toBeGreaterThan(100);

  const marginAfterExport = await identity.evaluate((element) =>
    Math.max(
      Number.parseFloat(getComputedStyle(element).marginLeft) || 0,
      Number.parseFloat(getComputedStyle(element).marginRight) || 0,
    ),
  );
  expect(marginAfterExport).toBeGreaterThan(40);
});

test("Smart Fit generates one-page selectable Letter and A4 PDFs", async ({ browserName, page }, testInfo) => {
  test.skip(browserName !== "chromium", "Playwright PDF generation is Chromium-only.");
  await openEditor(page);

  await smartFitOnePage(page);
  await page.emulateMedia({ media: "print" });
  expect(await page.locator(".resume-paper").evaluate((element) => (element as HTMLElement).offsetHeight)).toBe(
    getPageGeometry("letter").heightPx,
  );
  expect(
    await page.locator(".studio-shell").evaluate((element) => getComputedStyle(element, "::before").display),
  ).toBe("none");
  const letterPath = testInfo.outputPath("letter-resume.pdf");
  await page.pdf({ path: letterPath, preferCSSPageSize: true, printBackground: true });
  await inspectPdf(letterPath, { height: 792, width: 612 });
  await testInfo.attach("letter-resume.pdf", { contentType: "application/pdf", path: letterPath });

  await page.emulateMedia({ media: "screen" });
  await choosePageSize(page, "A4");
  await smartFitOnePage(page);
  await page.emulateMedia({ media: "print" });
  expect(await page.locator(".resume-paper").evaluate((element) => (element as HTMLElement).offsetHeight)).toBe(
    getPageGeometry("a4").heightPx,
  );
  const a4Path = testInfo.outputPath("a4-resume.pdf");
  await page.pdf({ path: a4Path, preferCSSPageSize: true, printBackground: true });
  await inspectPdf(a4Path, { height: 841.89, width: 595.28 });
  await testInfo.attach("a4-resume.pdf", { contentType: "application/pdf", path: a4Path });
});
