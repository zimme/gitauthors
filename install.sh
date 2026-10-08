#!/bin/sh
# gitauthors install.sh - Native Git hook installation
# Downloads and installs gitauthors hook into Git repository

set -e

# Diagnostics codes (match gitauthors.sh)
ga_git_error() {
  printf 'GA_INSTALL_CONFLICT: %s\n' "$1" >&2
}

# Default GitHub URL
GITHUB_OWNER="zimme"
GITHUB_REPO="gitauthors"
GITHUB_URL="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}"

# Parse arguments
FROM_SOURCE=false
for arg in "$@"; do
  case "$arg" in
    --from-source)
      FROM_SOURCE=true
      ;;
  esac
done

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
  
  # Export variables for use in other functions
  export GIT_TOPEVEL
  export GIT_COMMON_DIR
  export GIT_HOOKS_DIR
  
  printf '%s\n' "$GIT_TOPEVEL"
}

# Check if bare repository
check_bare_repo() {
  if [ "$GIT_TOPEVEL" = "$GIT_COMMON_DIR" ]; then
    ga_git_error "Cannot install in bare repository"
    exit 2
  fi
}

# Check for core.hooksPath configuration
check_hooks_path() {
  HOOKS_PATH=$(git config --get core.hooksPath 2>/dev/null) || true
  if [ -n "$HOOKS_PATH" ]; then
    ga_git_error "core.hooksPath is configured ($HOOKS_PATH). Use Husky/manual integration instead."
    exit 2
  fi
}

# (Metadata directory creation is now inline in main function)

# Cleanup lock on exit
cleanup_lock() {
  if [ -n "$GITAUTHORS_METADIR" ] && [ -d "$GITAUTHORS_METADIR" ]; then
    rmdir "$GITAUTHORS_METADIR" 2>/dev/null || true
  fi
}

trap cleanup_lock EXIT

# Download file with retry
download_file() {
  url="$1"
  dest="$2"
  max_retries=3
  retry=0
  
  while [ $retry -lt $max_retries ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsSL --retry 3 "$url" -o "$dest" 2>/dev/null; then
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q -O "$dest" "$url" 2>/dev/null; then
        return 0
      fi
    fi
    retry=$((retry + 1))
    sleep 1
  done
  
  return 1
}

# Verify SHA256 checksum
verify_checksum() {
  file="$1"
  expected="$2"
  
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$file" | cut -d' ' -f1)
  elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$file" | cut -d' ' -f1)
  else
    ga_git_error "No SHA256 checksum utility found (sha256sum or shasum)"
    return 1
  fi
  
  if [ "$actual" = "$expected" ]; then
    return 0
  fi
  
  ga_git_error "Checksum mismatch for $file: expected $expected, got $actual"
  return 1
}

# Get latest release version
get_latest_version() {
  if [ "$FROM_SOURCE" = true ]; then
    echo "source"
    return 0
  fi
  
  # Get latest release from GitHub
  LATEST_URL="${GITHUB_URL}/releases/latest"
  
  # Download the release page and extract version
  TEMP_FILE=$(mktemp) || {
    ga_git_error "Failed to create temporary file"
    exit 2
  }
  
  if ! download_file "$LATEST_URL" "$TEMP_FILE"; then
    ga_git_error "Failed to download release information from ${LATEST_URL}"
    rm -f "$TEMP_FILE"
    exit 2
  fi
  
  # Extract version from release page
  VERSION=$(grep -oE '/zimme/gitauthors/releases/tag/v[0-9]+\.[0-9]+\.[0-9]+' "$TEMP_FILE" | sed 's|.*/v||' | head -1)
  rm -f "$TEMP_FILE"
  
  if [ -z "$VERSION" ]; then
    ga_git_error "Failed to extract version from release page"
    exit 2
  fi
  
  echo "$VERSION"
  return 0
}

# Main installation logic
main() {
  # Resolve Git metadata
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
  
  cd "$GIT_TOPEVEL"
  
  # Check for bare repository
  check_bare_repo
  
  # Check for core.hooksPath
  check_hooks_path
  
  # Get version
  VERSION=$(get_latest_version) || exit 2
  
  # Create temp directory
  TEMP_DIR=$(mktemp -d) || {
    ga_git_error "Failed to create temporary directory"
    exit 2
  }
  
  trap "rm -rf \"$TEMP_DIR\"" EXIT
  
  if [ "$FROM_SOURCE" = true ]; then
    # Source install - copy directly from this repo's directory
    SCRIPT_DIR=$(dirname "$0")
    SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)
    
    cp "${SCRIPT_DIR}/hooks/gitauthors.sh" "$TEMP_DIR/gitauthors.sh" || {
      ga_git_error "Failed to copy gitauthors.sh from source"
      exit 2
    }
    chmod +x "$TEMP_DIR/gitauthors.sh"
    
    # Copy install and uninstall scripts if they exist
    if [ -f "${SCRIPT_DIR}/install.sh" ]; then
      cp "${SCRIPT_DIR}/install.sh" "$TEMP_DIR/install.sh"
    fi
    if [ -f "${SCRIPT_DIR}/uninstall.sh" ]; then
      cp "${SCRIPT_DIR}/uninstall.sh" "$TEMP_DIR/uninstall.sh"
    fi
    
    # Create dummy SHA256SUMS
    echo "source-install" > "$TEMP_DIR/SHA256SUMS"
  else
    # Download release files
    BASE_URL="${GITHUB_URL}/releases/download/v${VERSION}"
    
    # Download gitauthors.sh
    if ! download_file "${BASE_URL}/gitauthors.sh" "$TEMP_DIR/gitauthors.sh"; then
      ga_git_error "Failed to download gitauthors.sh"
      exit 2
    fi
    chmod +x "$TEMP_DIR/gitauthors.sh"
    
    # Download install.sh and uninstall.sh
    if ! download_file "${BASE_URL}/install.sh" "$TEMP_DIR/install.sh"; then
      ga_git_error "Failed to download install.sh"
      exit 2
    fi
    chmod +x "$TEMP_DIR/install.sh"
    
    if ! download_file "${BASE_URL}/uninstall.sh" "$TEMP_DIR/uninstall.sh"; then
      ga_git_error "Failed to download uninstall.sh"
      exit 2
    fi
    chmod +x "$TEMP_DIR/uninstall.sh"
    
    # Download SHA256SUMS
    if ! download_file "${BASE_URL}/SHA256SUMS" "$TEMP_DIR/SHA256SUMS"; then
      ga_git_error "Failed to download SHA256SUMS"
      exit 2
    fi
    
    # Verify checksums
    if ! verify_checksum "$TEMP_DIR/gitauthors.sh" "$(grep 'gitauthors.sh' "$TEMP_DIR/SHA256SUMS" | cut -d' ' -f1)"; then
      exit 2
    fi
  fi
  
  # Create metadata directory (this acquires the lock)
  GITAUTHORS_METADIR="${GIT_COMMON_DIR}/gitauthors"
  
  # Try to create the directory (atomic operation for locking)
  if ! mkdir "$GITAUTHORS_METADIR" 2>/dev/null; then
    # Directory already exists - check if it's ours
    if [ -f "$GITAUTHORS_METADIR/ownership" ]; then
      CURRENT_OWNER=$(head -1 "$GITAUTHORS_METADIR/ownership" 2>/dev/null || echo "")
      if [ "$CURRENT_OWNER" = "${GITHUB_OWNER}/${GITHUB_REPO}" ]; then
        : # Already owned by us
      else
        ga_git_error "Conflicting installation detected in ${GITAUTHORS_METADIR}"
        exit 2
      fi
    else
      ga_git_error "Conflicting installation detected in ${GITAUTHORS_METADIR}"
      exit 2
    fi
  fi
  
  # Recheck state after locking to ensure nothing changed
  if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
    ga_git_error "Git state changed during installation"
    exit 2
  fi
  
  # Check if .gitauthors exists and is committed
  if ! git cat-file blob 'HEAD:.gitauthors' >/dev/null 2>&1; then
    ga_git_error "No committed .gitauthors policy found. Create and commit a policy before installing."
    exit 2
  fi
  
  # Validate the committed policy using the downloaded validator
  if ! sh "$TEMP_DIR/gitauthors.sh" --validate-policy "$GIT_TOPEVEL/.gitauthors"; then
    ga_git_error "Committed .gitauthors policy is invalid"
    exit 2
  fi
  
  # Stage the downloaded files for metadata
  mkdir -p "$GITAUTHORS_METADIR/releases/${VERSION}" || {
    ga_git_error "Failed to create release directory"
    exit 2
  }
  
  cp "$TEMP_DIR/gitauthors.sh" "$GITAUTHORS_METADIR/releases/${VERSION}/gitauthors.sh"
  cp "$TEMP_DIR/install.sh" "$GITAUTHORS_METADIR/releases/${VERSION}/install.sh"
  cp "$TEMP_DIR/uninstall.sh" "$GITAUTHORS_METADIR/releases/${VERSION}/uninstall.sh"
  
  # Create current.sh symlink (atomic operation)
  CURRENT_SCRIPT="$GITAUTHORS_METADIR/current.sh"
  ln -sf "$GITAUTHORS_METADIR/releases/${VERSION}/gitauthors.sh" "$CURRENT_SCRIPT" || {
    ga_git_error "Failed to create current.sh symlink"
    exit 2
  }
  
  # Check if existing pre-commit hook exists
  PRE_COMMIT_HOOK="$GIT_HOOKS_DIR/pre-commit"
  ORIGINAL_HOOK="$GITAUTHORS_METADIR/original-pre-commit"
  
  if [ -f "$PRE_COMMIT_HOOK" ] || [ -L "$PRE_COMMIT_HOOK" ]; then
    # Check if it's a regular file
    if [ -f "$PRE_COMMIT_HOOK" ] && [ ! -L "$PRE_COMMIT_HOOK" ]; then
      # Save original hook
      cp "$PRE_COMMIT_HOOK" "$ORIGINAL_HOOK" || {
        ga_git_error "Failed to save original pre-commit hook"
        exit 2
      }
      # Preserve executable permission
      if [ -x "$PRE_COMMIT_HOOK" ]; then
        chmod +x "$ORIGINAL_HOOK"
      fi
    elif [ -L "$PRE_COMMIT_HOOK" ]; then
      # It's a symlink - don't preserve symlinks
      ga_git_error "Existing pre-commit is a symlink. Remove it before installation."
      exit 2
    fi
  fi
  
  # Create wrapper script
  WRAPPER_HOOK="$GITAUTHORS_METADIR/installed-pre-commit"
  
  # Create the wrapper script directly
  cat > "$WRAPPER_HOOK" << WRAPPER_EOF
#!/bin/sh
# gitauthors wrapper hook - DO NOT EDIT
set -e
GITAUTHORS_DIR="${GITAUTHORS_METADIR}"
ORIGINAL_HOOK="${ORIGINAL_HOOK}"

# Run gitauthors validation
sh "\$GITAUTHORS_DIR/current.sh" "\$@" || exit \$?

# Run original hook if it existed and was executable
WRAPPER_EOF
  
  # Add original hook call if needed
  if [ -f "$ORIGINAL_HOOK" ] && [ -x "$ORIGINAL_HOOK" ]; then
    echo "sh \"\$ORIGINAL_HOOK\" \"\$@\" || exit \$?" >> "$WRAPPER_HOOK"
  fi
  
  chmod +x "$WRAPPER_HOOK"
  
  # Install the wrapper as the actual pre-commit hook (atomic operation)
  ln -sf "$WRAPPER_HOOK" "$PRE_COMMIT_HOOK" || {
    ga_git_error "Failed to install pre-commit hook"
    exit 2
  }
  
  # Record ownership
  echo "${GITHUB_OWNER}/${GITHUB_REPO}" > "$GITAUTHORS_METADIR/ownership"
  echo "${VERSION}" > "$GITAUTHORS_METADIR/version"
  
  # Save generated wrapper for uninstall comparison
  # Note: WRAPPER_HOOK and GITAUTHORS_METADIR/installed-pre-commit are the same file
  # so we just need to ensure it's properly written
  
  printf 'gitauthors installed successfully\n'
  printf 'Version: %s\n' "$VERSION"
  printf 'Hook: %s\n' "$PRE_COMMIT_HOOK"
}

# Run main
main "$@"