# gitauthors - Agent Instructions

This document provides guidance for automated agents and developers working on the gitauthors project.

## Project Overview

`gitauthors` is a Git hook that validates author and committer email addresses against a committed policy file (`.gitauthors`) to prevent accidentally committing with unapproved identities.

## Core Principles

### Security First
- **Never trust policy files**: Always validate before parsing
- **No code execution**: Policy files contain only data, never executable code
- **Safe shell practices**: All shell functions use proper quoting
- **ASCII only**: Reject non-ASCII, control characters, NUL bytes

### Mistake Prevention, Not Security
- **Hooks can be bypassed**: This prevents mistakes, not malicious activity
- **Git metadata is user-controlled**: Commits can claim any identity
- **Trust but verify**: Validate everything, trust nothing

### ComVer Versioning
- **MAJOR.MINOR.0**: Only stable versions are released
- **Compatible fixes**: MINOR version bump
- **Incompatible changes**: MAJOR version bump
- **No zero special cases**: Major version 0 has no special exemptions

## Development Workflow

### Environment Setup
```bash
# Install dependencies
npm install

# Set up Husky hooks
npm run prepare

# Run tests
npm test

# Check formatting
npm run format:check

# Check linting
npm run lint
```

### Commit Requirements
- **Valid commit message**: Must pass commitlint validation
- **Clean formatting**: Must pass `npm run format:check`
- **Passing tests**: Must pass `npm test`
- **Valid policy**: All commits must be made with approved identities

### Commit Message Types
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

## File Structure

```
gitauthors/
├── .gitauthors              # Policy file (editable)
├── .release.env             # Product version (editable)
├── .node-version            # Node version (pinned)
├── hooks/
│   └── gitauthors.sh        # Main validation script
├── install.sh               # Native installation
├── uninstall.sh             # Native uninstallation
├── package.json             # Development package
├── src/
│   ├── mod.mjs              # ESM module
│   └── cli.mjs              # CLI entry point
├── scripts/
│   ├── build.mjs            # Build script
│   ├── version.mjs          # Version utilities
│   ├── check-version.mjs    # Version consistency check
│   ├── format.mjs           # Formatting script
│   ├── lint.sh             # Linting script
│   └── test.sh              # Test script
├── .husky/
│   └── install.mjs          # Husky setup
├── test/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── docs/
│   ├── installation.md      # Installation guide
│   └── policy.md            # Policy specification
└── README.md                # Main documentation
```

## Key Files and Their Purpose

### Editable Files (Change These)
- `.gitauthors`: Policy configuration
- `.release.env`: Product version
- `docs/`: Documentation

### Generated Files (Do Not Edit)
- `dist/`: Build outputs
- Generated ESM modules with embedded shell source

### Core Logic (Edit with Care)
- `hooks/gitauthors.sh`: Main validation logic
- `install.sh`, `uninstall.sh`: Installation logic

### Tooling (Edit as Needed)
- `scripts/*`: Build, test, and development scripts
- `package.json`: Development configuration

## Git Hook Behavior

### Pre-commit Validation
1. **Staged policy check**: Validates staged `.gitauthors` file
2. **HEAD policy check**: Validates HEAD's `.gitauthors` if it exists
3. **Identity validation**: Checks author and committer emails
4. **Onboarding logic**: Allows policy-only commits for new identities

### Validation Rules
- **Approved by HEAD**: Both identities approved by HEAD policy → Allow
- **Onboarding**: Either identity only in staged policy → Require policy-only commit
- **Denied**: Both identities denied by both policies → Reject

### Range Validation (CI)
- Validates stored commits in a range
- Checks each commit's policy against its identities
- Allows identities approved by commit or parent policy

## Exit Codes

| Code | Meaning | Diagnostic |
|------|---------|------------|
| 0 | Success | - |
| 1 | Identity denied or onboarding violation | `GA_IDENTITY_DENIED`, `GA_ONBOARDING_NOT_POLICY_ONLY` |
| 2 | Policy/validation/operational error | `GA_POLICY_*`, `GA_GIT_ERROR`, `GA_INSTALL_CONFLICT` |

## Testing Strategy

### Unit Tests (Bats)
- Policy parsing edge cases
- Email/domain validation
- Error handling
- Exit code verification

### Integration Tests
- Full commit workflows
- Installation/uninstallation
- Range validation
- Onboarding scenarios

### Test Isolation
- Each test runs in temporary repository
- No global state modifications
- Clean environment for each test

## Release Process

### Version Management
- **Only `.release.env` contains the product version**
- Development `package.json` is always `0.0.0-development`
- Build generates proper versioned packages

### ComVer Rules
- `MAJOR.MINOR.0`: Stable releases
- `MAJOR.MINOR.0-rc.N`: Prereleases
- MINOR bump: Compatible fixes/features
- MAJOR bump: Incompatible changes (including fixes)

### Release Steps
1. Update `.release.env` with new version
2. Update CHANGELOG
3. Run full test suite
4. Build distribution files
5. Create GitHub release
6. Publish to npm and JSR

## Security Considerations

### Policy File Validation
- Check file size (< 64KB)
- Validate ASCII-only content
- Reject NUL bytes and control characters
- Validate email/domain format
- Reject inline comments

### Shell Script Security
- Always quote variables: `"$var"`
- Never use `eval` with untrusted input
- Use `set -e` for error handling
- Validate all inputs before use
- Use `LC_ALL=C` for consistent behavior

### Installation Security
- Download over HTTPS only
- Verify SHA256 checksums
- Atomic file operations
- Lock management with mkdir

## Troubleshooting

### Common Issues
- **Policy validation fails**: Check for inline comments, non-ASCII characters
- **Identity denied**: Add email to `.gitauthors` and commit with approved identity
- **Onboarding failed**: Commit must only change `.gitauthors`
- **Installation conflicts**: Remove existing hooks first

### Debug Mode
```bash
# Enable debug output
sh -x hooks/gitauthors.sh

# Test policy validation
sh hooks/gitauthors.sh --validate-policy .gitauthors
```

## Publishing

### npm Publishing
- Uses OIDC for trusted publishing
- Requires GitHub Actions environment
- Automated from release workflow

### JSR Publishing
- Uses JSR npm compatibility
- Same OIDC workflow
- Requires Deno publisher configuration

### GitHub Releases
- Automated from release workflow
- Contains all distribution files
- SHA256 checksums provided

## Agent-Specific Instructions

### For GitHub Actions
- Use pinned Node.js version (24.21.0)
- Install dependencies with `npm ci`
- Run full test suite: `npm run check`

### For CI Systems
- Set `HUSKY=0` to skip Husky hooks in CI
- Set `CI=true` for CI-specific behavior
- Use isolated temporary directories for tests

### For Development
- Always run `npm run check` before committing
- Test changes in temporary repositories
- Never test against production repositories
- Preserve existing commit history