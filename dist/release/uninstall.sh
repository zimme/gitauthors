#!/bin/sh
# gitauthors uninstall.sh - Native Git hook uninstallation
# Removes gitauthors hook and restores original pre-commit if it existed

set -e

# Diagnostics codes
ga_git_error() {
  printf 'GA_INSTALL_CONFLICT: %s\n' "$1" >&2
}

# Default GitHub URL
GITHUB_OWNER="zimme"
GITHUB_REPO="gitauthors"

# Ensure we're running in a Git repository
resolve_git_metadata() {
  GIT_TOPEVEL=$(git rev-parse --path-format=absolute --show-toplevel 2>/dev/null) || {
    printf 'GA_GIT_ERROR: Not a git repository or git not available\n' >&2
    exit 2
  }
  
  GIT_COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || {
    printf 'GA_GIT_ERROR: Failed to get git common directory\n' >&2
    exit 2
  }
  
  GIT_HOOKS_DIR=$(git rev-parse --path-format=absolute --git-path hooks 2>/dev/null) || {
    printf 'GA_GIT_ERROR: Failed to get git hooks directory\n' >&2
    exit 2
  }
  
  printf '%s\n' "$GIT_TOPEVEL"
}

# Check if gitauthors is installed
check_gitauthors_installed() {
  GITAUTHORS_METADIR="${GIT_COMMON_DIR}/gitauthors"
  
  if [ ! -d "$GITAUTHORS_METADIR" ]; then
    printf 'gitauthors is not installed\n' >&2
    exit 0
  fi
  
  if [ ! -f "$GITAUTHORS_METADIR/ownership" ]; then
    ga_git_error "gitauthors metadata directory exists but no ownership file found"
    exit 2
  fi
  
  CURRENT_OWNER=$(head -1 "$GITAUTHORS_METADIR/ownership" 2>/dev/null || echo "")
  if [ "$CURRENT_OWNER" != "${GITHUB_OWNER}/${GITHUB_REPO}" ]; then
    ga_git_error "gitauthors installation found but owned by different package: $CURRENT_OWNER"
    exit 2
  fi
  
  printf '%s\n' "$GITAUTHORS_METADIR"
}

# Check if hook has been edited
check_hook_edited() {
  local metadir="$1"
  local pre_commit_hook="$GIT_HOOKS_DIR/pre-commit"
  local installed_hook="$metadir/installed-pre-commit"
  
  # Check if hook exists and is a symlink
  if [ ! -L "$pre_commit_hook" ]; then
    ga_git_error "pre-commit hook is not a symlink"
    exit 2
  fi
  
  # Check if it points to our wrapper
  HOOK_TARGET=$(readlink "$pre_commit_hook")
  if [ "$HOOK_TARGET" != "$installed_hook" ]; then
    ga_git_error "pre-commit hook points to unexpected target: $HOOK_TARGET"
    exit 2
  fi
  
  # Check if the wrapper has been modified
  if ! diff -q "$installed_hook" "$pre_commit_hook" >/dev/null 2>&1; then
    ga_git_error "pre-commit hook wrapper has been modified"
    exit 2
  fi
}

# Main uninstallation logic
main() {
  # Resolve Git metadata
  GIT_TOPEVEL=$(resolve_git_metadata) || exit 2
  cd "$GIT_TOPEVEL"
  
  # Check if gitauthors is installed
  GITAUTHORS_METADIR=$(check_gitauthors_installed) || exit 2
  
  # Check if hook has been edited
  check_hook_edited "$GITAUTHORS_METADIR" || exit 2
  
  # Get the pre-commit hook path
  PRE_COMMIT_HOOK="$GIT_HOOKS_DIR/pre-commit"
  
  # Restore original hook if it exists
  ORIGINAL_HOOK="$GITAUTHORS_METADIR/original-pre-commit"
  if [ -f "$ORIGINAL_HOOK" ]; then
    # Remove the current symlink first
    rm -f "$PRE_COMMIT_HOOK" || {
      ga_git_error "Failed to remove current pre-commit hook"
      exit 2
    }
    
    # Restore original hook
    cp "$ORIGINAL_HOOK" "$PRE_COMMIT_HOOK" || {
      ga_git_error "Failed to restore original pre-commit hook"
      exit 2
    }
    
    # Restore executable permission if original was executable
    if [ -x "$ORIGINAL_HOOK" ]; then
      chmod +x "$PRE_COMMIT_HOOK"
    fi
    
    printf 'Restored original pre-commit hook\n'
  else
    # No original hook - just remove ours
    rm -f "$PRE_COMMIT_HOOK" || {
      ga_git_error "Failed to remove pre-commit hook"
      exit 2
    }
    printf 'Removed pre-commit hook\n'
  fi
  
  # Remove all owned files from metadata directory
  rm -f "$GITAUTHORS_METADIR/original-pre-commit"
  rm -f "$GITAUTHORS_METADIR/installed-pre-commit"
  rm -f "$GITAUTHORS_METADIR/ownership"
  rm -f "$GITAUTHORS_METADIR/version"
  rm -f "$GITAUTHORS_METADIR/current.sh"
  
  # Remove all release directories
  if [ -d "$GITAUTHORS_METADIR/releases" ]; then
    rm -rf "$GITAUTHORS_METADIR/releases"
  fi
  
  # Remove metadata directory if empty
  rmdir "$GITAUTHORS_METADIR" 2>/dev/null || true
  
  printf 'gitauthors uninstalled successfully\n'
}

# Run main
main "$@"