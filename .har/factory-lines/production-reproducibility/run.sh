#!/usr/bin/env bash
# Production-reproducibility factory line: apply a seeding profile to the
# shared local Supabase, then assert the domain tables match that profile.
#
# Selected by .har/factory-lines/run.sh (HAR_SEED_PROFILE / HAR_FACTORY_SELECTION).
# WARNING: applying a profile TRUNCATES notes + note_shares for every slot.
set -euo pipefail

LINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$LINE_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
SCRIPT_DIR="$HARNESS_DIR"

# shellcheck source=/dev/null
source "$HARNESS_DIR/harness.env"
# shellcheck source=/dev/null
source "$HARNESS_DIR/agent-slot.sh"

AGENT_ID="${1:?Usage: production-reproducibility/run.sh <agent-id>}"
validate_agent_id "$AGENT_ID"

log() { echo "==> [production-reproducibility agent-$AGENT_ID] $*" >&2; }

har_main_root() {
  local git_common
  git_common="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null || true)"
  if [ -n "$git_common" ]; then
    (cd "$git_common/.." && pwd)
  else
    echo "$REPO_ROOT"
  fi
}

MAIN_HARNESS="$(har_main_root)/.har"
CATALOG="$HARNESS_DIR/factory-lines/lib/catalog.mjs"
ARTIFACT_DIR="${HAR_FACTORY_ARTIFACT_DIR:-$MAIN_HARNESS/artifacts/factory-line}"
mkdir -p "$ARTIFACT_DIR"

if [ -f "$MAIN_HARNESS/state/supabase.env" ]; then
  # shellcheck source=/dev/null
  source "$MAIN_HARNESS/state/supabase.env"
elif [ -f "$HARNESS_DIR/state/supabase.env" ]; then
  # shellcheck source=/dev/null
  source "$HARNESS_DIR/state/supabase.env"
fi

if [ -z "${HAR_FACTORY_SELECTION:-}" ]; then
  HAR_FACTORY_SELECTION="$(node "$CATALOG" select --har-dir "$HARNESS_DIR" \
    ${HAR_FACTORY_LINE:+--line "$HAR_FACTORY_LINE"} \
    ${HAR_SEED_PROFILE:+--profile "$HAR_SEED_PROFILE"} \
    ${HAR_TASK_CONTEXT:+--context "$HAR_TASK_CONTEXT"})"
fi

PROFILE_ID="$(printf '%s' "$HAR_FACTORY_SELECTION" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0,"utf8")).profile)')"
log "Profile: ${PROFILE_ID}"

if [ "${HAR_FACTORY_DRY_RUN:-}" = "1" ]; then
  printf '%s\n' "$HAR_FACTORY_SELECTION" > "$ARTIFACT_DIR/selection.json"
  log "Dry-run — not mutating the shared database."
  exit 0
fi

ensure_user() {
  local email="$1"
  local password="$2"
  : "${SUPABASE_URL:?SUPABASE_URL missing — run ./.har/setup-infra.sh}"
  : "${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY missing}"
  log "Ensuring auth user ${email}"
  curl -sS -o /dev/null -X POST "${SUPABASE_URL}/auth/v1/signup" \
    -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" || true
}

verify_profile() {
  local verify_sql actual verify_json
  verify_sql="$(node "$CATALOG" verify-sql --har-dir "$HARNESS_DIR" --profile "$PROFILE_ID")"
  actual="$(har_pg psql -tA -c "$verify_sql")"
  printf '%s\n' "$actual" > "$ARTIFACT_DIR/actual.json"
  verify_json="$(node "$CATALOG" verify --har-dir "$HARNESS_DIR" --profile "$PROFILE_ID" --actual "$actual")"
  printf '%s\n' "$verify_json" > "$ARTIFACT_DIR/verify.json"
  log "Domain state matches profile ${PROFILE_ID}."
}

if [ "${HAR_FACTORY_VERIFY_ONLY:-}" = "1" ]; then
  verify_profile
  exit 0
fi

log "Applying seeding profile ${PROFILE_ID} (truncates notes + note_shares on the shared DB)."

printf '%s\n' "$HAR_FACTORY_SELECTION" | node -e '
const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
for (const user of d.users) {
  process.stdout.write(user.email + "\t" + user.password + "\n");
}
' | while IFS=$'\t' read -r email password; do
  [ -n "$email" ] || continue
  ensure_user "$email" "$password"
done

SQL="$(node "$CATALOG" sql --har-dir "$HARNESS_DIR" --profile "$PROFILE_ID")"
printf '%s\n' "$SQL" > "$ARTIFACT_DIR/apply.sql"
printf '%s\n' "$SQL" | har_pg psql -v ON_ERROR_STOP=1 >/dev/null

verify_profile

node -e '
const selection = JSON.parse(process.argv[1]);
const out = {
  line: selection.line,
  profile: selection.profile,
  appliedAt: new Date().toISOString(),
  agentId: Number(process.argv[2]),
  login: selection.login,
  users: selection.users,
  expected: selection.expected,
  warning: "This profile replaced notes and note_shares for every agent slot (shared Supabase).",
};
require("fs").writeFileSync(process.argv[3], JSON.stringify(out, null, 2) + "\n");
' "$HAR_FACTORY_SELECTION" "$AGENT_ID" "$ARTIFACT_DIR/state.json"

LOGIN_EMAIL="$(printf '%s' "$HAR_FACTORY_SELECTION" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0,"utf8")).login.email)')"
LOGIN_PASSWORD="$(printf '%s' "$HAR_FACTORY_SELECTION" | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0,"utf8")).login.password)')"
log "Login as ${LOGIN_EMAIL} / ${LOGIN_PASSWORD}"
log "State written to ${ARTIFACT_DIR}/state.json"
exit 0
