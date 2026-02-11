#!/usr/bin/env bash
# Secret scan using gitleaks. Install: https://github.com/gitleaks/gitleaks
# Usage: ./scripts/security/secret-scan.sh
# Exit 0 if no secrets detected; 1 if leaks found.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[secret-scan] gitleaks not found. Install: brew install gitleaks (or see https://github.com/gitleaks/gitleaks)."
  echo "[secret-scan] Skipping secret scan (optional for release gate if gitleaks not installed)."
  exit 0
fi
echo "[secret-scan] Running gitleaks..."
if gitleaks detect --no-git --source . --verbose 2>/dev/null; then
  echo "[secret-scan] No secrets detected. Passed."
  exit 0
fi
echo "[secret-scan] Possible secrets detected. Remove or rotate them and do not commit."
exit 1
