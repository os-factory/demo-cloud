#!/usr/bin/env node
/**
 * Factory-line catalog: load, validate, select, and emit SQL/invariants.
 * Usage (from a harness script; logs belong on stderr via the caller):
 *   node catalog.mjs check --har-dir <path> [--self-test]
 *   node catalog.mjs select --har-dir <path> [--line ID] [--profile ID] [--context TEXT]
 *   node catalog.mjs sql --har-dir <path> --profile ID [--line ID]
 *   node catalog.mjs verify-sql --har-dir <path> --profile ID [--line ID]
 *   node catalog.mjs verify --har-dir <path> --profile ID --actual JSON [--line ID]
 */
import fs from "node:fs";
import path from "node:path";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message, extra) {
  const err = new Error(message);
  err.extra = extra;
  throw err;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`Could not read JSON: ${file} (${error.message})`);
  }
}

function listProfileFiles(profilesDir) {
  if (!fs.existsSync(profilesDir)) {
    fail(`Profiles directory missing: ${profilesDir}`);
  }
  return fs
    .readdirSync(profilesDir)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .sort()
    .map((name) => path.join(profilesDir, name));
}

export function loadRegistry(harDir) {
  const file = path.join(harDir, "factory-lines.json");
  if (!fs.existsSync(file)) {
    fail(`Missing factory-line registry: ${file}`);
  }
  const registry = readJson(file);
  if (registry.version !== "1") {
    fail(`Unsupported factory-lines.json version: ${registry.version}`);
  }
  if (!Array.isArray(registry.lines) || registry.lines.length === 0) {
    fail("factory-lines.json must declare at least one line");
  }
  const ids = new Set();
  for (const line of registry.lines) {
    if (!line?.id || !ID_RE.test(line.id)) {
      fail(`Invalid factory line id: ${line?.id}`);
    }
    if (ids.has(line.id)) fail(`Duplicate factory line id: ${line.id}`);
    ids.add(line.id);
    if (!line.dir || !line.script) {
      fail(`Factory line ${line.id} needs dir and script`);
    }
  }
  const defaults = registry.lines.filter((line) => line.default);
  if (defaults.length > 1) {
    fail("At most one factory line may set default: true");
  }
  if (registry.defaultLine && !ids.has(registry.defaultLine)) {
    fail(`defaultLine ${registry.defaultLine} is not a registered line`);
  }
  return registry;
}

function userEmailByKey(profile) {
  const map = new Map();
  for (const user of profile.users) {
    map.set(user.key, user.email.toLowerCase());
  }
  return map;
}

function resolvedShares(profile) {
  const emails = userEmailByKey(profile);
  const shares = [];
  for (const note of profile.notes) {
    for (const target of note.shares ?? []) {
      const email = emails.get(target) ?? String(target).toLowerCase();
      if (!EMAIL_RE.test(email)) {
        fail(
          `Profile ${profile.id}: share target ${target} on ${note.slug} is not a user key or email`,
        );
      }
      shares.push({ slug: note.slug, email });
    }
  }
  shares.sort((a, b) => a.slug.localeCompare(b.slug) || a.email.localeCompare(b.email));
  return shares;
}

export function validateProfile(profile, { fileName } = {}) {
  const errors = [];
  if (!profile || typeof profile !== "object") {
    return ["profile must be a JSON object"];
  }
  if (!profile.id || !ID_RE.test(profile.id)) {
    errors.push(`invalid id: ${profile.id}`);
  }
  if (fileName && profile.id && fileName !== `${profile.id}.json`) {
    errors.push(`id ${profile.id} must match filename ${fileName}`);
  }
  if (!profile.title) errors.push("title is required");
  if (!profile.description) errors.push("description is required");
  if (profile.match) {
    if (!Array.isArray(profile.match.keywords) || profile.match.keywords.length === 0) {
      errors.push("match.keywords must be a non-empty array when match is set");
    }
    if (
      profile.match.priority != null &&
      (!Number.isInteger(profile.match.priority) || profile.match.priority < 0)
    ) {
      errors.push("match.priority must be a non-negative integer");
    }
  }
  if (!Array.isArray(profile.users) || profile.users.length === 0) {
    errors.push("users must be a non-empty array");
  } else {
    const keys = new Set();
    const emails = new Set();
    let primaryCount = 0;
    for (const user of profile.users) {
      if (!user?.key || !/^[a-z][a-z0-9-]*$/.test(user.key)) {
        errors.push(`invalid user key: ${user?.key}`);
      } else if (keys.has(user.key)) {
        errors.push(`duplicate user key: ${user.key}`);
      } else {
        keys.add(user.key);
      }
      if (!user?.email || !EMAIL_RE.test(user.email)) {
        errors.push(`invalid user email: ${user?.email}`);
      } else if (emails.has(user.email.toLowerCase())) {
        errors.push(`duplicate user email: ${user.email}`);
      } else {
        emails.add(user.email.toLowerCase());
      }
      if (!user?.password || String(user.password).length < 8) {
        errors.push(`user ${user?.key} needs a password of at least 8 characters`);
      }
      if (user?.primary) primaryCount += 1;
    }
    if (primaryCount > 1) errors.push("at most one user may set primary: true");
  }
  if (!Array.isArray(profile.notes)) {
    errors.push("notes must be an array (use [] for an empty inbox)");
  } else {
    const slugs = new Set();
    for (const note of profile.notes) {
      if (!note?.title) errors.push("each note needs a title");
      if (!note?.slug || !SLUG_RE.test(note.slug)) {
        errors.push(`invalid note slug: ${note?.slug}`);
      } else if (slugs.has(note.slug)) {
        errors.push(`duplicate note slug: ${note.slug}`);
      } else {
        slugs.add(note.slug);
      }
      if (note?.shares && !Array.isArray(note.shares)) {
        errors.push(`note ${note.slug} shares must be an array of user keys or emails`);
      }
    }
  }
  if (errors.length === 0) {
    try {
      resolvedShares(profile);
    } catch (error) {
      errors.push(error.message);
    }
  }
  return errors;
}

export function loadLine(harDir, lineId) {
  const registry = loadRegistry(harDir);
  const line = registry.lines.find((entry) => entry.id === lineId);
  if (!line) fail(`Unknown factory line: ${lineId}`);
  const lineDir = path.join(harDir, line.dir);
  const metaFile = path.join(lineDir, "line.json");
  const meta = fs.existsSync(metaFile) ? readJson(metaFile) : {};
  const profilesDir = path.join(lineDir, meta.profilesDir || "profiles");
  const profiles = listProfileFiles(profilesDir).map((file) => {
    const profile = readJson(file);
    const errors = validateProfile(profile, { fileName: path.basename(file) });
    if (errors.length) {
      fail(`Invalid profile ${path.basename(file)}`, errors);
    }
    return profile;
  });
  if (profiles.length === 0) {
    fail(`Factory line ${lineId} has no seeding profiles in ${profilesDir}`);
  }
  const defaults = profiles.filter((profile) => profile.default);
  if (defaults.length > 1) {
    fail(`Factory line ${lineId} has more than one default profile`);
  }
  const defaultProfile =
    meta.defaultProfile ||
    defaults[0]?.id ||
    profiles[0].id;
  if (!profiles.some((profile) => profile.id === defaultProfile)) {
    fail(`defaultProfile ${defaultProfile} is not in ${lineId}`);
  }
  return { registry, line, meta, lineDir, profilesDir, profiles, defaultProfile };
}

function normalizeContext(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreMatch(item, contextText) {
  const context = normalizeContext(contextText);
  if (!context) return 0;
  const keywords = item.match?.keywords ?? [];
  let keywordScore = 0;
  for (const keyword of keywords) {
    const needle = normalizeContext(keyword);
    if (needle && context.includes(needle)) {
      keywordScore += needle.length;
    }
  }
  if (keywordScore === 0) return 0;
  return keywordScore + (item.match?.priority ?? 0);
}

export function selectItem(items, { explicitId, context, defaultId, kind }) {
  if (explicitId) {
    const match = items.find((item) => item.id === explicitId);
    if (!match) fail(`Unknown ${kind}: ${explicitId}`);
    return { item: match, reason: "explicit" };
  }
  let best = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreMatch(item, context);
    if (
      score > bestScore ||
      (score > 0 &&
        score === bestScore &&
        (item.match?.priority ?? 0) > (best?.match?.priority ?? 0))
    ) {
      best = item;
      bestScore = score;
    }
  }
  if (best && bestScore > 0) {
    return { item: best, reason: "context", score: bestScore };
  }
  const fallback =
    items.find((item) => item.id === defaultId) ||
    items.find((item) => item.default) ||
    items[0];
  return { item: fallback, reason: "default" };
}

export function expectedState(profile) {
  const notes = [...profile.notes]
    .map((note) => ({ title: note.title, slug: note.slug }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const users = profile.users.map((user) => user.email.toLowerCase()).sort();
  return {
    notes,
    shares: resolvedShares(profile),
    users,
  };
}

export function primaryUser(profile) {
  return profile.users.find((user) => user.primary) || profile.users[0];
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function applySql(profile) {
  const lines = [
    "BEGIN;",
    "TRUNCATE TABLE note_shares, notes RESTART IDENTITY CASCADE;",
  ];
  if (profile.notes.length > 0) {
    const values = profile.notes
      .map((note) => `(${sqlString(note.title)}, ${sqlString(note.slug)})`)
      .join(",\n  ");
    lines.push(`INSERT INTO notes (title, slug) VALUES\n  ${values};`);
  }
  const shares = resolvedShares(profile);
  for (const share of shares) {
    lines.push(
      `INSERT INTO note_shares (note_id, email)
SELECT id, ${sqlString(share.email)} FROM notes WHERE slug = ${sqlString(share.slug)};`,
    );
  }
  lines.push("COMMIT;");
  return `${lines.join("\n")}\n`;
}

export function verifySql(profile) {
  const emails = profile.users.map((user) => sqlString(user.email.toLowerCase()));
  return `SELECT json_build_object(
  'notes', (
    SELECT coalesce(json_agg(json_build_object('title', title, 'slug', slug) ORDER BY slug), '[]'::json)
    FROM notes
  ),
  'shares', (
    SELECT coalesce(
      json_agg(json_build_object('slug', n.slug, 'email', lower(s.email)) ORDER BY n.slug, lower(s.email)),
      '[]'::json
    )
    FROM note_shares s
    JOIN notes n ON n.id = s.note_id
  ),
  'users', (
    SELECT coalesce(json_agg(lower(email) ORDER BY lower(email)), '[]'::json)
    FROM auth.users
    WHERE lower(email) IN (${emails.join(", ")})
  )
);`;
}

export function compareState(profile, actual) {
  const expected = expectedState(profile);
  const problems = [];
  const actualNotes = [...(actual.notes ?? [])].sort((a, b) =>
    String(a.slug).localeCompare(String(b.slug)),
  );
  if (actualNotes.length !== expected.notes.length) {
    problems.push(
      `notes count ${actualNotes.length} !== ${expected.notes.length}`,
    );
  }
  for (const note of expected.notes) {
    const found = actualNotes.find((row) => row.slug === note.slug);
    if (!found) problems.push(`missing note slug ${note.slug}`);
    else if (found.title !== note.title) {
      problems.push(`note ${note.slug} title mismatch`);
    }
  }
  for (const row of actualNotes) {
    if (!expected.notes.some((note) => note.slug === row.slug)) {
      problems.push(`unexpected note slug ${row.slug}`);
    }
  }
  const actualShares = [...(actual.shares ?? [])]
    .map((row) => ({ slug: row.slug, email: String(row.email).toLowerCase() }))
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.email.localeCompare(b.email));
  if (actualShares.length !== expected.shares.length) {
    problems.push(
      `shares count ${actualShares.length} !== ${expected.shares.length}`,
    );
  }
  for (const share of expected.shares) {
    if (
      !actualShares.some(
        (row) => row.slug === share.slug && row.email === share.email,
      )
    ) {
      problems.push(`missing share ${share.slug} → ${share.email}`);
    }
  }
  const actualUsers = [...(actual.users ?? [])].map((email) =>
    String(email).toLowerCase(),
  );
  for (const email of expected.users) {
    if (!actualUsers.includes(email)) {
      problems.push(`missing auth user ${email}`);
    }
  }
  return problems;
}

function collectContext(args, harDir) {
  const parts = [
    args.context,
    process.env.HAR_TASK_CONTEXT,
    process.env.HAR_WORK_TITLE,
    process.env.HAR_SEED_CONTEXT,
  ].filter(Boolean);
  const slotFile = args["slot-file"];
  if (slotFile && fs.existsSync(slotFile)) {
    try {
      const slot = JSON.parse(fs.readFileSync(slotFile, "utf8"));
      if (slot.workUnitId) {
        const unitsDir = path.join(harDir, "work-units");
        if (fs.existsSync(unitsDir)) {
          for (const name of fs.readdirSync(unitsDir)) {
            if (!name.endsWith(".json")) continue;
            const unit = readJson(path.join(unitsDir, name));
            if (unit.id === slot.workUnitId || unit.workUnitId === slot.workUnitId) {
              parts.push(unit.title, unit.summary, unit.description);
            }
          }
        }
      }
    } catch {
      // Slot / work-unit metadata is optional context, never fatal.
    }
  }
  return parts.filter(Boolean).join("\n");
}

function runSelfTest(harDir) {
  const { registry, profiles } = loadLine(harDir, "production-reproducibility");
  if (registry.defaultLine !== "production-reproducibility") {
    fail("self-test: default factory line should be production-reproducibility");
  }
  const ids = profiles.map((profile) => profile.id).sort();
  const expectedIds = ["empty-user", "user-with-notes", "user-with-shared-notes"];
  if (ids.join() !== expectedIds.join()) {
    fail(`self-test: expected shipped profiles ${expectedIds.join(", ")}, got ${ids.join(", ")}`);
  }
  const cases = [
    ["empty notes list for a new user", "empty-user"],
    ["fix the empty state when there are no notes", "empty-user"],
    ["preview notes in the tiptap editor", "user-with-notes"],
    ["share a note with a teammate by email", "user-with-shared-notes"],
    ["recipient cannot open the shared viewer link", "user-with-shared-notes"],
    ["", "user-with-notes"],
  ];
  for (const [context, expected] of cases) {
    const selected = selectItem(profiles, {
      context,
      defaultId: "user-with-notes",
      kind: "profile",
    });
    if (selected.item.id !== expected) {
      fail(
        `self-test: context ${JSON.stringify(context)} selected ${selected.item.id}, expected ${expected}`,
      );
    }
  }
  const explicit = selectItem(profiles, {
    explicitId: "empty-user",
    context: "share notes with a teammate",
    defaultId: "user-with-notes",
    kind: "profile",
  });
  if (explicit.item.id !== "empty-user" || explicit.reason !== "explicit") {
    fail("self-test: explicit profile must win over task context");
  }
  const broken = validateProfile({
    id: "bad",
    title: "Bad",
    description: "no users",
    users: [],
    notes: [],
  });
  if (!broken.length) fail("self-test: empty users should be invalid");
  const shared = profiles.find((profile) => profile.id === "user-with-shared-notes");
  const problems = compareState(shared, {
    notes: expectedState(shared).notes,
    shares: expectedState(shared).shares,
    users: expectedState(shared).users,
  });
  if (problems.length) fail(`self-test: shared profile should match itself (${problems.join("; ")})`);
}

function resolveLineAndProfile(harDir, args) {
  const registry = loadRegistry(harDir);
  const context = collectContext(args, harDir);
  const lineSelection = selectItem(registry.lines, {
    explicitId: args.line || process.env.HAR_FACTORY_LINE,
    context,
    defaultId: registry.defaultLine,
    kind: "factory line",
  });
  const loaded = loadLine(harDir, lineSelection.item.id);
  const profileSelection = selectItem(loaded.profiles, {
    explicitId: args.profile || process.env.HAR_SEED_PROFILE,
    context,
    defaultId: loaded.defaultProfile,
    kind: "profile",
  });
  return { context, lineSelection, loaded, profileSelection };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const harDir = path.resolve(args["har-dir"] || path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".."));

  if (command === "check") {
    const registry = loadRegistry(harDir);
    const lines = registry.lines.map((line) => {
      const loaded = loadLine(harDir, line.id);
      return {
        id: line.id,
        profiles: loaded.profiles.map((profile) => profile.id),
        defaultProfile: loaded.defaultProfile,
      };
    });
    if (args["self-test"]) runSelfTest(harDir);
    process.stdout.write(
      JSON.stringify({ status: "ok", lines, defaultLine: registry.defaultLine }, null, 2) +
        "\n",
    );
    return;
  }

  if (command === "select") {
    const result = resolveLineAndProfile(harDir, args);
    const profile = result.profileSelection.item;
    const login = primaryUser(profile);
    process.stdout.write(
      JSON.stringify(
        {
          line: result.lineSelection.item.id,
          lineReason: result.lineSelection.reason,
          profile: profile.id,
          profileReason: result.profileSelection.reason,
          context: result.context,
          login: { email: login.email, password: login.password, label: login.label },
          users: profile.users.map((user) => ({
            key: user.key,
            email: user.email,
            password: user.password,
            label: user.label || user.key,
            primary: Boolean(user.primary) || user.key === login.key,
          })),
          expected: expectedState(profile),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  if (command === "sql" || command === "verify-sql" || command === "verify") {
    const result = resolveLineAndProfile(harDir, args);
    const profile = result.profileSelection.item;
    if (command === "sql") {
      process.stdout.write(applySql(profile));
      return;
    }
    if (command === "verify-sql") {
      process.stdout.write(`${verifySql(profile)}\n`);
      return;
    }
    const actualRaw = args.actual || "";
    let actual;
    try {
      actual = JSON.parse(actualRaw);
    } catch {
      fail("verify --actual must be JSON from verify-sql");
    }
    const problems = compareState(profile, actual);
    process.stdout.write(
      JSON.stringify(
        {
          status: problems.length ? "fail" : "pass",
          profile: profile.id,
          problems,
          expected: expectedState(profile),
          actual,
        },
        null,
        2,
      ) + "\n",
    );
    if (problems.length) process.exit(1);
    return;
  }

  fail(
    "Usage: catalog.mjs check|select|sql|verify-sql|verify --har-dir <path> [--line ID] [--profile ID] [--context TEXT]",
  );
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invoked) {
  try {
    main();
  } catch (error) {
    const payload = { status: "fail", error: error.message };
    if (error.extra) payload.details = error.extra;
    process.stderr.write(`${error.message}\n`);
    if (error.extra) process.stderr.write(`${JSON.stringify(error.extra, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(1);
  }
}
