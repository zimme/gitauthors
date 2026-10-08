#!/bin/sh
# Setup native tools for development
# Installs ShellCheck, shfmt, Bats, actionlint via package managers

set -eu

# Tool installation directory (ignored by git)
TOOLS_DIR=".tools"
BIN_DIR=".tools/bin"

mkdir -p "$BIN_DIR"

echo "Setting up development tools..."

# Detect platform
PLATFORM="unknown"
case "$(uname -s)" in
  Linux*)   PLATFORM="linux" ;;
  Darwin*)  PLATFORM="macos" ;;
  *)        PLATFORM="unknown" ;;
esac

# Function to download and install a tool
download_tool() {
  name="$1"
  url="$2"
  dest="$TOOLS_DIR/$name"
  
  echo "Installing $name..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$dest"
  else
    echo "GA_GIT_ERROR: Neither curl nor wget available to download $name"
    exit 2
  fi
  
  chmod +x "$dest"
  ln -sf "$dest" "$BIN_DIR/$name"
  echo "Installed $name to $BIN_DIR/$name"
}

# Install ShellCheck (static binary)
if ! command -v shellcheck >/dev/null 2>&1; then
  if [ "$PLATFORM" = "linux" ]; then
    download_tool "shellcheck" "https://github.com/koalaman/shellcheck/releases/download/v0.11.0/shellcheck-v0.11.0.linux.x86_64.tar.xz"
    # Extract and install
    tar -xf "$TOOLS_DIR/shellcheck" -C "$TOOLS_DIR" && \
    ln -sf "$TOOLS_DIR/shellcheck-v0.11.0/shellcheck" "$BIN_DIR/shellcheck"
  elif [ "$PLATFORM" = "macos" ]; then
    download_tool "shellcheck" "https://github.com/koalaman/shellcheck/releases/download/v0.11.0/shellcheck-v0.11.0.darwin.x86_64.tar.xz"
    tar -xf "$TOOLS_DIR/shellcheck" -C "$TOOLS_DIR" && \
    ln -sf "$TOOLS_DIR/shellcheck-v0.11.0/shellcheck" "$BIN_DIR/shellcheck"
  else
    echo "ShellCheck: Platform $PLATFORM not supported for automatic install"
    echo "Please install ShellCheck manually"
  fi
else
  echo "ShellCheck already available in PATH"
fi

# Install shfmt (static binary)
if ! command -v shfmt >/dev/null 2>&1; then
  if [ "$PLATFORM" = "linux" ]; then
    download_tool "shfmt" "https://github.com/mvdan/sh/releases/download/v3.14.1/shfmt_v3.14.1_linux_amd64"
  elif [ "$PLATFORM" = "macos" ]; then
    download_tool "shfmt" "https://github.com/mvdan/sh/releases/download/v3.14.1/shfmt_v3.14.1_darwin_amd64"
  else
    echo "shfmt: Platform $PLATFORM not supported for automatic install"
    echo "Please install shfmt manually"
  fi
else
  echo "shfmt already available in PATH"
fi

# Install Bats (via npm or git)
# Note: In CI, we may not have permission for global install, so we install locally
if ! command -v bats >/dev/null 2>&1; then
  echo "Installing Bats..."
  if command -v npm >/dev/null 2>&1; then
    # Install locally to .tools directory
    mkdir -p "$TOOLS_DIR"
    npm install --prefix "$TOOLS_DIR" bats@1.14.0
    ln -sf "$TOOLS_DIR/bin/bats" "$BIN_DIR/bats"
  else
    echo "Bats: npm required to install"
  fi
else
  echo "Bats already available in PATH"
fi

# Install actionlint (static binary)
if ! command -v actionlint >/dev/null 2>&1; then
  if [ "$PLATFORM" = "linux" ]; then
    download_tool "actionlint" "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz"
    tar -xf "$TOOLS_DIR/actionlint" -C "$TOOLS_DIR" && \
    ln -sf "$TOOLS_DIR/actionlint_1.7.12/actionlint" "$BIN_DIR/actionlint"
  elif [ "$PLATFORM" = "macos" ]; then
    download_tool "actionlint" "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_darwin_amd64.tar.gz"
    tar -xf "$TOOLS_DIR/actionlint" -C "$TOOLS_DIR" && \
    ln -sf "$TOOLS_DIR/actionlint_1.7.12/actionlint" "$BIN_DIR/actionlint"
  else
    echo "actionlint: Platform $PLATFORM not supported for automatic install"
    echo "Please install actionlint manually"
  fi
else
  echo "actionlint already available in PATH"
fi

echo "Tools setup complete"
echo "Tools directory: $TOOLS_DIR"
echo "Binary directory: $BIN_DIR"

# Add tools to PATH for current session
export PATH="$BIN_DIR:$PATH"
