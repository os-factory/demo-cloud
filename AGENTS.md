# Agent Environment

This repository uses a **`.har/` harness** for isolated agent development.

<!-- har:agent-environment:start -->
## HAR / agent environment

The harness is not just a verification gate — it is **how you run this project**.
To see the app live (manual testing, browser sessions, screenshots, driving the UI),
use `har env launch <id>` or `./.har/launch.sh <id>`. It already encodes database
setup, ports, env vars, and process management — never hand-roll `docker` / dev-server
startup, and never claim a task "can't be verified live" without launching a slot first.

If a harness command fails, fix the harness (or report the failure) — do not quietly
fall back to ad-hoc commands.

### Before making changes

1. On the **main checkout**, switch to the intended base (usually `main`) — launch
   creates a worktree from that HEAD.
2. **Launch first** — MCP `har_launch_environment` / `har env launch 1`. Use the
   returned **work dir** for ALL edits (never the main checkout).
   **Bind tracker work** when the task names a durable issue or ticket (GitHub,
   Linear, etc.): pass a short repo-scoped `--work-id` / `workUnitId` (e.g.
   `widget-123`), `--work-source` / `source`, `--work-url` / `sourceUrl`, and
   `--work-title` / `title` when known. Skip binding for ad-hoc work with no
   tracker identity.
3. Read [`.har/README.md`](.har/README.md), [`.har/stages.json`](.har/stages.json), then
   [`.har/CLAUDE.agent.md`](.har/CLAUDE.agent.md) (slot URLs / definition of done).
4. Hot-reload usually applies; if not, `./.har/agent-cli.sh <id> restart` (no-op on
   cli/ios profiles without managed processes).

**Occupied slots always block.** Run `complete` / `teardown`, then `launch`. Resume
failed/starting launches with `--resume` / `recover`. Prefer a free slot (2+) over
sharing slot 1 across unrelated chats. Check `har_get_status` / `har env status` first.
Commit early — teardown keeps the branch, not uncommitted work.

### After making changes

Prefer MCP → CLI → shell. Quick verify for the loop; **full verify before done**.

- MCP: `har_run_verification` / `full: true`; finish with `har_complete_environment`
  (propose; wait for approval) or `har_teardown_environment`
- CLI: `har env verify 1`, `har env verify 1 --full`, `complete 1`, `teardown 1`
- Shell: `./.har/verify.sh 1`, `./.har/verify.sh 1 --full`, `./.har/teardown.sh 1`

Commit in the session worktree. Run JSON stays in the main checkout `.har/runs/`.

### Definition of done

- Full verify passes; edits only in the session worktree; tests cover new behavior;
  changes committed; show preview URLs; then **session handoff** (below).

### Session handoff (required)

After full verify and commit, stop. Include summary, session branch
(`.har/slots/agent-<id>.json`), preview URLs, and **screenshots of the requested
UI changes** from `.har/artifacts/browser-e2e/handoff/` (Read each PNG so it
appears in chat). Wait — never autonomously complete, teardown, push, or open a PR.
**Default:** when `gh`/GitHub MCP is available, recommend **Complete + open a PR**
(still needs approval). Alternatives: **Complete only**, or **Something else**.
Without PR tooling, recommend **Complete only** and give the session branch for a
manual push.

### Commit gate

Full verify records a tree hash under `.har/validations/`. With `har hooks install`,
commits must match a passing full verify. Re-verify after any edit; `git add -A`.
Do not bypass (`--no-verify`, `HAR_SKIP_GATE=1`).

### Cursor IDE

If `.cursor/rules/har-workflow.mdc` exists, the same harness workflow is injected into
every Cursor agent session automatically. Run `har env init` or `har env maintain` to
create or refresh it.
<!-- har:agent-environment:end -->

## Project-specific notes

**Stack:** Next.js 15 (App Router) + Supabase (Auth via `@supabase/ssr`), TypeScript, Tailwind. One process serves the frontend, API routes, and server actions — there is no separate backend.

**Supabase is a shared dependency**, not a per-slot resource: `./.har/setup-infra.sh` starts ONE local Supabase stack (Postgres, Auth/GoTrue, PostgREST, Kong, Studio, Mailpit) via the Supabase CLI from `supabase/config.toml`, reused by every agent slot on fixed ports (API `54321`, Postgres `54322`, Studio `54323`, Mailpit `54324`). It is started automatically by `launch.sh` — never run `supabase start`/`stop` by hand, and never reset the shared database (`agent-cli.sh <id> reset-db`) without checking other slots first.

**Credentials:** a demo login is created idempotently — `agent-demo@example.com` / `agent-demo-password-123`. Email confirmation is disabled for local dev, so any new sign-up returns an active session immediately; password-reset emails land in Mailpit (`http://127.0.0.1:54324`), not a real inbox.

**Factory lines:** after launch, run a task-specific pipeline. The first line is **production reproducibility** — it seeds the shared database into a named profile (`empty-user`, `user-with-notes`, `user-with-shared-notes`). Pick one from the task (`./.har/agent-cli.sh <id> factory-line --context "..."`) or pass `--profile`. Adding a profile is a JSON file under `.har/factory-lines/production-reproducibility/profiles/` — see [`.har/factory-lines/README.md`](.har/factory-lines/README.md). Applying a profile truncates `notes` / `note_shares` for every slot.

**Definition of done:** full verify passes (typecheck, lint, `/api/health`, the readiness smoke in `.har/readiness.sh`, factory-line-catalog, and the Playwright `browser-e2e` stage). UI changes must add or update specs under `tests/` and capture a named handoff screenshot (`handoffScreenshot` from `tests/helpers/fixtures.js`). Show those PNGs from `.har/artifacts/browser-e2e/handoff/` in the session handoff. See [`.har/CLAUDE.agent.md`](.har/CLAUDE.agent.md) and [`.har/stages/PLAYWRIGHT.md`](.har/stages/PLAYWRIGHT.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
