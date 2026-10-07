# Installation Guide

This document covers all installation methods for gitauthors.

## Quick Start

The simplest way to get started:

```bash
# Create your policy
echo "@yourcompany.com" > .gitauthors
git add .gitauthors
git commit -m "chore: Add gitauthors policy"

# Install the hook
curl -fsSL https://github.com/zimme/gitauthors/releases/latest/download/install.sh | sh
```

## Installation Methods

### 1. Native Git Hook Installation

**Requirements**: Git, curl or wget, standard Unix tools

#### Latest Release (Recommended)

```bash
curl -fsSL https://github.com/zimme/gitauthors/releases/latest/download/install.sh | sh
```

#### Specific Version

```bash
VERSION=1.0.0-rc.1
curl -fsSL https://github.com/zimme/gitauthors/releases/download/v${VERSION}/install.sh | sh
```

#### Source Installation (Development)

```bash
# Clone the repository
git clone https://github.com/zimme/gitauthors.git
cd gitauthors

# Install from source
sh install.sh --from-source
```

### 2. npm Package Integration

**Requirements**: Node.js >= 24.13.1, npm >= 11.19.0

#### Installation

```bash
npm install --save-dev @zimme/gitauthors
```

#### Manual Hook Setup

Add to your existing `.husky/pre-commit`:

```bash
#!/bin/sh
sh ./node_modules/@zimme/gitauthors/hooks/gitauthors.sh || exit $?

# Your existing checks here...
```

Make sure the hook is executable:

```bash
chmod +x .husky/pre-commit
```

#### Husky Automatic Setup

If using Husky 9+, add to your `package.json`:

```json
{
  "scripts": {
    "prepare": "husky install && node .husky/install.mjs"
  }
}
```

### 3. JSR Integration

**Requirements**: Node.js or Deno, npm or JSR-compatible package manager

#### Installation

```bash
npx jsr add @zimme/gitauthors
```

#### Usage

Create `scripts/check-gitauthors.mjs`:

```javascript
import { runHook } from "@zimme/gitauthors";
process.exitCode = runHook();
```

Add to your hook:

```bash
#!/bin/sh
node scripts/check-gitauthors.mjs || exit $?
```

## Post-Installation

### Verify Installation

```bash
# Check if hook is installed
ls -la .git/hooks/pre-commit

# Test the hook with a valid commit
echo "test" > test.txt
git add test.txt
git commit -m "test: add test file"

# Test with invalid author
git config user.email "invalid@example.com"
git commit -m "test: should fail"
```

### Configure Policy

Edit `.gitauthors` with your approved emails and domains:

```text
# Employees
@yourcompany.com

# Specific external contributors
consultant@external.com

# Automation
noreply@github.com
bot@yourcompany.com
```

Commit the changes:

```bash
git add .gitauthors
git commit -m "chore: Update gitauthors policy"
```

## Troubleshooting

### Installation Failed: "No committed .gitauthors policy found"

**Solution**: Create and commit a `.gitauthors` file before installing.

```bash
echo "@yourcompany.com" > .gitauthors
git add .gitauthors
git commit -m "chore: Add gitauthors policy"
```

### Installation Failed: "core.hooksPath is configured"

**Solution**: Either:
1. Remove the `core.hooksPath` configuration: `git config --unset core.hooksPath`
2. Use manual integration: Add gitauthors to your existing hook in the custom path

### Installation Failed: "Existing pre-commit is a symlink"

**Solution**: Remove the symlink and reinstall:

```bash
rm .git/hooks/pre-commit
sh install.sh --from-source
```

### Hook Not Running

**Check**:
- The hook file exists: `ls -la .git/hooks/pre-commit`
- The hook is executable: `test -x .git/hooks/pre-commit`
- Git hooks are enabled: `git config core.hooksPath` (should be empty)

### GA_IDENTITY_DENIED Errors

**Solution**: Add your email to the `.gitauthors` policy and commit:

```bash
echo "your@email.com" >> .gitauthors
git add .gitauthors
git commit -m "chore: Add my email to policy"
```

## Uninstallation

### Native Installation

```bash
sh uninstall.sh
```

### npm Integration

```bash
npm uninstall @zimme/gitauthors
# Remove from your pre-commit hook
```

### Manual Cleanup

```bash
rm .git/hooks/pre-commit
rm -rf .git/gitauthors
```

## Upgrading

### From Previous Version

```bash
# Uninstall current version
sh uninstall.sh

# Install new version
curl -fsSL https://github.com/zimme/gitauthors/releases/latest/download/install.sh | sh
```

### No Downtime Upgrade

The installation process:
1. Downloads new files to temporary directory
2. Validates the new version against your policy
3. Atomically switches to new version
4. Preserves your existing configuration

## Worktree Support

gitauthors works with Git worktrees. The installation:

1. Uses the shared Git metadata directory (`$GIT_COMMON_DIR`)
2. Creates metadata in `$GIT_COMMON_DIR/gitauthors`
3. Installs hooks in each worktree's `.git/hooks/` directory
4. All worktrees share the same installation and versions

## Custom Hook Path

If you have `core.hooksPath` configured, gitauthors cannot automatically install:

```bash
# Check current setting
git config --get core.hooksPath

# Temporarily disable for installation
git config --unset core.hooksPath
sh install.sh --from-source
git config core.hooksPath your-custom-path

# Manual integration required
cp hooks/gitauthors.sh your-custom-path/gitauthors.sh
```

## Configuration

gitauthors has no runtime configuration. All behavior is determined by:

1. **Policy file** (`.gitauthors`): Defines approved identities
2. **Git configuration**: Standard Git settings
3. **Environment**: No special environment variables needed

### Git Configuration Settings

| Setting | Effect |
|---------|--------|
| `user.name` | Used in commit metadata |
| `user.email` | Used in commit metadata (validated against policy) |
| `commit.gpgSign` | Works normally with gitauthors |
| `core.hooksPath` | Must be unset for automatic installation |
| `core.autocrlf` | Affects line endings in working tree, not policy validation |

## Security Considerations

### Installation Security

- All downloads are over HTTPS
- SHA256 checksums are verified
- Files are installed with proper permissions
- No code is executed during download/verification

### Runtime Security

- Policy files are validated before parsing
- No `eval` or dynamic code execution
- All shell functions use proper quoting
- NUL bytes and control characters are rejected
- Policy is read-only, not executable

### Hook Bypass

The hook can be bypassed using:
- `--no-verify` flag: `git commit --no-verify -m "message"`
- `-n` flag: `git commit -n -m "message"`
- Removing the hook: `rm .git/hooks/pre-commit`
- `HUSKY=0` environment variable (for npm installations)

**This is by design** - gitauthors prevents mistakes, not malicious activity.