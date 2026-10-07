# Policy File Specification

This document describes the `.gitauthors` policy file format and validation rules.

## File Format

The `.gitauthors` file contains a list of approved email addresses and domains for Git authors and committers.

### Basic Structure

- **One entry per line**: Each effective line contains exactly one email address or domain pattern
- **Comments**: Lines starting with `#` are full-line comments
- **Empty lines**: Empty lines are ignored
- **Whitespace**: Leading and trailing whitespace is trimmed from each line
- **CRLF support**: Both LF and CRLF line endings are supported

### Example

```text
# Approved authors and committers
@yourcompany.com

# Specific individuals
developer@external.com
bot@yourcompany.com

# GitHub bots
noreply@github.com
123456+BotName@users.noreply.github.com
```

## Entry Types

### Email Addresses

Exact email address matching (case-sensitive for local part, case-insensitive for domain).

**Format**: `local-part@domain`

**Examples**:
- `user@example.com` - Matches `user@example.com` exactly
- `User@Example.COM` - Different from `user@example.com` (local part case-sensitive)
- `user+tag@example.com` - Supports plus addressing

**Local Part Rules**:
- Characters allowed: `a-zA-Z0-9_\.\+\-\[\]`
- Maximum length: 254 characters
- Must be non-empty
- Bracketed bots supported: `[botname]`

**Domain Rules**:
- Standard DNS domain validation
- Case-insensitive comparison
- See Domain Patterns section below

### Domain Patterns

Matches any email address at the specified domain.

**Format**: `@domain`

**Examples**:
- `@yourcompany.com` - Matches `user@yourcompany.com`, `anyone@yourcompany.com`
- `@example.com` - Does NOT match `user@sub.example.com`
- `@github.com` - Matches all `@github.com` addresses

**Domain Validation**:
- Total length: 1-253 characters
- Each label: 1-63 characters
- Labels separated by dots (`.`) 
- First and last character of each label: alphanumeric only
- Middle characters: alphanumeric or hyphen (`-`)
- No consecutive dots
- No leading/trailing dots

## Validation Rules

### Character Set

- **ASCII only**: Only bytes 0-127 are allowed
- **No control characters**: Control characters (except tab, LF, CR) are rejected
- **No NUL bytes**: NUL (0x00) is explicitly rejected
- **No BOM**: UTF-8 BOM (0xEF 0xBB 0xBF) is rejected
- **No non-printable**: All non-printable ASCII characters are rejected

### File Size

- Maximum: 65,536 bytes (64KB)
- Minimum: No minimum (but must have at least one valid entry)

### Comments

- **Full-line comments**: Lines starting with `#` (after whitespace) are ignored
- **Inline comments**: NOT ALLOWED - any `#` character not at the start of a line causes validation failure

**Examples**:
```text
# This is valid - full-line comment
user@example.com

# This is invalid - inline comment not allowed
user@example.com # developer
```

### Duplicates

- Duplicate entries are harmless
- No error is generated for duplicate emails or domains
- First match wins during validation

**Example**:
```text
@yourcompany.com
@yourcompany.com
user@yourcompany.com
```

This is valid - all three entries are allowed.

## Matching Rules

### Email Matching

When checking an email against the policy:

1. **Exact email match**: First, check if the exact email (case-sensitive) appears in the policy
2. **Domain match**: Then, check if the domain (case-insensitive) appears as a domain pattern

**Examples**:

Policy: `user@example.com`
- `user@example.com` ✅ matches (exact)
- `User@Example.COM` ❌ does not match (local part case-sensitive)
- `other@example.com` ❌ does not match

Policy: `@example.com`
- `user@example.com` ✅ matches (domain)
- `User@Example.COM` ✅ matches (domain case-insensitive)
- `user@sub.example.com` ❌ does not match (subdomain)

### Multiple Entries

- **OR logic**: An email matches if it matches ANY entry in the policy
- **First match wins**: Validation stops at the first matching entry

**Example**:
```text
user@example.com
@other.com
```

Email `user@example.com` matches the first entry, so it's approved.

## Policy File Validation

The policy file is validated when:

1. **During installation**: The committed `.gitauthors` must be valid
2. **During pending commit**: The staged `.gitauthors` must be valid
3. **During range validation**: Each commit's `.gitauthors` must be valid

Validation includes:
- File exists and is readable
- File size within limits
- No NUL bytes
- No BOM (except possibly at start of file)
- No non-ASCII characters
- No control characters
- No inline comments
- All effective lines are valid email addresses or domain patterns
- At least one effective line exists

## Bootstrap and Onboarding

### Initial Setup

1. Create `.gitauthors` with initial approved identities
2. Commit with one of those identities
3. Install gitauthors hook

**Example**:
```bash
# Create policy
echo "@yourcompany.com" > .gitauthors

# Set email to approved identity
git config user.email "user@yourcompany.com"

# Commit policy
git add .gitauthors
git commit -m "chore: Initial gitauthors policy"

# Install hook
sh install.sh --from-source
```

### Adding New Approved Identities

To add a new email or domain to the policy:

1. **Only change `.gitauthors`**: The commit must only modify `.gitauthors`
2. **Use existing approved identity**: The commit must be made by an already-approved identity
3. **New identity must be in staged policy**: The new email/domain must be in the staged `.gitauthors`

**Example**:
```bash
# Add new email to policy
echo "newuser@external.com" >> .gitauthors

# Commit with existing approved identity
git add .gitauthors
git commit -m "chore: Add new approved author"
```

**Failure case**:
```bash
# Try to add new email and other changes
echo "newuser@external.com" >> .gitauthors
echo "other change" > file.txt
git add .gitauthors file.txt
git commit -m "feat: Multiple changes"  # ❌ FAILS
```

## Common Patterns

### Company Email Only

```text
# All company emails allowed
@yourcompany.com
```

### Specific Individuals + Company Domain

```text
# Leadership
ceo@yourcompany.com
cto@yourcompany.com

# Everyone else
@yourcompany.com
```

### Multiple Domains

```text
# Primary company
@yourcompany.com

# Subsidiary
@subsidiary.com

# External contractors
consultant@external.com
```

### Automation and Bots

```text
# GitHub
noreply@github.com

# GitHub bots
123456+Bot@users.noreply.github.com

# CI/CD
ci@yourcompany.com
```

## Error Codes

| Error Code | Description | Example |
|------------|-------------|---------|
| `GA_POLICY_INVALID` | Policy file has invalid syntax | Inline comment found |
| `GA_POLICY_MISSING` | Policy file not found | No .gitauthors file |
| `GA_POLICY_INVALID` | Policy file exceeds size limit | File > 64KB |
| `GA_POLICY_INVALID` | Policy contains NUL byte | Binary data |
| `GA_POLICY_INVALID` | Policy contains non-ASCII | UTF-8 characters |
| `GA_POLICY_INVALID` | Policy has no valid entries | Empty file or all comments |

## Best Practices

1. **Start with company domain**: `@yourcompany.com` covers most cases
2. **Add specific exceptions**: Individual external contributors
3. **Document policy**: Add comments explaining each entry
4. **Regular review**: Audit the policy regularly
5. **Automated onboarding**: Use policy-only commits to add new team members
6. **Backup**: Keep the policy committed in Git for version history

## Migration from Other Tools

### From CODEOWNERS-style files

Convert from simple email lists:
```bash
# CODEOWNERS-style
* @yourteam

# To .gitauthors
@yourteam.com
```

### From complex validation scripts

Replace custom validation with `.gitauthors`:
1. Extract all approved emails/domains from existing script
2. Add to `.gitauthors` file
3. Remove custom script from pre-commit hook
4. Install gitauthors

## Testing Policy Files

Test your policy before committing:

```bash
sh hooks/gitauthors.sh --validate-policy .gitauthors
```

**Exit codes**:
- `0`: Policy is valid
- `2`: Policy has errors

**Example output**:
```bash
$ sh hooks/gitauthors.sh --validate-policy .gitauthors
Policy is valid

$ echo "invalid#comment" > .gitauthors
$ sh hooks/gitauthors.sh --validate-policy .gitauthors
GA_POLICY_INVALID: Inline comments not allowed at line 1: invalid#comment
```