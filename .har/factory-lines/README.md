# HAR factory lines

Factory lines are named pipelines an agent runs **after launch**, chosen from
the task context. The first line is **production reproducibility**: put the
shared local Supabase into a known seeding profile so empty-state, happy-path,
and sharing work start from the same data every time.

Agents talk to factory lines through the stage registry (`factory-line`,
`factory-line-catalog`) or:

```bash
./.har/factory-lines/run.sh <id> --list
./.har/agent-cli.sh <id> factory-line --context "share a note with a teammate"
./.har/agent-cli.sh <id> factory-line --profile empty-user
```

Explicit `--line` / `--profile` (or `HAR_FACTORY_LINE` / `HAR_SEED_PROFILE`)
always win. Otherwise the catalog scores `match.keywords` against `--context`,
`HAR_TASK_CONTEXT`, `HAR_WORK_TITLE`, and the bound work-unit title.

Applying a production-reproducibility profile **truncates `notes` and
`note_shares` for every slot** (Supabase is shared). Auth users from the
profile are created idempotently and left in place. Check other slots before
switching profiles.

## Add a seeding profile

1. Copy `production-reproducibility/profiles/_template.json` to
   `production-reproducibility/profiles/<id>.json`.
2. Set `"id"` to `<id>` (must match the filename).
3. Fill `users` (one with `"primary": true` is the login the agent should use)
   and `notes`. `shares` on a note is a list of user keys or emails.
4. Add `match.keywords` for the tasks that should select this profile.
5. Validate: `./.har/stages/factory-line-catalog.sh <id>`
6. Apply: `./.har/agent-cli.sh <id> factory-line --profile <id>`

No new script is required. Dropping a valid JSON file is enough.

## Add a factory line

1. Create `.har/factory-lines/<line-id>/` with `line.json` and `run.sh`.
2. Register it in `.har/factory-lines.json`.
3. Keep stdout of `run.sh` on stderr; the dispatcher emits the stage JSON.

`run.sh` for a line receives `$1` = agent id. Selection is already in
`HAR_FACTORY_SELECTION` / `HAR_SEED_PROFILE`.
