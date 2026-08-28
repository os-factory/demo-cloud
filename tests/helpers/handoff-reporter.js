const fs = require("fs");
const path = require("path");
const {
  handoffDir,
  slug,
  writeHandoffManifest,
} = require("./handoff-screenshot");

function projectName(test) {
  let suite = test.parent;
  while (suite) {
    const project =
      typeof suite.project === "function" ? suite.project() : suite.project;
    if (project?.name) return project.name;
    suite = suite.parent;
  }
  return "";
}

/**
 * Copies Playwright's per-test screenshots into a stable handoff folder
 * so agents can embed them in the session handoff without digging through
 * hashed test-results paths.
 */
class HandoffReporter {
  constructor() {
    this.entries = [];
  }

  onTestEnd(test, result) {
    if (projectName(test) === "api") return;

    const shots = result.attachments.filter(
      (attachment) =>
        attachment.contentType === "image/png" &&
        (attachment.path || attachment.body),
    );
    if (!shots.length) return;

    const dir = handoffDir();
    fs.mkdirSync(dir, { recursive: true });
    const last = shots[shots.length - 1];
    const name = slug(test.title);
    const dest = path.join(dir, `${name}.png`);
    if (last.path && fs.existsSync(last.path)) {
      fs.copyFileSync(last.path, dest);
    } else if (last.body) {
      fs.writeFileSync(dest, last.body);
    } else {
      return;
    }
    this.entries.push({
      name,
      title: test.title,
      path: dest,
      status: result.status,
    });
  }

  onEnd() {
    if (this.entries.length) writeHandoffManifest(this.entries);
  }
}

module.exports = HandoffReporter;
