#!/bin/sh
# Lint script for gitauthors
# Runs ShellCheck on shell files and other linting as needed

set -e

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

echo "Running ShellCheck..."

SHELL_FILES="hooks/gitauthors.sh install.sh uninstall.sh"

for file in $SHELL_FILES; do
  if [ -f "$file" ]; then
    if command -v shellcheck >/dev/null 2>&1; then
      shellcheck -S error "$file" || {
        echo "ShellCheck failed for $file"
        exit 1
      }
    else
      echo "ShellCheck not found, skipping linting for $file"
    fi
  fi
done

echo "ShellCheck completed"
echo "Linting completed successfully"
