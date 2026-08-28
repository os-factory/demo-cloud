const base = require("@playwright/test");
const { captureHandoffScreenshot } = require("./handoff-screenshot");

const test = base.test.extend({
  handoffScreenshot: async ({ page }, use) => {
    await use((name) => captureHandoffScreenshot(page, name));
  },
});

module.exports = { test, expect: base.expect };
