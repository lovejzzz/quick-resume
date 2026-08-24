import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { tianXingExample } from "../app/examples/tian-xing";
import { defaultStyle } from "../app/lib/storage";

/**
 * Behaviour tests against the real static export. These assert what a user can
 * observe, so they survive refactors and fail when the product actually breaks.
 */

const STORAGE_KEY = "quick-resume";
const TINY_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=";

async function openEditor(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Quicky Resume" })).toBeVisible();
  // The preview is hydrated once the starter name is editable.
  await expect(page.locator(".resume-paper h2")).toBeVisible();
}

async function seedStorage(page: Page, value: unknown) {
  await page.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key as string, payload as string);
    },
    [STORAGE_KEY, JSON.stringify(value)] as const,
  );
}

test.describe("editor shell", () => {
  test("renders the example resume and its sections", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator(".resume-paper")).toContainText("Tian Xing");
    await expect(page.locator(".resume-paper")).toContainText("Learning Technology Academic Tutor");
    await expect(page.locator(".resume-paper")).toContainText("Educational Technologist Intern");
    await expect(page.locator(".resume-paper")).toContainText("Creative Excellence Award");
    await expect(page.locator(".resume-paper")).toContainText("tian.fun");
    await expect(page.locator(".resume-paper")).toContainText(
      "AI enabled workflows, multimedia production, and music education.",
    );
    await expect(page.locator(".resume-section")).not.toHaveCount(0);
  });

  test("exposes the complete editing workflow", async ({ page }) => {
    await openEditor(page);
    for (const tab of ["Content", "Style", "Review", "Export"]) {
      await expect(page.getByRole("button", { name: tab, exact: true })).toBeVisible();
    }
  });

  test("skip link moves focus to the preview", async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to resume preview/i })).toBeFocused();
  });
});

test.describe("inline editing", () => {
  test("commits an edited name to the preview", async ({ page }) => {
    await openEditor(page);
    const name = page.locator(".resume-paper h2");
    await name.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Ada Lovelace");
    await name.blur();
    await expect(name).toHaveText("Ada Lovelace");
  });

  test("strips formatting from pasted rich text", async ({ page }) => {
    await openEditor(page);
    const name = page.locator(".resume-paper h2");
    await name.click();
    await page.keyboard.press("ControlOrMeta+a");
    // Simulate a rich paste carrying markup.
    await name.evaluate((element) => {
      const data = new DataTransfer();
      data.setData("text/plain", "Grace Hopper");
      data.setData("text/html", "<b style='color:red'>Grace</b> <i>Hopper</i><img src=x onerror='window.__xss=1'>");
      element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await name.blur();
    await expect(name).toHaveText("Grace Hopper");
    await expect(name.locator("b, i, img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});

test.describe("photo placement", () => {
  test("silently optimizes photos larger than 10 MB", async ({ page }) => {
    await openEditor(page);

    const width = 2_200;
    const height = 2_200;
    const oversizedPhoto = await sharp(randomBytes(width * height * 3), {
      raw: { channels: 3, height, width },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    expect(oversizedPhoto.byteLength).toBeGreaterThan(10 * 1024 * 1024);
    await page.locator('input[type="file"][accept*="image/png"]').setInputFiles({
      buffer: oversizedPhoto,
      mimeType: "image/png",
      name: "oversized-photo.png",
    });

    const preview = page.locator(".photo-control-heading img");
    await expect(preview).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".photo-error")).toHaveCount(0);
    const optimized = await preview.evaluate((image) => {
      const source = image.getAttribute("src") ?? "";
      const payload = source.split(",", 2)[1] ?? "";
      return {
        bytes: Math.floor((payload.length * 3) / 4),
        height: image.naturalHeight,
        width: image.naturalWidth,
      };
    });
    expect(optimized.bytes).toBeLessThan(10 * 1024 * 1024);
    expect(optimized.bytes).toBeGreaterThan(1.3 * 1024 * 1024);
    expect(optimized.width).toBe(width);
    expect(optimized.height).toBe(height);
    await page.waitForTimeout(2_000);
    await expect(page.locator(".save-button")).not.toHaveClass(/error/);
  });

  test("keeps text runaround after the photo is dropped", async ({ page }) => {
    await seedStorage(page, {
      version: 2,
      activeId: "photo-test",
      documents: [
        {
          id: "photo-test",
          title: "Photo test",
          updatedAt: 1,
          data: {
            ...tianXingExample,
            photo: TINY_PHOTO,
          },
          style: { ...defaultStyle, showPhoto: true },
        },
      ],
    });
    await openEditor(page);

    const photo = page.locator(".resume-photo");
    const identity = page.locator(".resume-identity");
    const photoBox = await photo.boundingBox();
    const identityBox = await identity.boundingBox();
    expect(photoBox).not.toBeNull();
    expect(identityBox).not.toBeNull();
    if (!photoBox || !identityBox) return;

    await page.mouse.move(photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      identityBox.x + Math.min(identityBox.width * 0.1, 40),
      identityBox.y + Math.min(identityBox.height / 2, 30),
      { steps: 8 },
    );
    await page.mouse.up();

    // The old bug re-enabled transitions before measuring the final layout,
    // replacing the drag margin with a near-zero value after 230ms.
    await page.waitForTimeout(350);
    await expect(identity).toHaveAttribute("data-photo-side", "right");
    const settledMargin = await identity.evaluate((element) =>
      Math.max(
        Number.parseFloat(getComputedStyle(element).marginLeft) || 0,
        Number.parseFloat(getComputedStyle(element).marginRight) || 0,
      ),
    );
    expect(settledMargin).toBeGreaterThan(40);
  });

  test("resizes the photo and keeps the selected size", async ({ page }) => {
    await seedStorage(page, {
      version: 2,
      activeId: "photo-size-test",
      documents: [
        {
          id: "photo-size-test",
          title: "Photo size test",
          updatedAt: 1,
          data: { ...tianXingExample, photo: TINY_PHOTO },
          style: { ...defaultStyle, showPhoto: true },
        },
      ],
    });
    await openEditor(page);

    const size = page.getByLabel("Photo size");
    await expect(size).toHaveAttribute("min", "48");
    await expect(size).toHaveAttribute("max", "180");
    await size.fill("152");
    await expect(page.locator(".resume-photo")).toHaveJSProperty("offsetWidth", 152);
    await expect(page.locator(".photo-size-field")).toContainText("152px");
    await expect(page.getByRole("button", { name: /save now/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /saved on device/i })).toBeVisible({ timeout: 5_000 });

    const savedPhotoSize = await page.evaluate((key) => {
      const workspace = JSON.parse(window.localStorage.getItem(key) ?? "{}");
      return workspace.documents?.[0]?.style?.photoSize;
    }, STORAGE_KEY);
    expect(savedPhotoSize).toBe(152);
  });
});

test.describe("export sizing", () => {
  test("previews PDF size and offers twelve image quality levels", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();

    await expect(page.getByText("Estimated PDF size")).toBeVisible();
    await expect(page.getByText(/8\.5 × 11 in/)).toBeVisible();
    await expect(page.getByLabel("Export quality level")).toHaveCount(0);

    await page.getByRole("radio", { name: /^JPG/ }).click();
    const quality = page.getByLabel("Export quality level");
    await expect(quality).toHaveAttribute("min", "1");
    await expect(quality).toHaveAttribute("max", "12");
    await quality.fill("1");
    const lowEstimate = await page.locator(".estimate-card strong").first().textContent();
    await expect(page.locator(".estimate-card")).toContainText("≈ 612 ×");

    await quality.fill("12");
    const highEstimate = await page.locator(".estimate-card strong").first().textContent();
    await expect(page.locator(".estimate-card")).toContainText("≈ 2,448 ×");
    expect(highEstimate).not.toBe(lowEstimate);
  });
});

test.describe("entry ordering", () => {
  test("reorders items within a section by dragging", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Content", exact: true }).click();

    const firstHandle = page.getByRole("button", { name: /reorder item 1 in experience/i });
    const secondItem = page.locator('[data-entry-id="experience-1"]');
    await firstHandle.scrollIntoViewIfNeeded();

    const handleBox = await firstHandle.boundingBox();
    const targetBox = await secondItem.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (!handleBox || !targetBox) return;

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * 0.8, {
      steps: 12,
    });
    await page.mouse.up();

    const experienceTitles = page.locator(".resume-section.kind-experience .resume-entry h4");
    await expect(experienceTitles.first()).toHaveText("Educational Technologist Intern");
    await expect(experienceTitles.nth(1)).toHaveText("Music Tutor");
    await expect(experienceTitles.nth(2)).toHaveText("Learning Technology Academic Tutor");
    await expect(page.getByRole("button", { name: /reorder item 1 in experience/i })).toBeVisible();
  });

  test("offers accessible move controls for section items", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: /move item 1 down in education/i }).click();

    const educationTitles = page.locator(".resume-section.kind-education .resume-entry h4");
    await expect(educationTitles.first()).toHaveText("Berklee College of Music");
    await expect(educationTitles.nth(1)).toHaveText("New York University");
  });
});

test.describe("persistence", () => {
  test("survives a reload after saving", async ({ page }) => {
    await openEditor(page);
    const name = page.locator(".resume-paper h2");
    await name.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Katherine Johnson");
    await name.blur();

    const save = page.getByRole("button", { name: /save now/i });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole("button", { name: /saved on device/i })).toBeVisible();

    await page.reload();
    await expect(page.locator(".resume-paper h2")).toHaveText("Katherine Johnson");
  });

  test("autosaves edits on this device", async ({ page }) => {
    await openEditor(page);
    const name = page.locator(".resume-paper h2");
    await name.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Dorothy Vaughan");
    await name.blur();
    await expect(page.getByRole("button", { name: /save now/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /saved on device/i })).toBeVisible({
      timeout: 5_000,
    });
    await page.reload();
    await expect(page.locator(".resume-paper h2")).toHaveText("Dorothy Vaughan");
  });

  test("does not flash the starter resume before saved content appears", async ({ page }) => {
    await seedStorage(page, {
      version: 2,
      activeId: "seeded",
      documents: [
        {
          id: "seeded",
          title: "Seeded",
          updatedAt: 1,
          data: {
            name: "Mary Jackson",
            headline: "Engineer",
            email: "",
            phone: "",
            location: "",
            portfolio: "",
            secondaryLink: "",
            photo: "",
            sections: [],
          },
          style: {},
        },
      ],
    });
    await page.goto("/");
    // The very first painted frame must already show the stored name.
    await expect(page.locator(".resume-paper h2")).toHaveText("Mary Jackson");
    await expect(page.locator(".resume-paper")).not.toContainText("Tian Xing");
  });

  test("recovers from corrupted storage instead of crashing", async ({ page }) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key as string, '{"version":2,"documents":[{"data":{"sections":"broken"}}]}');
    }, STORAGE_KEY);
    await page.goto("/");
    // A malformed payload must still produce a usable editor.
    await expect(page.getByRole("heading", { level: 1, name: "Quicky Resume" })).toBeVisible();
    await expect(page.locator(".resume-paper")).toBeVisible();
  });

  test("migrates a v1 payload that has no version marker", async ({ page }) => {
    await seedStorage(page, {
      data: {
        name: "Legacy User",
        headline: "",
        email: "",
        phone: "",
        location: "",
        portfolio: "",
        secondaryLink: "",
        photo: "",
        sections: [],
      },
      style: { accent: "#28605d", layout: "modern" },
    });
    await page.goto("/");
    await expect(page.locator(".resume-paper h2")).toHaveText("Legacy User");
  });
});

test.describe("resume workflow", () => {
  test("keeps the Tian Xing example by default and offers choices only after New", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator(".resume-paper")).toContainText("Tian Xing");
    await expect(page.getByText("Start a new resume")).toHaveCount(0);

    await page.getByRole("button", { name: /switch resume/i }).click();
    await page.getByRole("button", { name: "+ New", exact: true }).click();
    await expect(page.getByText("Start a new resume")).toBeVisible();
    await expect(page.getByRole("button", { name: /blank resume/i })).toBeVisible();
    await expect(page.getByText(/processed on this device/i)).toBeVisible();
  });

  test("compares literal job terms without presenting an AI or fit score", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByText(/does not use AI/i)).toBeVisible();
    await expect(page.getByText("Must fix", { exact: true })).toBeVisible();
    await expect(page.getByText("Worth reviewing", { exact: true })).toBeVisible();
    const jobDescription = page.getByLabel(/job description/i);
    await jobDescription.fill(
      "We need a learning experience designer with learning experience design and WebGPU prototyping. WebGPU prototyping is essential.",
    );
    await expect(page.getByText("Literal term comparison")).toBeVisible();
    await expect(page.getByText("Not a score")).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.locator(".keyword.missing").filter({ hasText: /webgpu prototyping/i })).toBeVisible();
    await page.getByRole("button", { name: "Content", exact: true }).click();
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(jobDescription).toHaveValue(/WebGPU prototyping/);
    await expect(page.getByText("Literal term comparison")).toBeVisible();
    await expect(
      page.locator(".keyword.missing").filter({ hasText: /webgpu prototyping/i }),
    ).toBeVisible();
    await page.getByText("ATS-readable text", { exact: true }).click();
    await expect(page.locator(".ats-preview pre")).toContainText("Tian Xing");
  });

  test("uses focused Edit and Preview surfaces on mobile", async ({ page }) => {
    await openEditor(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Quicky Resume" })).toBeVisible();
    await expect(page.locator(".editor-panel")).toBeVisible();
    await expect(page.locator(".preview-stage")).toBeHidden();
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.locator(".preflight-item").filter({ hasText: "2 pages" })).toBeVisible();
    await expect(page.getByText("Fits one US Letter page", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator(".preview-stage")).toBeVisible();
    await expect(page.locator(".editor-panel")).toBeHidden();
  });
});

test.describe("undo and redo", () => {
  test("restores prior text and reapplies it", async ({ page }) => {
    await openEditor(page);
    const name = page.locator(".resume-paper h2");
    const original = (await name.textContent())?.trim();

    await name.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Changed Name");
    await name.blur();
    await expect(name).toHaveText("Changed Name");

    await page.getByRole("button", { name: /undo last change/i }).click();
    await expect(name).toHaveText(original ?? "");

    await page.getByRole("button", { name: /redo last undone change/i }).click();
    await expect(name).toHaveText("Changed Name");
  });
});

test.describe("offline shell", () => {
  test("does not delete caches owned by another app on the origin", async ({ page }) => {
    // Seed Cache Storage from a same-origin page that does not register the
    // application's worker, so the following navigation performs a clean
    // install and activation.
    await page.goto("/manifest.webmanifest");
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await caches.open("unrelated-app-v1");
      await caches.open("quicky-resume-v1");
    });

    await openEditor(page);
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === "activated",
    );
    await expect
      .poll(async () => await page.evaluate(async () => await caches.keys()))
      .not.toContain("quicky-resume-v1");
    const cacheKeys = await page.evaluate(async () => await caches.keys());
    expect(cacheKeys).toContain("unrelated-app-v1");
  });
});

test.describe("one-page fitting", () => {
  test("auto fit reaches a single page", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("button", { name: /find the lightest one-page fit/i }).click();
    await expect(page.locator(".fit-status")).toContainText(/fits one/i, { timeout: 20_000 });
  });

  test("switching to A4 changes the reported paper size", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Style", exact: true }).click();
    await page.getByRole("button", { name: /A4/ }).click();
    await expect(page.locator(".preview-toolbar")).toContainText("A4");
    const width = await page.locator(".resume-paper").evaluate((element) => element.offsetWidth);
    expect(width).toBe(794);
  });
});

test.describe("backup", () => {
  test("downloads a JSON backup containing the resume", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download backup/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^quicky-resume-backup-\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(parsed.kind).toBe("quicky-resume-backup");
    expect(parsed.documents[0].data.name).toContain("Tian");
  });
});
