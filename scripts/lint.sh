#!/bin/sh
# Lint script for gitauthors
# Runs ShellCheck on shell files and other linting as needed

set -e

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

echo "Running ShellCheck..."

# Files to lint with ShellCheck
SHELL_FILES=(
  "hooks/gitauthors.sh"
  "install.sh"
  "uninstall.sh"
)

for file in "${SHELL_FILES[@]}"; do
  if [ -f "$file" ]; then
    if command -v shellcheck >/dev/null 2>&1; then
      shellcheck "$file" || {
        echo "ShellCheck failed for $file"
        exit 1
      }
    else
      echo "ShellCheck not found, skipping linting for $file"
    fi
  fi
done

echo "ShellCheck completed"

# Additional linting could be added here
# For now, we'll keep it simple

echo "Linting completed successfully"