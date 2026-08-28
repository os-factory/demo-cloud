# .har — Agent Harness

This directory is the **agent harness** for this repository. It lets AI coding agents (Cursor, Claude Code, etc.) run the Next.js app in isolated environments — each with its own ports and git worktree — against **one shared local Supabase stack**.

Generated and maintained by [`har`](https://github.com/os-factory/har). Run `har env maintain` when the repo stack changes.

**The harness is how you run this project.** Need the app live — manual testing, a browser session, screenshots? `launch` a slot; don't hand-roll `next dev` or `supabase start` yourself. If a harness command fails, fix the harness or report it — don't silently fall back to ad-hoc commands.

## What's in here

| File | Purpose |
|------|---------|
| `README.md` | This file — index of the harness |
| `manifest.json` | Generator metadata (version, checksums) — do not edit |
| `harness.env` | Shared config: primary app, ports, agent slot limits, Supabase project id, `har_pg` helper |
| `stages.json` | Machine-readable registry of runnable harness stages |
| `factory-lines.json` | Named pipelines (factory lines) selected from task context |
| `factory-lines/` | Factory-line runner, catalog, and seeding profiles |
| `stages/` | Optional custom stage scripts registered from `stages.json` (currently just the `README.sh` placeholder) |
| `runs/` | Run history from `har env` / MCP only — `.har/runs/YYYY-MM-DD/HH-mm-ss_<stageId>_agent-<id>.json` (gitignored) |
| `state/supabase.env` | Resolved Supabase URLs/keys, written by `setup-infra.sh` from `supabase status` (gitignored) |
| `agent-slot.sh` | Shared agent-id validation, port allocation, env templating, `har_pg` (reads `harness.env`) |
| `setup-infra.sh` | Start the shared local Supabase stack (via the Supabase CLI) and ensure a demo login exists |
| `launch.sh` | Launch one agent slot (worktree, ports, toolchain provisioning, PM2 process) |
| `provision-toolchain.sh` | Install deps and write toolchain paths to `.env.agent.<id>` |
| `readiness.sh` | "Agent usable" smoke test — frontend wired to Supabase + real sign-up works |
| `verify.sh` | Verification pipeline (smoke by default; `--full` adds lint, readiness, registered stages) |
| `teardown.sh` | Tear down one agent slot (keeps the shared Supabase stack running) |
| `agent-cli.sh` | Manage a running agent (status, logs, psql, health, url, reset-db, factory-line) |
| `attach.sh` | Attach to agent tmux session |
| `docker-compose.agent.yml` | Intentionally empty (`services: {}`) — Supabase CLI manages its own containers; see below |
| `env.template` | Per-agent env vars, incl. `NEXT_PUBLIC_SUPABASE_*` (expanded by `launch.sh`) |
| `ecosystem.agent.template.cjs` | PM2 process for the primary app — one Next.js dev server (expanded by `launch.sh`) |
| `CLAUDE.agent.md` | Detailed instructions for coding agents |
| `justfile` | Optional shortcuts (requires `just`) |

`docker-compose.agent.yml` is intentionally empty (`services: {}`) — the Supabase CLI manages its own Docker containers directly from `supabase/config.toml` (repo root, committed), so `HARNESS_INFRA_SERVICES` is intentionally empty too and `setup-infra.sh` never runs `docker compose` against this file.

## Quick start

**Preferred — har CLI or MCP** (persists run history under `.har/runs/`):

```bash
har env launch 1
har env verify 1
har env verify 1 --full
har env teardown 1
```

In Cursor with HAR MCP configured: use `har_launch_environment`, `har_run_verification`, and `har_teardown_environment`.

**Shell fallback** (no CLI/MCP installed):

```bash
./.har/setup-infra.sh         # starts the shared local Supabase stack (first run pulls Docker images)
./.har/launch.sh 1             # also runs setup-infra.sh for you
./.har/verify.sh 1              # quick: typecheck + health
./.har/verify.sh 1 --full       # + lint, readiness smoke, factory-line-catalog
./.har/agent-cli.sh 1 factory-line --list
./.har/teardown.sh 1
```

Read **`stages.json`** for registered stages and **`verificationStages`** for the expected pass set. Factory lines (task-context pipelines) are documented in [factory-lines/README.md](./factory-lines/README.md).

## Verification contract

| Mode | Command | Steps |
|------|---------|-------|
| Quick | `har env verify <id>` or `verify.sh <id>` | `npm run typecheck` (`tsc --noEmit`) + `GET /api/health` |
| Full | `har env verify <id> --full` or `verify.sh <id> --full` | + `npm run lint` (no `test` script exists — skipped), `readiness.sh` (Supabase-wired sign-up smoke), `factory-line-catalog` (seeding profile schema + context routing), and any other registered `verificationStages` |

Reuse of real project commands: `typecheck` and `lint` come straight from `package.json`. There is no `test` script in this starter kit — `verify.sh` prints a skip notice for that step rather than failing.

Playwright is installed (`browser-e2e` in `verificationStages`). UI changes must add or update specs under `tests/` and capture a named handoff screenshot (`handoffScreenshot` from `tests/helpers/fixtures.js`). Full verify writes PNGs to `.har/artifacts/browser-e2e/handoff/` — show those in the session handoff. See [`.har/stages/PLAYWRIGHT.md`](./stages/PLAYWRIGHT.md).

## Readiness layers

| Layer | What it means | Where it's encoded |
|-------|---------------|---------------------|
| Infra ready | The shared local Supabase stack (Postgres, Auth, REST, Studio, Mailpit) is running | `setup-infra.sh`, `supabase/config.toml` |
| Slot data ready | Named seeding profiles via the **production-reproducibility** factory line (empty user, user with notes, user with shared notes). Applying a profile truncates `notes` / `note_shares` on the shared Supabase. | `.har/factory-lines/`, `agent-cli.sh <id> factory-line` |
| Process ready | The Next.js process for the slot is online and `/api/health` passes | `launch.sh`, `verify.sh` |
| Agent usable | The running frontend is actually wired to Supabase (no env-var warning banner) and a real sign-up against the shared Auth API returns a session | `readiness.sh`, `HARNESS_READINESS_CMD`, `verify --full` |

Skipped from the full local-dev setup, on purpose: `realtime`, `storage`, `edge_runtime`, and `analytics` are disabled in `supabase/config.toml` since this starter app only exercises Supabase Auth — enable them there if you add features that need them. A demo login (`agent-demo@example.com` / `agent-demo-password-123`) is created idempotently by `setup-infra.sh` so agents have a documented working credential without signing up through the UI first.

## Run history

| Entry point | Writes `.har/runs/`? |
|-------------|------------------------|
| `./.har/*.sh` | No — same scripts, no run record |
| `har env …` / MCP | Yes — under main checkout `.har/runs/YYYY-MM-DD/` |

With git worktree slots, verification runs code in the worktree but run JSON stays in the main repo `.har/runs/`. Each record includes `workDir` when a slot is active.

## For coding agents

1. Read repo [`AGENTS.md`](../AGENTS.md)
2. Read this file and `stages.json`
3. After launch, read `.har/CLAUDE.agent.md` for slot URLs, demo credentials, and definition of done

Prefer HAR MCP tools or `har env …` for launch, verify, and teardown. Use `./.har/*.sh` only when the CLI is not installed.

Always use `./.har/agent-cli.sh <id> ...` — never hardcoded ports.

## Factory lines

Named pipelines selected from the task, registered in `factory-lines.json`.
The first line is **production reproducibility**: it replaces `notes` /
`note_shares` with a seeding profile (`empty-user`, `user-with-notes`,
`user-with-shared-notes`) and ensures the matching Auth users exist.

```bash
./.har/agent-cli.sh <id> factory-line --list
./.har/agent-cli.sh <id> factory-line --context "share a note with a teammate"
./.har/agent-cli.sh <id> factory-line --profile empty-user
```

Add a profile by dropping a JSON file under
`factory-lines/production-reproducibility/profiles/` — see
[factory-lines/README.md](./factory-lines/README.md). Applying a profile
mutates the **shared** database; check other slots first.

## Architecture

This repo is a **single Next.js app** — frontend, API routes, and server actions all run in one process, so there is no separate backend service to run per slot. Each agent slot gets an isolated frontend/API port and its own git worktree; Supabase is a single shared dependency used by every slot.

Defaults follow `HARNESS_FE_BASE_PORT + (AGENT_ID × HARNESS_PORT_STEP)`; when a default is busy, `launch.sh` scans the slot lane (`STEP` increments) and writes the resolved port to `.env.agent.<id>` and `.har/slots/agent-<id>.json`.

Configure how many slots your machine can run in parallel in `.har/stages.json` (`agentSlots`). Bash scripts and the CLI read that first; `harness.env` keeps legacy `HARNESS_AGENT_SLOT_*` exports in sync via `har env maintain --finalize`.

| Service | Agent 1 (default) | Agent 2 (default) |
|---------|-------------------|-------------------|
| Frontend + API (Next.js) | 3000 | 3010 |
| Node debug | 9200 | 9210 |

## Port & shared services

### Port allocation

| Layer | Scope | Rule | On conflict |
|-------|-------|------|-------------|
| Frontend + API (Next.js — same process) | Per slot | `HARNESS_FE_BASE_PORT + (AGENT_ID × HARNESS_PORT_STEP)` | Scan `STEP` increments within the slot lane |
| Node debug | Per slot | `9200 + (AGENT_ID × STEP)` | Same scan policy |
| Supabase API (Kong) | Per machine, fixed | `54321` (`supabase/config.toml`) | Edit the port in `supabase/config.toml`, then `supabase stop && supabase start` |
| Supabase Postgres | Per machine, fixed | `54322` (`supabase/config.toml`) | Same as above |
| Supabase Studio | Per machine, fixed | `54323` (`supabase/config.toml`) | Same as above |
| Supabase Mailpit | Per machine, fixed | `54324` (`supabase/config.toml`) | Same as above |

Resolved app ports may differ from the formula when something else is already bound. Always use `./.har/agent-cli.sh <id> url` or read `.har/slots/agent-<id>.json` — never hardcode `3000`, `54322`, etc. in app code or tests. Supabase's ports are NOT scanned/reallocated by this harness (one shared instance, so conflicts are rare and surfaced directly by `supabase start`).

### Shared vs per-slot

| Resource | Model | Configuration |
|----------|-------|----------------|
| Supabase (Postgres, Auth, REST, Studio, Mailpit) | ONE shared local stack for every slot, on fixed ports | `supabase/config.toml`; started by `setup-infra.sh` via the Supabase CLI (not `docker-compose.agent.yml` — `HARNESS_INFRA_SERVICES` is intentionally empty) |
| Primary application (Next.js) | One PM2 process per slot, isolated port | `HARNESS_PRIMARY_APP=app`, `ecosystem.agent.template.cjs` |

Shared infra starts once via `./.har/setup-infra.sh` (also run automatically by `launch.sh`), and resolves Supabase's URLs/keys into `.har/state/supabase.env`, which every slot's env file (`env.template` → `.env.agent.<id>`) reads from. There is no per-slot database, bucket, or Supabase project to create in `launch.sh` — the same Supabase URL and keys are handed to every slot.

### Do not

- Hardcode default ports (`3000`, `54322`, `3847`, …) in application code, tests, or agent docs — read from `.env.agent.<id>`, `agent-cli.sh`, or the slot registry
- Run `supabase start` / `supabase stop` yourself, or raw `docker` commands against the Supabase containers — use `./.har/setup-infra.sh` (called automatically by `launch.sh`) and `./.har/agent-cli.sh <id> psql` / `reset-db`
- Reset the shared Supabase database (`reset-db`) without checking other slots aren't relying on existing data — it affects every running agent, not just the one you're working on

## Maintaining this harness

When the project stack changes (new services, different test commands, new env vars):

```bash
har env maintain
```

The authoring agent updates scripts and this README. Review changes before committing.

**Do not** put runtime behavior in YAML — edit the scripts directly.

## Session lifecycle

Every `launch` starts a **fresh session**: a new git worktree from the **main
checkout's current HEAD** at
`~/worktrees/<base-branch>-<sha4>-har-agent-<id>-<rand4>`, on a branch of the same name.
Switch that checkout to your intended base before launch. The session is recorded in
`.har/slots/agent-<id>.json` (the slot registry) — status, verify, and teardown resolve
the work dir through it. Make ALL file edits under the work dir printed by launch,
never in the main checkout.

- Occupied slots always block a new launch: `har env complete <id>` (or `teardown <id>`),
  then `har env launch <id>`. A new launch never chooses `main` for you — switch the
  main checkout to your intended base first.
- `teardown` removes the worktree but **keeps the session branch** so you can push it
  or open a PR (`--delete-branch` to drop it). The shared Supabase stack is left
  running for other slots — `teardown` never stops it.
- If launch fails after creating a worktree/env file, the registry records `status: failed`.
  Resume it instead of starting fresh: `har env launch <id> --resume` or `har env recover <id>`.
- `har env complete <id>` finishes a session: full verify (recorded as a validation),
  then teardown — branch kept.
- `--no-worktree` runs the slot from the repo root instead (single-agent mode).
