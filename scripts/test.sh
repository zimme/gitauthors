#!/bin/bash
set -e
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"
echo "Running unit tests..."
if ! command -v bats >/dev/null 2>&1; then
  echo "Bats not found, skipping unit tests"
  exit 0
fi
if [ ! -f "test/unit/gitauthors.bats" ]; then
  echo "No unit test file found, skipping"
  exit 0
fi
bats test/unit/ || {
  echo "Unit tests failed"
  exit 1
}
echo "Unit tests completed"
