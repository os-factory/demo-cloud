#!/usr/bin/env bash
# Playwright browser/API/a11y tests for an agent slot.
# Outputs JSON to stdout, human-readable progress to stderr.
#
# Usage: ./.har/stages/browser-e2e.sh <agent-id>
# Prerequisite: ./.har/launch.sh <agent-id>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
# agent-slot.sh expects SCRIPT_DIR to be .har/ (slot registry lives there)
SCRIPT_DIR="$HARNESS_DIR"

# shellcheck source=/dev/null
source "$HARNESS_DIR/harness.env"
# shellcheck source=/dev/null
source "$HARNESS_DIR/agent-slot.sh"

AGENT_ID="${1:?Usage: browser-e2e.sh <agent-id>}"
validate_agent_id "$AGENT_ID"

log() { echo "==> [browser-e2e agent-$AGENT_ID] $*" >&2; }

ENV_FILE="$(resolve_agent_env_file "$AGENT_ID" "$REPO_ROOT")" || {
  echo "No .env.agent.${AGENT_ID} found." >&2
  har_suggest_launch "$AGENT_ID" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

WORK_DIR="$(resolve_agent_work_dir "$ENV_FILE")"
FE_PORT="${FE_PORT:-$(( HARNESS_FE_BASE_PORT + AGENT_ID * HARNESS_PORT_STEP ))}"
API_PORT="${API_PORT:-$(( HARNESS_API_BASE_PORT + AGENT_ID * HARNESS_PORT_STEP ))}"

export BASE_URL="${BASE_URL:-http://localhost:${FE_PORT}}"
export API_URL="${API_URL:-http://localhost:${API_PORT}}"
export HARNESS_HEALTH_PATH="${HARNESS_HEALTH_CHECK_PATH:-/api/health}"
export HARNESS_HEALTH_CHECK_PATH="${HARNESS_HEALTH_CHECK_PATH:-/api/health}"

MAIN_ROOT="$REPO_ROOT"
git_common="$(git_common_dir "$REPO_ROOT" || true)"
if [ -n "$git_common" ]; then
  MAIN_ROOT="$(cd "$git_common/.." && pwd)"
fi

export PW_ARTIFACT_DIR="${PW_ARTIFACT_DIR:-$MAIN_ROOT/.har/artifacts/browser-e2e}"
export PW_HANDOFF_DIR="${PW_HANDOFF_DIR:-$PW_ARTIFACT_DIR/handoff}"
mkdir -p "$PW_ARTIFACT_DIR" "$PW_HANDOFF_DIR"

log "Running Playwright against $BASE_URL (API: $API_URL)"
log "Work dir: $WORK_DIR"
log "Handoff screenshots: $PW_HANDOFF_DIR"

START_TOTAL=$(now_ms)

set +e
cd "$WORK_DIR"
log "Ensuring Playwright Chromium is installed..."
npx playwright install chromium >&2
PW_OUTPUT=$(npx playwright test 2>&1)
PW_EXIT=$?
set -e

END_TOTAL=$(now_ms)
TOTAL_MS=$(( END_TOTAL - START_TOTAL ))

echo "$PW_OUTPUT" >&2

REPORT_INDEX="$PW_ARTIFACT_DIR/playwright-report/index.html"
HANDOFF_DIR="$PW_HANDOFF_DIR"

node -e "
const fs = require('fs');
const path = require('path');
const handoffDir = process.env.PW_HANDOFF_DIR || '${HANDOFF_DIR}';
const shots = fs.existsSync(handoffDir)
  ? fs.readdirSync(handoffDir).filter((f) => f.endsWith('.png')).sort()
  : [];
const out = {
  status: ${PW_EXIT} === 0 ? 'pass' : 'fail',
  stageId: 'browser-e2e',
  kind: 'test',
  agent_id: ${AGENT_ID},
  total_ms: ${TOTAL_MS},
  urls: [
    { label: 'frontend', url: process.env.BASE_URL || '${BASE_URL}' },
    { label: 'api', url: process.env.API_URL || '${API_URL}' },
  ],
  artifacts: [
    { path: '.har/artifacts/browser-e2e', kind: 'directory' },
    { path: '.har/artifacts/browser-e2e/handoff', kind: 'directory', description: 'Named screenshots for session handoff' },
  ],
  handoffScreenshots: shots.map((file) => path.join('.har/artifacts/browser-e2e/handoff', file)),
};
if (fs.existsSync('${REPORT_INDEX}')) {
  out.artifacts.push({ path: '.har/artifacts/browser-e2e/playwright-report', kind: 'report' });
}
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
"

exit "$PW_EXIT"
