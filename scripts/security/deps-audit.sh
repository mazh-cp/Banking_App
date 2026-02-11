#!/usr/bin/env bash
# Dependency audit: run pnpm audit (and optionally allow configurable fail level).
# Usage: ./scripts/security/deps-audit.sh [--audit-level=high]
# Exit 0 if no vulnerabilities at or above audit-level; 1 otherwise.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"
AUDIT_LEVEL="${AUDIT_LEVEL:-high}"
for arg in "$@"; do
  if [[ "$arg" == --audit-level=* ]]; then
    AUDIT_LEVEL="${arg#*=}"
  fi
done
echo "[deps-audit] Running pnpm audit (level=$AUDIT_LEVEL)..."
if pnpm audit --audit-level="$AUDIT_LEVEL" 2>/dev/null; then
  echo "[deps-audit] Passed."
  exit 0
fi
echo "[deps-audit] Vulnerabilities at or above $AUDIT_LEVEL found. Fix with: pnpm audit; pnpm update (or pnpm add package@version)."
exit 1
