#!/usr/bin/env bash
# Apply (or list/dry-run/verify) a HAR factory line for this slot.
# Outputs JSON to stdout, progress to stderr. See .har/factory-lines/README.md.
#
# Usage: ./.har/stages/factory-line.sh <agent-id> [--line ID] [--profile ID] [--context TEXT]
#        ./.har/stages/factory-line.sh <agent-id> --list
set -euo pipefail

STAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$STAGE_DIR/.." && pwd)"
SCRIPT_DIR="$HARNESS_DIR"

exec "$HARNESS_DIR/factory-lines/run.sh" "$@"
