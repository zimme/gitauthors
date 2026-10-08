# gitauthors

**Git author validation hook - mistake prevention for git commits**

`gitauthors` is a shell hook that validates Git author and committer email addresses against a committed policy file (`.gitauthors`) to prevent accidentally committing with unapproved identities.

## Quick Start

### Native Git Hook

1. Create `.gitauthors` in your repository:
   ```text
   # Approved authors and committers
   @yourcompany.com
   bot@yourcompany.com
   ```

2. Commit the policy:
   ```bash
   git add .gitauthors
   git commit -m "chore: Add gitauthors policy"
   ```

3. Install the hook:
   ```bash
   curl -fsSL https://github.com/zimme/gitauthors/releases/latest/download/install.sh | sh
   ```

### npm Package

**Option A: Automatic setup with npm install (npm v11+)**
```bash
npm install --save-dev @zimme/gitauthors
```
The package includes a `prepare` script that automatically installs the hook.
**Note:** npm v11+ requires explicit approval for install scripts:
```bash
npm install-scripts approve @zimme/gitauthors
npm install --save-dev @zimme/gitauthors
```

**Option B: Automatic setup via npx (recommended for simplicity)**
```bash
npx @zimme/gitauthors
```
This automatically installs the hook (works with or without Husky).

**Option C: Manual setup**
1. Install as dev dependency:
   ```bash
   npm install --save-dev @zimme/gitauthors
   ```

2. Add to your existing `.husky/pre-commit`:
   ```bash
   sh ./node_modules/@zimme/gitauthors/hooks/gitauthors.sh || exit $?
   ```

3. Keep your existing checks afterward.

## Features

- **Policy validation**: Strict parsing of `.gitauthors` files with exact email and domain matching
- **Pending commit checks**: Validates staged commits before they're created
- **Stored commit validation**: Range validation for CI workflows with `--range BASE HEAD`
- **Onboarding**: Policy-only commits allowed for bootstrap and adding new approved identities
- **Native installation**: Works without Node.js/npm using Git hooks directly
- **Package distribution**: Available via npm and JSR for JavaScript projects
- **Strict validation**: ASCII-only, no control characters, proper email format validation
- **Comprehensive error codes**: Stable diagnostic codes for debugging

## Policy Format

The `.gitauthors` file supports:

- **Full-line comments**: Lines starting with `#`
- **Empty lines**: Ignored
- **Email addresses**: Exact matches (case-sensitive)
- **Domain patterns**: `@domain.com` matches any email at that domain (case-insensitive)
- **No inline comments**: Not supported for security

### Example `.gitauthors`

```text
# Employees
@zymego.com
# Consultant
consultant@example.com
# Automation
noreply@github.com
198982749+Copilot@users.noreply.github.com
```

### Rules

- One exact email or `@domain` per effective line
- Maximum file size: 65,536 bytes
- Email local part: case-sensitive, supports `a-zA-Z0-9_\.\+\-\[\]`
- Domain: case-insensitive, standard DNS label validation
- No wildcards, regex, or negation
- Duplicates are harmless

## Usage

### Validate pending commit (default)
```bash
sh hooks/gitauthors.sh
```

### Validate policy file
```bash
sh hooks/gitauthors.sh --validate-policy .gitauthors
```

### Validate stored commit range
```bash
sh hooks/gitauthors.sh --range HEAD~10 HEAD
```

## Exit Codes

| Code | Meaning | Diagnostic Code |
|------|---------|----------------|
| 0 | Approved identity or successful validation | - |
| 1 | Policy denies identity or onboarding violation | `GA_IDENTITY_DENIED` or `GA_ONBOARDING_NOT_POLICY_ONLY` |
| 2 | Missing/malformed policy, invalid arguments, Git/operational error | `GA_POLICY_MISSING`, `GA_POLICY_INVALID`, `GA_GIT_ERROR`, etc. |

## Installation Methods

### Native Installation
```bash
# Download and install latest release
curl -fsSL https://github.com/zimme/gitauthors/releases/latest/download/install.sh | sh

# Source install (for development)
sh install.sh --from-source
```

### Manual Integration
```bash
# Add to your existing pre-commit hook
sh /path/to/gitauthors/hooks/gitauthors.sh || exit $?
```

### npm Integration
```bash
npm install --save-dev @zimme/gitauthors
# Add to .husky/pre-commit
sh ./node_modules/@zimme/gitauthors/hooks/gitauthors.sh || exit $?
```

### JSR Integration
```javascript
// scripts/check-gitauthors.mjs
import { runHook } from "@zimme/gitauthors";
process.exitCode = runHook();

// In your hook
node scripts/check-gitauthors.mjs || exit $?
```

## Onboarding New Authors

To add a new approved email/author:

1. **Policy-only commit required**: The commit must only change `.gitauthors`
2. **Identity must be in staged policy**: The new email must be in the staged `.gitauthors` file
3. **Existing HEAD policy check**: If the identity was already approved by HEAD, any changes are allowed

Example workflow:
```bash
# Add new approved email to policy
echo "newuser@example.com" >> .gitauthors

# Commit with existing approved identity
git add .gitauthors
git commit -m "feat: Add new approved author"
```

## Limitations

- **Not authentication**: This prevents mistakes, not malicious commits (hooks can be bypassed)
- **Git metadata is user-controlled**: Commits can claim any identity
- **Pre-commit only**: Doesn't validate all Git operations (amend, rebase, etc.)
- **No retroactive enforcement**: Existing commits are not validated unless using range mode
- **Co-authored-by**: Not currently validated (out of scope)

## Configuration

### Environment Variables

None required for normal operation. The hook uses:
- `GIT_AUTHOR_IDENT` from `git var`
- `GIT_COMMITTER_IDENT` from `git var`

### Git Configuration

- Works with standard Git configuration
- Respects `core.hooksPath` (but requires manual integration)
- Supports worktrees (shared metadata directory)

## Development

### Setup
```bash
# Install development dependencies
npm install

# Set up Husky hooks
npm run prepare

# Run tests
npm test

# Build distribution files
npm run build
```

### Project Structure
```
gitauthors/
├── .gitauthors              # Policy file
├── .release.env             # Product version
├── hooks/
│   └── gitauthors.sh        # Main validation script
├── install.sh               # Native installation script
├── uninstall.sh             # Native uninstallation script
├── src/
│   ├── mod.mjs              # ESM module adapter
│   └── cli.mjs              # CLI adapter
├── scripts/
│   ├── build.mjs            # Build script
│   ├── pins.json            # Tool versions
│   └── ...                  # Other scripts
├── package.json             # Development package
├── commitlint.config.mjs    # Commitlint configuration
└── .husky/
    └── install.mjs          # Husky setup
```

## Releasing

See [docs/releasing.md](docs/releasing.md) for release process.

## Security

- Hook can be bypassed with `--no-verify` or by removing it
- Policy files are validated for malicious content
- No code execution from policy files
- All shell functions use safe quoting

## Support

- **Repository**: [github.com/zimme/gitauthors](https://github.com/zimme/gitauthors)
- **Issues**: [github.com/zimme/gitauthors/issues](https://github.com/zimme/gitauthors/issues)
- **License**: MIT