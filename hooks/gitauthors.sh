#!/bin/sh
# gitauthors.sh - Git author/committer validation hook
# Exit codes:
#   0 - Approved identity or successful policy/range validation
#   1 - Valid policy denies identity or onboarding rule violation
#   2 - Missing/malformed policy, invalid arguments, Git/dependency/operational error

set -e

# Diagnostics codes - output to stderr
ga_identity_denied() {
  printf 'GA_IDENTITY_DENIED: %s\n' "$1" >&2
}

ga_policy_invalid() {
  printf 'GA_POLICY_INVALID: %s\n' "$1" >&2
}

ga_policy_missing() {
  printf 'GA_POLICY_MISSING: %s\n' "$1" >&2
}

ga_onboarding_not_policy_only() {
  printf 'GA_ONBOARDING_NOT_POLICY_ONLY: %s\n' "$1" >&2
}

ga_git_error() {
  printf 'GA_GIT_ERROR: %s\n' "$1" >&2
}

ga_install_conflict() {
  printf 'GA_INSTALL_CONFLICT: %s\n' "$1" >&2
}

# Helper: print usage error and exit with code 2
usage_error() {
  printf 'Usage: sh hooks/gitauthors.sh [--validate-policy FILE] [--range BASE HEAD]\n' >&2
  exit 2
}

# Ensure we're running in a Git repository
resolve_git_toplevel() {
  toplevel=$(git rev-parse --path-format=absolute --show-toplevel 2>/dev/null) || {
    ga_git_error "Not a git repository or git not available"
    exit 2
  }
  printf '%s\n' "$toplevel"
}

# Set LC_ALL=C for consistent behavior as required
LC_ALL=C
export LC_ALL

# Check if string contains non-ASCII characters (bytes > 127)
contains_non_ascii() {
  # Check for bytes > 127 using od
  if echo "$1" | od -An -tx1 | grep -q '[89abcdef][0-9a-f]'; then
    return 0  # Contains non-ASCII
  fi
  return 1  # ASCII only
}

# Check for NUL bytes in a string
contains_nul() {
  if echo "$1" | od -An -tx1 | grep -q '00'; then
    return 0  # Contains NUL
  fi
  return 1  # Does not contain NUL
}

# Check for BOM in a string
contains_bom() {
  if echo "$1" | od -An -tx1 | grep -q 'efbbbf'; then
    return 0  # Contains BOM
  fi
  return 1  # Does not contain BOM
}

# Validate and parse policy file content
parse_policy() {
  local policy_file="$1"
  local line_num=0
  local has_effective_lines=false
  local line
  local trimmed_line

  # Check file exists and is readable
  if [ ! -f "$policy_file" ] || [ ! -r "$policy_file" ]; then
    ga_policy_missing "Policy file not found or not readable"
    return 2
  fi

  # Check file size (max 65536 bytes)
  file_size=$(wc -c < "$policy_file" 2>/dev/null || echo 0)
  if [ "$file_size" -gt 65536 ]; then
    ga_policy_invalid "Policy file exceeds maximum size of 65536 bytes"
    return 2
  fi

  # Read file line by line
  while IFS= read -r line || [ -n "$line" ]; do
    line_num=$((line_num + 1))
    
    # Remove trailing CR if present (handle CRLF)
    line=$(printf '%s\n' "$line" | tr -d '\r')
    
    # Check for NUL bytes
    if contains_nul "$line"; then
      ga_policy_invalid "Policy contains NUL byte at line $line_num"
      return 2
    fi
    
    # Check for BOM (should only be at start of file)
    if [ "$line_num" -eq 1 ] && contains_bom "$line"; then
      ga_policy_invalid "Policy contains BOM at line $line_num"
      return 2
    fi
    
    # Check for non-ASCII characters
    if contains_non_ascii "$line"; then
      ga_policy_invalid "Policy contains non-ASCII characters at line $line_num"
      return 2
    fi
    
    # Trim trailing whitespace (ASCII spaces/tabs only)
    trimmed_line=$(printf '%s\n' "$line" | sed 's/[[:space:]]*$//')
    
    # Skip empty lines
    if [ -z "$trimmed_line" ]; then
      continue
    fi
    
    # Check for full-line comments (start with optional spaces and #)
    if echo "$trimmed_line" | grep -qE '^[[:space:]]*#'; then
      continue
    fi
    
    # Check for inline comments (not allowed)
    if echo "$trimmed_line" | grep -q '#'; then
      ga_policy_invalid "Inline comments not allowed at line $line_num: $trimmed_line"
      return 2
    fi
    
    # Now we have an effective line - it should be an email or domain
    has_effective_lines=true
    
    # Check if it's a domain (@domain)
    case "$trimmed_line" in
      @[a-zA-Z0-9]*)
        # Validate domain format
        domain=$(printf '%s\n' "$trimmed_line" | sed 's/^@//')
        if ! validate_domain "$domain"; then
          ga_policy_invalid "Invalid domain format at line $line_num: $trimmed_line"
          return 2
        fi
        continue
        ;;
    esac
    
    # Check if it's an email (local@domain)
    if echo "$trimmed_line" | grep -q '@'; then
      local_part=$(printf '%s\n' "$trimmed_line" | sed 's/@.*//')
      domain_part=$(printf '%s\n' "$trimmed_line" | sed 's/^[^@]*@//')
      
      if ! validate_local_part "$local_part"; then
        ga_policy_invalid "Invalid local part at line $line_num: $trimmed_line"
        return 2
      fi
      
      if ! validate_domain "$domain_part"; then
        ga_policy_invalid "Invalid domain in email at line $line_num: $trimmed_line"
        return 2
      fi
      continue
    fi
    
    # If we get here, it's not a valid email or domain
    ga_policy_invalid "Invalid entry at line $line_num: $trimmed_line"
    return 2
  done < "$policy_file"
  
  # Check if we have at least one effective line
  if [ "$has_effective_lines" = false ]; then
    ga_policy_invalid "Policy file contains no valid entries"
    return 2
  fi
  
  return 0
}

# Validate local part of email
validate_local_part() {
  local local="$1"
  
  # Must be non-empty
  if [ -z "$local" ]; then
    return 1
  fi
  
  # Check length (reasonable limit)
  if [ ${#local} -gt 254 ]; then
    return 1
  fi
  
  # Must contain only allowed characters: ASCII letters/digits or _ . + - [ ]
  if echo "$local" | grep -qE '[^a-zA-Z0-9_\.\+\-\[\]]'; then
    return 1
  fi
  return 0
}

# Validate domain part
validate_domain() {
  local domain="$1"
  
  # Must be non-empty
  if [ -z "$domain" ]; then
    return 1
  fi
  
  # Check total length
  if [ ${#domain} -gt 253 ]; then
    return 1
  fi
  
  # Check for empty labels (consecutive dots)
  case "$domain" in
    *..*)
      return 1
      ;;
  esac
  
  # Check for leading/trailing dot
  case "$domain" in
    .* | *. )
      return 1
      ;;
  esac
  
  # Split into labels and validate each
  oldIFS="$IFS"
  IFS='.'
  set -- $domain
  IFS="$oldIFS"
  
  for label do
    label_len=${#label}
    
    # Each label must be 1-63 bytes
    if [ "$label_len" -lt 1 ] || [ "$label_len" -gt 63 ]; then
      return 1
    fi
    
    # Labels can contain alphanumeric and hyphens
    # First and last character must be alphanumeric
    first_char=$(printf '%s\n' "$label" | cut -c1)
    last_char=$(printf '%s\n' "$label" | cut -c${#label})
    
    case "$first_char" in
      [a-zA-Z0-9]) ;;
      *) return 1 ;;
    esac
    
    case "$last_char" in
      [a-zA-Z0-9]) ;;
      *) return 1 ;;
    esac
    
    # Middle characters can be alphanumeric or hyphen
    if echo "$label" | grep -qE '[^a-zA-Z0-9-]'; then
      return 1
    fi
  done
  
  return 0
}

# Check if an email matches the policy
check_email_against_policy() {
  local email="$1"
  local policy_file="$2"
  local line
  local trimmed_line
  local entry
  
  # Parse each line of policy and check for match
  while IFS= read -r line || [ -n "$line" ]; do
    # Remove trailing CR
    line=$(printf '%s\n' "$line" | tr -d '\r')
    
    # Trim trailing whitespace
    trimmed_line=$(printf '%s\n' "$line" | sed 's/[[:space:]]*$//')
    
    # Skip empty lines and comments
    [ -z "$trimmed_line" ] && continue
    if echo "$trimmed_line" | grep -qE '^[[:space:]]*#'; then
      continue
    fi
    
    # Skip inline comments (should be caught by parser, but just in case)
    if echo "$trimmed_line" | grep -q '#'; then
      continue
    fi
    
    entry="$trimmed_line"
    
    # Check if it's a domain
    case "$entry" in
      @*)
        domain=$(printf '%s\n' "$entry" | sed 's/^@//')
        # Extract domain from email (case-insensitive comparison)
        email_domain=$(printf '%s\n' "$email" | sed 's/^[^@]*@//')
        
        # Compare domains case-insensitively using tr
        email_domain_lower=$(printf '%s\n' "$email_domain" | tr '[:upper:]' '[:lower:]')
        domain_lower=$(printf '%s\n' "$domain" | tr '[:upper:]' '[:lower:]')
        
        if [ "$email_domain_lower" = "$domain_lower" ]; then
          return 0
        fi
        continue
        ;;
    esac
    
    # Check if it's an exact email match (case-sensitive)
    if [ "$entry" = "$email" ]; then
      return 0
    fi
    
  done < "$policy_file"
  
  # No match found
  return 1
}

# Get the staged policy blob content
get_staged_policy_content() {
  local toplevel="$1"
  local policy_content
  local temp_file
  
  cd "$toplevel"
  
  # Check if .gitauthors is staged
  if ! git cat-file blob ':.gitauthors' >/dev/null 2>&1; then
    ga_policy_missing "Staged .gitauthors not found"
    return 2
  fi
  
  # Read the staged content
  policy_content=$(git cat-file blob ':.gitauthors' 2>/dev/null) || {
    ga_git_error "Failed to read staged .gitauthors"
    return 2
  }
  
  # Write to temp file for validation
  temp_file=$(mktemp) || {
    ga_git_error "Failed to create temporary file"
    return 2
  }
  printf '%s\n' "$policy_content" > "$temp_file"
  printf '%s\n' "$temp_file"
  
  # Validate the staged policy
  if ! parse_policy "$temp_file"; then
    rm -f "$temp_file"
    return 2
  fi
  
  return 0
}

# Get HEAD policy content if it exists
get_head_policy_content() {
  local toplevel="$1"
  local policy_content
  local temp_file
  
  cd "$toplevel"
  
  # Check if HEAD exists
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    # Check if .gitauthors exists in HEAD
    if git cat-file blob 'HEAD:.gitauthors' >/dev/null 2>&1; then
      policy_content=$(git cat-file blob 'HEAD:.gitauthors' 2>/dev/null) || {
        ga_git_error "Failed to read HEAD .gitauthors"
        return 2
      }
      
      # Write to temp file
      temp_file=$(mktemp) || {
        ga_git_error "Failed to create temporary file"
        return 2
      }
      printf '%s\n' "$policy_content" > "$temp_file"
      printf '%s\n' "$temp_file"
      
      # Validate the HEAD policy
      if ! parse_policy "$temp_file"; then
        rm -f "$temp_file"
        return 2
      fi
      
      return 0
    else
      # HEAD exists but no .gitauthors - this is valid for bootstrap
      printf '\n'
      return 0
    fi
  else
    # Unborn HEAD - this is valid for bootstrap
    printf '\n'
    return 0
  fi
}

# Extract email from git ident
extract_email_from_ident() {
  local ident="$1"
  
  # Git ident format: "Name <email> timestamp timezone"
  # We want the email part between < and >
  echo "$ident" | sed -n 's/.*<\\([^>]*\\)>.*/\1/p'
}

# Validate git ident and extract email
validate_and_extract_email() {
  local ident="$1"
  local email
  
  # Check if ident has expected format
  case "$ident" in
    *'<'*'>'*) ;;
    *)
      ga_git_error "Invalid git ident format: $ident"
      return 2
      ;;
  esac
  
  email=$(extract_email_from_ident "$ident")
  
  if [ -z "$email" ]; then
    ga_git_error "Failed to extract email from ident: $ident"
    return 2
  fi
  
  # Basic email format validation - must contain @ and no spaces
  if echo "$email" | grep -qE '[^@]+@[^@]+'; then
    : # Valid
  else
    ga_git_error "Invalid email format in ident: $email"
    return 2
  fi
  
  printf '%s\n' "$email"
  return 0
}

# Main validation for pending commit
validate_pending_commit() {
  local toplevel="$1"
  local author_ident committer_ident
  local author_email committer_email
  local staged_policy_file head_policy_file
  local author_approved_by_head committer_approved_by_head
  local author_approved_by_staged committer_approved_by_staged
  local author_needs_onboarding committer_needs_onboarding
  local diff_exit_code

  cd "$toplevel"
  
  # Get staged policy
  if ! staged_policy_file=$(get_staged_policy_content "$toplevel"); then
    exit $?
  fi
  
  # Get HEAD policy
  head_policy_file=$(get_head_policy_content "$toplevel") || {
    rm -f "$staged_policy_file"
    exit $?
  }
  
  # Get author and committer identities
  author_ident=$(git var GIT_AUTHOR_IDENT 2>/dev/null) || {
    ga_git_error "Failed to get author identity"
    rm -f "$staged_policy_file" "$head_policy_file"
    exit 2
  }
  
  committer_ident=$(git var GIT_COMMITTER_IDENT 2>/dev/null) || {
    ga_git_error "Failed to get committer identity"
    rm -f "$staged_policy_file" "$head_policy_file"
    exit 2
  }
  
  # Extract emails
  author_email=$(validate_and_extract_email "$author_ident") || {
    rm -f "$staged_policy_file" "$head_policy_file"
    exit $?
  }
  
  committer_email=$(validate_and_extract_email "$committer_ident") || {
    rm -f "$staged_policy_file" "$head_policy_file"
    exit $?
  }
  
  # Check if both identities are approved by HEAD policy
  if [ -n "$head_policy_file" ] && [ -f "$head_policy_file" ] && [ -s "$head_policy_file" ]; then
    if check_email_against_policy "$author_email" "$head_policy_file"; then
      author_approved_by_head=true
    else
      author_approved_by_head=false
    fi
    
    if check_email_against_policy "$committer_email" "$head_policy_file"; then
      committer_approved_by_head=true
    else
      committer_approved_by_head=false
    fi
  else
    # No HEAD policy - bootstrap scenario
    author_approved_by_head=false
    committer_approved_by_head=false
  fi
  
  # Check if both identities are approved by staged policy
  if check_email_against_policy "$author_email" "$staged_policy_file"; then
    author_approved_by_staged=true
  else
    author_approved_by_staged=false
  fi
  
  if check_email_against_policy "$committer_email" "$staged_policy_file"; then
    committer_approved_by_staged=true
  else
    committer_approved_by_staged=false
  fi
  
  # Clean up temp files
  rm -f "$staged_policy_file" "$head_policy_file"
  
  # Decision logic:
  # If both identities are approved by HEAD, allow
  if $author_approved_by_head && $committer_approved_by_head; then
    exit 0
  fi
  
  # If either identity is approved only by staged policy, require policy-only commit
  author_needs_onboarding=false
  if $author_approved_by_staged && ! $author_approved_by_head; then
    author_needs_onboarding=true
  fi
  
  committer_needs_onboarding=false
  if $committer_approved_by_staged && ! $committer_approved_by_head; then
    committer_needs_onboarding=true
  fi
  
  if $author_needs_onboarding || $committer_needs_onboarding; then
    # Check if .gitauthors is the only changed path and actually changed
    # First check that .gitauthors is actually changed (diff returns non-zero)
    if git diff --cached --quiet --no-renames --no-ext-diff --no-textconv -- \
      ':(top,literal).gitauthors' 2>/dev/null; then
      diff_exit_code=$?
      if [ "$diff_exit_code" -ne 0 ]; then
        # .gitauthors is changed, now check that nothing else is changed
        if git diff --cached --quiet --no-renames --no-ext-diff --no-textconv -- \
          . ':(top,exclude,literal).gitauthors' 2>/dev/null; then
          diff_exit_code=$?
          if [ "$diff_exit_code" -eq 0 ]; then
            # Policy-only change - allow onboarding
            exit 0
          fi
        fi
      fi
    fi
    
    # Onboarding failed - either mixed content or .gitauthors not actually changed
    ga_onboarding_not_policy_only "Onboarding requires .gitauthors to be the only changed path and actually changed"
    exit 1
  fi
  
  # Both identities are denied by both policies
  ga_identity_denied "Author email $author_email and committer email $committer_email are not approved by policy"
  printf 'Suggest correcting with: git config --local user.email <approved-email>\n' >&2
  exit 1
}

# Validate policy mode
validate_policy_mode() {
  local policy_file="$1"
  
  if [ ! -f "$policy_file" ]; then
    ga_policy_missing "Policy file not found: $policy_file"
    exit 2
  fi
  
  if parse_policy "$policy_file"; then
    printf 'Policy is valid\n' >&2
    exit 0
  else
    exit 2
  fi
}

# Range validation mode (will be implemented in Phase C)
range_mode() {
  ga_git_error "Range mode not yet implemented"
  exit 2
}

# Main entry point
main() {
  # Parse arguments
  if [ $# -eq 0 ]; then
    # No arguments: validate pending commit
    toplevel=$(resolve_git_toplevel) || exit 2
    validate_pending_commit "$toplevel"
    exit $?
  elif [ "$1" = "--validate-policy" ] && [ $# -eq 2 ]; then
    # Validate policy file
    validate_policy_mode "$2"
    exit $?
  elif [ "$1" = "--range" ] && [ $# -eq 3 ]; then
    # Range mode (will be implemented in Phase C)
    range_mode "$2" "$3"
    exit $?
  else
    usage_error
  fi
}

# Run main with all arguments
main "$@"