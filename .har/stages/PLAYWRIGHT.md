# Playwright (browser-e2e)

Adapt specs under `tests/` for your application. Full verification (`verify --full`) runs this stage when `stages/browser-e2e.sh` is present.

| Directory | Purpose |
|-----------|---------|
| `tests/frontend/` | UI smoke and flows — extend when you add UI |
| `tests/api/` | HTTP checks via Playwright `request` |
| `tests/a11y/` | axe-core on key routes |
| `tests/helpers/` | `handoffScreenshot` fixture + reporter that copies PNGs to a stable folder |

## Run

After `./.har/launch.sh <id>`:

```bash
./.har/stages/browser-e2e.sh <id>
# included in:
./.har/verify.sh <id> --full
```

Adapt selectors and paths in the scaffold specs during harness adaptation.

## Handoff screenshots (required)

Every UI change must produce a named PNG the agent shows in the **session handoff**.

1. In the spec for the changed screen, import `tests/helpers/fixtures` and call:

   ```js
   const { test, expect } = require("../helpers/fixtures");

   test("notes editor saves", async ({ page, handoffScreenshot }) => {
     // ...drive the new UI...
     await handoffScreenshot("notes-editor-after-save");
   });
   ```

2. Full verify writes those files to `.har/artifacts/browser-e2e/handoff/` in the **main checkout** (plus a `manifest.json`). Playwright also screenshots every UI test (`screenshot: on`); the handoff reporter copies the last one under the test title.

3. In the session handoff, **Read each relevant PNG** so the image appears in chat. Do not replace the screenshot with a prose description. List the paths next to the preview URL.

Demo login for authenticated flows: `agent-demo@example.com` / `agent-demo-password-123`. Seed notes with `./.har/agent-cli.sh <id> factory-line --profile user-with-notes`.

## New UI features

Add or update Playwright specs so `browser-e2e` covers the change. Prefer one file per feature under `tests/frontend/<feature>.spec.js`. Full verification (`verify --full`) must pass before done.

See the header comment in `playwright.config.js` for harness env vars, artifact paths, and the quick vs full verify contract.

## Plugin updates

When HAR ships a new plugin template version, merge drift from:

```bash
har env maintain
# review .har/maintain/plugins/playwright/
```

Or refresh all plugin-owned files:

```bash
har env add-plugin playwright --force
```

Then re-apply the handoff helper, reporter, and app-specific smoke specs from this repo.
