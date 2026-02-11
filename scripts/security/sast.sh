#!/usr/bin/env bash
# SAST using semgrep. Install: pip install semgrep or brew install semgrep
# Usage: ./scripts/security/sast.sh
# Exit 0 if no findings at or above configured severity; 1 otherwise.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"
SEMGREP_SEVERITY="${SEMGREP_SEVERITY:-ERROR}"
if ! command -v semgrep >/dev/null 2>&1; then
  echo "[sast] semgrep not found. Install: pip install semgrep or brew install semgrep."
  echo "[sast] Skipping SAST (optional for release gate if semgrep not installed)."
  exit 0
fi
echo "[sast] Running semgrep (severity >= $SEMGREP_SEVERITY)..."
if semgrep scan --config=auto --severity="$SEMGREP_SEVERITY" --error --quiet . 2>/dev/null; then
  echo "[sast] No findings at or above $SEMGREP_SEVERITY. Passed."
  exit 0
fi
echo "[sast] Findings detected. Fix or suppress before release."
exit 1
