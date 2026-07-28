import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

export default defineConfig({
  testDir: "./tests",
  testMatch: "export-production.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  outputDir: "test-results/export-production",
  reporter: [["list"]],
  retries: 0,
  workers: 2,
  use: {
    acceptDownloads: true,
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15"] },
    },
  ],
  webServer: {
    command: `npx serve out --listen ${PORT} --no-clipboard --single`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
