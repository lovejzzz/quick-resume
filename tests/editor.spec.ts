import { expect, test, type Page } from "@playwright/test";

/**
 * Behaviour tests against the real static export. These assert what a user can
 * observe, so they survive refactors and fail when the product actually breaks.
 */

const STORAGE_KEY = "quick-resume";

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
    await expect(page.locator(".resume-section")).not.toHaveCount(0);
  });

  test("exposes all four editor tabs", async ({ page }) => {
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

test.describe("persistence", () => {
  test("survives a reload after saving", async ({ page }) => {
    await openEditor(page);
    const name = page.locator(".resume-paper h2");
    await name.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Katherine Johnson");
    await name.blur();

    const save = page.getByRole("button", { name: /save changes/i });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole("button", { name: /^saved$/i })).toBeVisible();

    await page.reload();
    await expect(page.locator(".resume-paper h2")).toHaveText("Katherine Johnson");
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

test.describe("multiple resumes", () => {
  test("creates a second resume and keeps the two separate", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: /switch resume/i }).click();
    await page.getByRole("button", { name: "New blank", exact: true }).click();

    // A blank resume has no name text.
    await expect(page.locator(".resume-paper h2")).toHaveText("");

    const name = page.locator(".resume-paper h2");
    await name.click();
    await page.keyboard.type("Second Resume");
    await name.blur();
    await expect(name).toHaveText("Second Resume");

    await page.getByRole("button", { name: /switch resume/i }).click();
    await page.getByRole("menuitem").first().click();
    await expect(page.locator(".resume-paper")).toContainText("Tian Xing");
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

test.describe("review tools", () => {
  test("flags a weak bullet and reports keyword gaps", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Review", exact: true }).click();

    // The example resume should produce some coaching output.
    await expect(page.locator(".coach-summary")).toBeVisible();

    await page
      .getByPlaceholder(/paste the full job posting/i)
      .fill(
        "We are hiring a Kubernetes platform engineer. Kubernetes experience required. " +
          "Strong Terraform and Terraform automation skills. Kubernetes and Terraform daily.",
      );
    await expect(page.locator(".match-score")).toBeVisible();
    await expect(page.locator(".keyword.missing").first()).toBeVisible();
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
