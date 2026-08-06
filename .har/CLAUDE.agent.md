# Agent ${AGENT_ID} — Development Environment

> [`AGENTS.md`](../AGENTS.md) · [`.har/README.md`](./README.md) · [`stages.json`](./stages.json)

## Environment

| | |
|--|--|
| **Agent ID** | ${AGENT_ID} |
| **Frontend (+ API/server actions)** | http://localhost:${FE_PORT} — one Next.js server, no separate backend |
| **Work dir** | Fresh session worktree per launch — see the launch output or `.har/slots/agent-${AGENT_ID}.json` |
| **Supabase (shared, all slots)** | API `http://127.0.0.1:54321` · Studio `http://127.0.0.1:54323` · Mailpit `http://127.0.0.1:54324` · DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

**Never edit the main checkout** — launch FIRST, then make ALL file edits under the work dir from the launch output. Edits there hot-reload in the running slot; use `./.har/agent-cli.sh ${AGENT_ID} restart` if a change doesn't take. An occupied slot always blocks a new launch — run `./.har/teardown.sh ${AGENT_ID}` (or `complete`) first, then launch again.

This slot runs **only the primary application** (the Next.js app, `HARNESS_PRIMARY_APP=app`). Supabase is a **shared dependency** — ONE local stack (Postgres, Auth/GoTrue, PostgREST, Kong, Studio, Mailpit) started once by `setup-infra.sh` and reused by every agent slot on fixed ports. Never run `supabase start`/`stop` yourself — `setup-infra.sh` (called automatically by `launch.sh`) owns it.

```bash
./.har/agent-cli.sh ${AGENT_ID} status
./.har/agent-cli.sh ${AGENT_ID} logs
./.har/agent-cli.sh ${AGENT_ID} health
./.har/agent-cli.sh ${AGENT_ID} url
```

## Credentials

A demo login is created idempotently by `setup-infra.sh` (via the Supabase Auth API) so you don't have to sign up through the UI first:

| Email | Password |
|-------|----------|
| `agent-demo@example.com` | `agent-demo-password-123` |

Sign-up/sign-in also works for any new email — **email confirmation is disabled** in `supabase/config.toml` for local dev (`auth.email.enable_confirmations = false`), so `supabase.auth.signUp()` returns an active session immediately, no email click required. The "forgot password" flow still sends a real email — check it in Mailpit at `http://127.0.0.1:54324` (nothing leaves the machine).

## Readiness

- **Health** (process only, no Supabase call): `./.har/agent-cli.sh ${AGENT_ID} health` → `GET /api/health`
- **Agent-usable smoke** (`verify --full`, or `./.har/readiness.sh ${AGENT_ID}`): confirms the running frontend is wired to Supabase (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` reaching the app — no env-var warning banner) AND that a real sign-up against the shared Supabase Auth API returns a session.
- **Skipped from full local Supabase dev setup**: `storage`, `realtime`, `edge_runtime`, and `analytics` are disabled in `supabase/config.toml` — this app only uses Supabase Auth, so those containers never start. Flip them back on in `supabase/config.toml` (then `supabase stop && supabase start`, or re-run `./.har/setup-infra.sh`) if you add features that need them.
- **No custom database schema**: this starter only uses Supabase Auth (`auth.users`), so there are no app migrations/seed data. If you add tables, put migrations under `supabase/migrations/` and seed rows in `supabase/seed.sql` — both are applied automatically by `supabase start` / `supabase db reset`, not through this harness's generic migrate/seed hooks.

## Definition of done

- [ ] Full verification returns `"status": "pass"` (`har env verify ${AGENT_ID} --full`, MCP `har_run_verification` with `full: true`, or `./.har/verify.sh ${AGENT_ID} --full`)
- [ ] The slot is agent-usable: sign up or log in (demo login above) through the running frontend actually works
- [ ] Full verify runs every registered stage in `stages.json` `verificationStages` (Playwright, custom checks, …) — when `stages/browser-e2e.sh` exists, adapt specs under `tests/` for UI changes
- [ ] New behavior has automated test coverage (unit and/or browser as appropriate)
- [ ] Changes committed **in the session worktree** with a clear message
- [ ] The user got the preview URL to test the app themselves
- [ ] Present session handoff (summary, branch, preview URL) and **wait for user** before `complete`, push, or PR
- [ ] On user approval of the default: push + open PR (when `gh`/GitHub MCP available), then `har env complete ${AGENT_ID}` (or MCP `har_complete_environment`) — full verify + validation + teardown, branch kept

### Session handoff

After full verify and commit, stop and propose next steps. Never autonomously run
`complete`, `teardown`, `git push`, or open a PR. **Default recommendation:** when
`gh` or GitHub MCP is available, complete the slot **and** open a PR (push → PR →
`har env complete` / `har_complete_environment`). Offer complete-only or something
else as alternatives. If PR tooling is unavailable, recommend complete and report
the session branch for a manual push. Prefer `complete` over bare `teardown` when
the work succeeded. See `.cursor/rules/har-workflow.mdc` for the handoff shape.

Quick loop during development: MCP `har_run_verification`, `har env verify ${AGENT_ID}`, or `./.har/verify.sh ${AGENT_ID}` (smoke + health only; `--full` adds the registered verification stages).

Stages are the harness's single vocabulary for checks: templates and custom stages compile to generic kinds in `.har/stages.json`, and you interact with them only through the registry (`har_run_stage`, `verify`), never stack-specific tooling. Authoring guide: `.har/STAGES.md`.

## Project commands

```bash
npm run typecheck   # tsc --noEmit — fast, run in quick verify
npm run lint         # eslint . — run in full verify
npm run build        # next build — production build (not run in verify; slow)
npm run dev          # next dev — what launch.sh runs per slot via PM2
```

## Do not

- Hand-roll docker/dev-server startup, or run `supabase start`/`stop` yourself — `launch` is how you run the app (manual testing, browser, screenshots included); it calls `setup-infra.sh` for you
- Work around a failing harness command with ad-hoc setup — fix the harness or report the failure
- Hardcode ports — use `./.har/agent-cli.sh ${AGENT_ID} url` or read `.env.agent.${AGENT_ID}`
- Run raw `docker` commands against the Supabase containers — use `./.har/agent-cli.sh ${AGENT_ID} psql` / `reset-db`, or the Supabase CLI (`supabase status`, `supabase db reset`) from the repo root
- Reset the shared Supabase database (`./.har/agent-cli.sh <id> reset-db`) without checking other slots aren't relying on existing data — it affects every running agent
- Edit `.env.agent.${AGENT_ID}` or PM2 ecosystem files by hand
- Run `verify` before `launch` when health or e2e steps need a running server
- Edit the main checkout — all edits go under the session work dir
