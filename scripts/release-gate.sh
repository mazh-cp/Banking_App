#!/usr/bin/env bash
# Release gate: run lint, build, tests, and AppSec checks. Do not push to remote.
# Usage: ./scripts/release-gate.sh [--skip-appsec]
# Exit 0 only if all steps pass.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"
export CI=true
SKIP_APPSEC=false
for arg in "$@"; do
  if [[ "$arg" == --skip-appsec ]]; then SKIP_APPSEC=true; fi
done
FAILED=0
run() { if ! "$@"; then FAILED=1; fi; }

echo "========== Release gate: lint =========="
run pnpm run lint

echo "========== Release gate: build =========="
run pnpm run build

echo "========== Release gate: unit/integration tests =========="
run pnpm run test:unit
if [ $FAILED -eq 1 ]; then
  echo "Release gate failed at lint/build/tests."
  exit 1
fi

if [ "$SKIP_APPSEC" = true ]; then
  echo "========== Release gate: AppSec skipped =========="
  echo "Release gate passed (AppSec skipped)."
  exit 0
fi

echo "========== Release gate: dependency audit =========="
run "$SCRIPT_DIR/security/deps-audit.sh"

echo "========== Release gate: secret scan =========="
run "$SCRIPT_DIR/security/secret-scan.sh"

echo "========== Release gate: SAST =========="
run "$SCRIPT_DIR/security/sast.sh"

if [ $FAILED -eq 1 ]; then
  echo "Release gate failed (see AppSec steps above)."
  exit 1
fi
echo "Release gate passed."
exit 0
