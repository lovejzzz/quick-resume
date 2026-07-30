import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

/**
 * Guards the accessibility work against regressions. Both viewports are checked
 * because the layout collapses to a single column on narrow screens, which
 * changes which backgrounds text sits on.
 */
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);

type AxeResult = { violations: { id: string; impact: string; nodes: { target: string[] }[] }[] };

declare global {
  interface Window {
    axe: { run: (context: unknown, options: unknown) => Promise<AxeResult> };
  }
}

const TABS = ["Content", "Style", "Review", "Export"] as const;
const VIEWPORTS = [
  { width: 1440, height: 900, label: "desktop" },
  { width: 390, height: 844, label: "mobile" },
] as const;

for (const viewport of VIEWPORTS) {
  test(`has no WCAG 2.1 A/AA violations on ${viewport.label}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    if (viewport.label === "mobile") {
      await expect(page.locator(".editor-panel")).toBeVisible();
      await expect(page.locator(".resume-paper h2")).toBeHidden();
    } else {
      await expect(page.locator(".resume-paper h2")).toBeVisible();
    }

    const found: string[] = [];
    for (const tab of TABS) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.locator(".editor-scroll")).toBeVisible();
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(
        async () =>
          await window.axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          }),
      );
      for (const violation of result.violations) {
        found.push(`${tab}: [${violation.impact}] ${violation.id} → ${violation.nodes[0]?.target.join(" ")}`);
      }
    }
    expect(found, `axe violations:\n${found.join("\n")}`).toEqual([]);
  });
}
