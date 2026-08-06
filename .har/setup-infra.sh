#!/usr/bin/env bash
# Starts the shared local Supabase stack for all agent slots — Postgres,
# Auth (GoTrue), PostgREST, Kong, Studio and Mailpit, managed by the Supabase
# CLI from supabase/config.toml (repo root, committed). ONE instance serves
# every agent slot on fixed ports; there is no per-slot Supabase project.
# Idempotent — safe to run multiple times.
#
# Usage: ./.har/setup-infra.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_FILE="$SCRIPT_DIR/state/supabase.env"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/harness.env"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/agent-slot.sh"

log() { echo "==> $*" >&2; }

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker is required — the Supabase CLI runs Postgres/Auth/REST/Studio/Mailpit as containers." >&2
  exit 1
fi

SUPABASE_BIN="$REPO_ROOT/node_modules/.bin/supabase"
if [ ! -x "$SUPABASE_BIN" ]; then
  SUPABASE_BIN="npx --yes supabase"
fi

cd "$REPO_ROOT"

if [ ! -f "$REPO_ROOT/supabase/config.toml" ]; then
  log "No supabase/config.toml found — running 'supabase init'..."
  $SUPABASE_BIN init --yes
fi

if $SUPABASE_BIN status >/dev/null 2>&1; then
  log "Local Supabase stack is already running."
else
  log "Starting local Supabase stack (Postgres, Auth, REST, Studio, Mailpit)..."
  log "First run pulls several Docker images — this can take a few minutes."
  $SUPABASE_BIN start
fi

log "Reading resolved URLs/keys from 'supabase status'..."
STATUS_JSON="$($SUPABASE_BIN status --output json)"

mkdir -p "$(dirname "$STATE_FILE")"
STATUS_JSON="$STATUS_JSON" STATE_FILE="$STATE_FILE" node -e '
const data = JSON.parse(process.env.STATUS_JSON);
const line = (key, value) => `export ${key}=${JSON.stringify(value || "")}`;
const lines = [
  "# Persisted by setup-infra.sh — resolved from `supabase status --output json`.",
  "# ONE shared local Supabase stack serves every agent slot (see supabase/config.toml).",
  line("SUPABASE_URL", data.API_URL),
  line("SUPABASE_DB_URL", data.DB_URL),
  line("SUPABASE_STUDIO_URL", data.STUDIO_URL),
  line("SUPABASE_MAILPIT_URL", data.MAILPIT_URL || data.INBUCKET_URL),
  line("SUPABASE_PUBLISHABLE_KEY", data.PUBLISHABLE_KEY),
  line("SUPABASE_SECRET_KEY", data.SECRET_KEY),
  line("SUPABASE_ANON_KEY", data.ANON_KEY),
  line("SUPABASE_SERVICE_ROLE_KEY", data.SERVICE_ROLE_KEY),
  line("SUPABASE_JWT_SECRET", data.JWT_SECRET),
];
require("fs").writeFileSync(process.env.STATE_FILE, lines.join("\n") + "\n");
'

# shellcheck source=/dev/null
source "$STATE_FILE"

# Minimal bootstrap: an idempotent demo login so agents have a documented,
# working credential without having to sign up through the UI first. This
# app has no custom tables/tenants to seed — Supabase Auth is the only store.
DEMO_EMAIL="agent-demo@example.com"
DEMO_PASSWORD="agent-demo-password-123"
log "Ensuring demo login exists (${DEMO_EMAIL} / ${DEMO_PASSWORD})..."
curl -s -o /dev/null -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DEMO_EMAIL}\",\"password\":\"${DEMO_PASSWORD}\"}" || true

echo "" >&2
log "Local Supabase is ready — shared by every agent slot:"
log "  API:      ${SUPABASE_URL}"
log "  Studio:   ${SUPABASE_STUDIO_URL}"
log "  Mailpit:  ${SUPABASE_MAILPIT_URL}  (catches confirmation/reset emails)"
log "  Database: ${SUPABASE_DB_URL}"
log "  Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}"
exit 0
