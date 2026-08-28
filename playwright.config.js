// Playwright config for the HAR `browser-e2e` verification stage.
//
// Harness integration
// -------------------
// - Stage id: `browser-e2e` (`.har/stages/browser-e2e.sh`, registered in `stages.json`).
// - Runs automatically on FULL verify only — not on quick verify:
//     ./.har/verify.sh <id> --full
//     har env verify <id> --full
//     har env complete <id>          # always full; required before declaring done
// - Quick verify (`verify.sh <id>`) stops at typecheck / unit tests / api-health.
//
// Prerequisites
// -------------
// 1. Launch a slot first:     ./.har/launch.sh <id>
// 2. Install browsers once:     npx playwright install chromium
//
// Environment (injected by browser-e2e.sh — never hardcode slot ports in specs)
// ------------------------------------------------------------------------------
// BASE_URL              Frontend origin for page.goto('/') and UI specs
// API_URL               API origin for tests/api (defaults to BASE_URL)
// PW_SCREENSHOT         Playwright screenshot mode (default: on)
// PW_ARTIFACT_DIR       Report + test-results root (main-repo artifacts)
// PW_HANDOFF_DIR        Named PNGs for the session handoff
// HARNESS_HEALTH_CHECK_PATH  Health route (this app: /api/health)
// CI                    Set in CI for retries, worker cap, and forbidOnly
//
// Test layout — agents must add or update specs for every UI change
// ------------------------------------------------------------------
// tests/frontend/<feature>.spec.js   UI flows (prefer one file per feature)
// tests/api/                         HTTP checks via the request fixture
// tests/a11y/                        axe-core on key routes
// tests/helpers/fixtures.js          `handoffScreenshot(name)` fixture
//
// After changing a screen, call `handoffScreenshot('<what-changed>')` and
// include the PNG from `.har/artifacts/browser-e2e/handoff/` in the session
// handoff (Read the file so the image appears in chat).
//
// Artifacts (gitignored under .har/artifacts/)
// --------------------------------------------
// browser-e2e/playwright-report/   HTML report after full verify
// browser-e2e/test-results/        traces, screenshots, videos on failure
// browser-e2e/handoff/             stable named PNGs for session handoff
//
// Local-only (without browser-e2e.sh):  npm run test:e2e
// Set BASE_URL (and API_URL if split) when the app is not on the default below.
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const baseURL = process.env.BASE_URL || "http://localhost:3000";
const apiURL = process.env.API_URL || baseURL;
const artifactDir =
  process.env.PW_ARTIFACT_DIR ||
  path.join(process.cwd(), ".har/artifacts/browser-e2e");

module.exports = defineConfig({
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: path.join(artifactDir, "playwright-report"),
      },
    ],
    [path.join(__dirname, "tests/helpers/handoff-reporter.js")],
  ],
  outputDir: path.join(artifactDir, "test-results"),
  use: {
    baseURL,
    headless: true,
    screenshot: process.env.PW_SCREENSHOT || "on",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "frontend",
      testDir: "./tests/frontend",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "api",
      testDir: "./tests/api",
      use: { baseURL: apiURL },
    },
    {
      name: "a11y",
      testDir: "./tests/a11y",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
