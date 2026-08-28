#!/usr/bin/env bash
# Validate factory-line registry + seeding profiles (no database writes).
# Outputs JSON to stdout, progress to stderr.
#
# Usage: ./.har/stages/factory-line-catalog.sh <agent-id>
set -euo pipefail

STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$STAGE_DIR/.." && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
SCRIPT_DIR="$HARNESS_DIR"

# shellcheck source=/dev/null
source "$HARNESS_DIR/harness.env"
# shellcheck source=/dev/null
source "$HARNESS_DIR/agent-slot.sh"

AGENT_ID="${1:?Usage: factory-line-catalog.sh <agent-id>}"
validate_agent_id "$AGENT_ID"

log() { echo "==> [factory-line-catalog agent-$AGENT_ID] $*" >&2; }

ENV_FILE="$(resolve_agent_env_file "$AGENT_ID" "$REPO_ROOT" || true)"
WORK_DIR="$HARNESS_DIR/.."
if [ -n "${ENV_FILE:-}" ] && [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  WORK_DIR="$(resolve_agent_work_dir "$ENV_FILE")"
fi

CATALOG_HAR="$WORK_DIR/.har"
if [ ! -f "$CATALOG_HAR/factory-lines.json" ]; then
  CATALOG_HAR="$HARNESS_DIR"
fi

MAIN_ROOT="$REPO_ROOT"
git_common="$(git_common_dir "$REPO_ROOT" || true)"
if [ -n "$git_common" ]; then
  MAIN_ROOT="$(cd "$git_common/.." && pwd)"
fi
ARTIFACT_DIR="$MAIN_ROOT/.har/artifacts/factory-line-catalog"
mkdir -p "$ARTIFACT_DIR"

log "Checking factory-line catalog in $CATALOG_HAR"
START_TOTAL=$(now_ms)

set +e
CHECK_OUTPUT="$(node "$CATALOG_HAR/factory-lines/lib/catalog.mjs" check --har-dir "$CATALOG_HAR" --self-test 2>&1)"
CHECK_EXIT=$?
set -e

echo "$CHECK_OUTPUT" >&2
printf '%s\n' "$CHECK_OUTPUT" > "$ARTIFACT_DIR/catalog.json"

END_TOTAL=$(now_ms)
TOTAL_MS=$(( END_TOTAL - START_TOTAL ))

node -e "
const out = {
  status: ${CHECK_EXIT} === 0 ? 'pass' : 'fail',
  stageId: 'factory-line-catalog',
  kind: 'test',
  agent_id: ${AGENT_ID},
  total_ms: ${TOTAL_MS},
  artifacts: [{ path: '.har/artifacts/factory-line-catalog', kind: 'directory' }],
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
"

exit "$CHECK_EXIT"
