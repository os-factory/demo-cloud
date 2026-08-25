#!/usr/bin/env bash
# Dispatch a factory line for this slot. Task context picks the line and
# (for production-reproducibility) the seeding profile unless flags override.
#
# Usage:
#   ./.har/factory-lines/run.sh <agent-id> [--line ID] [--profile ID] [--context TEXT]
#   ./.har/factory-lines/run.sh <agent-id> --list
#   ./.har/factory-lines/run.sh <agent-id> --dry-run [--line ID] [--profile ID] [--context TEXT]
#   ./.har/factory-lines/run.sh <agent-id> --verify-only [--profile ID]
#
# Env overrides: HAR_FACTORY_LINE, HAR_SEED_PROFILE, HAR_TASK_CONTEXT, HAR_WORK_TITLE
set -euo pipefail

FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$FACTORY_DIR/.." && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
SCRIPT_DIR="$HARNESS_DIR"

# shellcheck source=/dev/null
source "$HARNESS_DIR/harness.env"
# shellcheck source=/dev/null
source "$HARNESS_DIR/agent-slot.sh"

har_main_root() {
  local git_common
  git_common="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null || true)"
  if [ -n "$git_common" ]; then
    (cd "$git_common/.." && pwd)
  else
    echo "$REPO_ROOT"
  fi
}

MAIN_ROOT="$(har_main_root)"
MAIN_HARNESS="$MAIN_ROOT/.har"
if [ -f "$MAIN_HARNESS/state/supabase.env" ]; then
  # shellcheck source=/dev/null
  source "$MAIN_HARNESS/state/supabase.env"
fi

AGENT_ID="${1:?Usage: factory-lines/run.sh <agent-id> [--line ID] [--profile ID] [--context TEXT]}"
shift

LINE_ID="${HAR_FACTORY_LINE:-}"
PROFILE_ID="${HAR_SEED_PROFILE:-}"
CONTEXT="${HAR_TASK_CONTEXT:-}"
LIST=""
DRY_RUN=""
VERIFY_ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --line) LINE_ID="${2:?}"; shift 2 ;;
    --profile) PROFILE_ID="${2:?}"; shift 2 ;;
    --context) CONTEXT="${2:?}"; shift 2 ;;
    --list) LIST=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    --line=*) LINE_ID="${1#*=}"; shift ;;
    --profile=*) PROFILE_ID="${1#*=}"; shift ;;
    --context=*) CONTEXT="${1#*=}"; shift ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

validate_agent_id "$AGENT_ID"

log() { echo "==> [factory-line agent-$AGENT_ID] $*" >&2; }

CATALOG="$FACTORY_DIR/lib/catalog.mjs"
ARTIFACT_DIR="${HAR_FACTORY_ARTIFACT_DIR:-$MAIN_HARNESS/artifacts/factory-line}"
mkdir -p "$ARTIFACT_DIR"

START_TOTAL=$(now_ms)

emit_result() {
  local status="$1"
  local extra="$2"
  local total_ms=$(( $(now_ms) - START_TOTAL ))
  node -e '
const extra = JSON.parse(process.argv[1] || "{}");
const out = {
  status: process.argv[2],
  stageId: "factory-line",
  kind: "custom",
  agent_id: Number(process.argv[3]),
  total_ms: Number(process.argv[4]),
  artifacts: [{ path: ".har/artifacts/factory-line", kind: "directory" }],
  ...extra,
};
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
' "$extra" "$status" "$AGENT_ID" "$total_ms"
}

if [ -n "$LIST" ]; then
  LIST_JSON="$(node "$CATALOG" check --har-dir "$HARNESS_DIR" --self-test)"
  log "Factory lines and seeding profiles:"
  echo "$LIST_JSON" | node -e '
const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
for (const line of d.lines) {
  console.error("  " + line.id + "  defaultProfile=" + line.defaultProfile);
  for (const id of line.profiles) console.error("    - " + id);
}
' >&2
  emit_result "pass" "$(node -e 'process.stdout.write(JSON.stringify({ action: "list", catalog: JSON.parse(process.argv[1]) }))' "$LIST_JSON")"
  exit 0
fi

SELECT_ARGS=(select --har-dir "$HARNESS_DIR")
[ -n "$LINE_ID" ] && SELECT_ARGS+=(--line "$LINE_ID")
[ -n "$PROFILE_ID" ] && SELECT_ARGS+=(--profile "$PROFILE_ID")
[ -n "$CONTEXT" ] && SELECT_ARGS+=(--context "$CONTEXT")
REG_FILE="$(slot_registry_file "$AGENT_ID")"
[ -f "$REG_FILE" ] && SELECT_ARGS+=(--slot-file "$REG_FILE")

SELECTION="$(node "$CATALOG" "${SELECT_ARGS[@]}")"
LINE_ID="$(echo "$SELECTION" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.line)')"
PROFILE_ID="$(echo "$SELECTION" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.profile)')"
LINE_REASON="$(echo "$SELECTION" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.lineReason)')"
PROFILE_REASON="$(echo "$SELECTION" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.profileReason)')"

log "Selected line=${LINE_ID} (${LINE_REASON}) profile=${PROFILE_ID} (${PROFILE_REASON})"

LINE_SCRIPT="$HARNESS_DIR/$(node -e '
const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const id = process.argv[2];
const line = r.lines.find((l) => l.id === id);
if (!line) process.exit(1);
process.stdout.write(line.script);
' "$HARNESS_DIR/factory-lines.json" "$LINE_ID")"

if [ ! -x "$LINE_SCRIPT" ] && [ ! -f "$LINE_SCRIPT" ]; then
  echo "Factory line script missing: $LINE_SCRIPT" >&2
  emit_result "fail" "{\"error\":\"missing script ${LINE_SCRIPT}\"}"
  exit 1
fi

export HAR_FACTORY_LINE="$LINE_ID"
export HAR_SEED_PROFILE="$PROFILE_ID"
export HAR_TASK_CONTEXT="${CONTEXT}"
export HAR_FACTORY_SELECTION="$SELECTION"
export HAR_FACTORY_ARTIFACT_DIR="$ARTIFACT_DIR"
export HAR_FACTORY_DRY_RUN="${DRY_RUN}"
export HAR_FACTORY_VERIFY_ONLY="${VERIFY_ONLY}"

set +e
LINE_OUTPUT="$(bash "$LINE_SCRIPT" "$AGENT_ID" 2>&1)"
LINE_EXIT=$?
set -e
echo "$LINE_OUTPUT" >&2

if [ "$LINE_EXIT" != "0" ]; then
  emit_result "fail" "$(node -e 'process.stdout.write(JSON.stringify({ line: process.argv[1], profile: process.argv[2], error: process.argv[3].slice(0, 4000) }))' "$LINE_ID" "$PROFILE_ID" "$LINE_OUTPUT")"
  exit "$LINE_EXIT"
fi

STATE_FILE="$ARTIFACT_DIR/state.json"
EXTRA="$(node -e '
const selection = JSON.parse(process.argv[1]);
let state = {};
try { state = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8")); } catch {}
process.stdout.write(JSON.stringify({
  action: process.argv[3] || "apply",
  line: selection.line,
  lineReason: selection.lineReason,
  profile: selection.profile,
  profileReason: selection.profileReason,
  login: selection.login,
  users: selection.users,
  expected: selection.expected,
  statePath: ".har/artifacts/factory-line/state.json",
  appliedAt: state.appliedAt || null,
}));
' "$SELECTION" "$STATE_FILE" "$([ -n "$DRY_RUN" ] && echo dry-run || { [ -n "$VERIFY_ONLY" ] && echo verify || echo apply; })")"

emit_result "pass" "$EXTRA"
exit 0
