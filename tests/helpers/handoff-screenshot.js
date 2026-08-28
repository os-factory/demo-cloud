const fs = require("fs");
const path = require("path");

function handoffDir() {
  return (
    process.env.PW_HANDOFF_DIR ||
    path.join(process.cwd(), ".har/artifacts/browser-e2e/handoff")
  );
}

function slug(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Capture a named full-page PNG for the session handoff.
 * Agents must call this on every changed UI surface, then Read the file
 * so the image appears in the handoff message.
 */
async function captureHandoffScreenshot(page, name) {
  const dir = handoffDir();
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${slug(name)}.png`);
  await page.screenshot({ path: dest, fullPage: true });
  return dest;
}

function writeHandoffManifest(entries) {
  const dir = handoffDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify({ screenshots: entries }, null, 2) + "\n",
  );
}

module.exports = {
  captureHandoffScreenshot,
  handoffDir,
  slug,
  writeHandoffManifest,
};
