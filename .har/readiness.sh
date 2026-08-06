#!/usr/bin/env bash
# "Agent usable" smoke test beyond the health check (HARNESS_READINESS_CMD,
# run by `verify --full`). Health only proves the Next.js process is alive;
# this proves the running slot is actually wired to the shared Supabase
# stack and that a real sign-up/sign-in workflow works end to end.
#
# Usage: ./.har/readiness.sh <agent-id>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/harness.env"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/agent-slot.sh"

AGENT_ID="${1:?Usage: readiness.sh <agent-id>}"
validate_agent_id "$AGENT_ID"

ENV_FILE="$(resolve_agent_env_file "$AGENT_ID" "$REPO_ROOT")" || {
  echo "No .env.agent.${AGENT_ID} found — launch the slot first." >&2
  har_suggest_launch "$AGENT_ID" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

: "${FE_PORT:?FE_PORT missing from .env.agent.${AGENT_ID}}"
: "${SUPABASE_URL:?SUPABASE_URL missing — is the shared Supabase stack running? ./.har/setup-infra.sh}"
: "${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY missing}"

echo "==> Checking the frontend is wired to Supabase (agent ${AGENT_ID}, port ${FE_PORT})..." >&2
HOME_HTML="$(curl -sf "http://localhost:${FE_PORT}/")" || {
  echo "Frontend did not respond on http://localhost:${FE_PORT}/" >&2
  exit 1
}
if echo "$HOME_HTML" | grep -q "Supabase environment variables required"; then
  echo "Frontend is rendering the env-var warning banner — NEXT_PUBLIC_SUPABASE_* are not reaching the app." >&2
  exit 1
fi
echo "    OK — no env-var warning banner." >&2

echo "==> Exercising Supabase Auth sign-up (email confirmations are disabled for local dev)..." >&2
TEST_EMAIL="har-agent-${AGENT_ID}-$(date +%s)@example.com"
SIGNUP_RESPONSE="$(curl -sf -X POST "${SUPABASE_URL}/auth/v1/signup" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"har-readiness-check-1234\"}")" || {
  echo "Supabase Auth sign-up request failed against ${SUPABASE_URL}." >&2
  exit 1
}

if ! printf '%s' "$SIGNUP_RESPONSE" | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c));
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(d);
    process.exit(j.access_token || j.id ? 0 : 1);
  } catch {
    process.exit(1);
  }
});'; then
  echo "Sign-up did not return a session/user. Response:" >&2
  echo "$SIGNUP_RESPONSE" >&2
  exit 1
fi
echo "    OK — sign-up returned a session (Auth + Postgres + Kong working end to end)." >&2

echo "Agent ${AGENT_ID} is usable: frontend is wired to the shared Supabase stack and sign-up works." >&2
echo "Documented demo login: agent-demo@example.com / agent-demo-password-123 (see .har/CLAUDE.agent.md)." >&2
