// gitauthors ESM module
// Generated from gitauthors.sh - do not edit directly

/**
 * @typedef {Object} RunHookOptions
 * @property {string} [cwd] - Working directory for the Git operation
 */

/**
 * Runs the gitauthors hook with the given arguments
 * @param {string[]} [args=[]] - Arguments to pass to the hook
 * @param {RunHookOptions} [options={}] - Options for running the hook
 * @returns {number} The exit status code (0=success, 1=denied, 2=error)
 */
export function runHook(args = [], options = {}) {
  const { cwd = process.cwd() } = options;
  
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('sh', ['-c', shellSource, 'gitauthors', ...args], {
      cwd,
      stdio: 'inherit'
    });
    
    if (result.error) {
      throw result.error;
    }
    
    return result.status ?? 0;
  } catch (error) {
    console.error(`GA_GIT_ERROR: ${error.message}`);
    return 2;
  }
}

// Embedded shell source for gitauthors hook
export const shellSource = `# gitauthors.sh - Git author/committer validation hook
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
  if echo "$1" | od -An -tx1 | grep -q '[89abcdef][0-9a-f]'; then
    return 0
  fi
  return 1
}

# Check for NUL bytes
contains_nul() {
  if echo "$1" | od -An -tx1 | grep -q '00'; then
    return 0
  fi
  return 1
}

# Check for BOM
contains_bom() {
  if echo "$1" | od -An -tx1 | grep -q 'efbbbf'; then
    return 0
  fi
  return 1
}

# Validate and parse policy file content
parse_policy() {
  local policy_file="$1"
  local line_num=0
  local has_effective_lines=false
  local line trimmed_line

  if [ ! -f "$policy_file" ] || [ ! -r "$policy_file" ]; then
    ga_policy_missing "Policy file not found or not readable"
    return 2
  fi

  file_size=$(wc -c < "$policy_file" 2>/dev/null || echo 0)
  if [ "$file_size" -gt 65536 ]; then
    ga_policy_invalid "Policy file exceeds maximum size of 65536 bytes"
    return 2
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line_num=$((line_num + 1))
    line=$(printf '%s\n' "$line" | tr -d '\r')
    
    if contains_nul "$line"; then
      ga_policy_invalid "Policy contains NUL byte at line $line_num"
      return 2
    fi
    
    if [ "$line_num" -eq 1 ] && contains_bom "$line"; then
      ga_policy_invalid "Policy contains BOM at line $line_num"
      return 2
    fi
    
    if contains_non_ascii "$line"; then
      ga_policy_invalid "Policy contains non-ASCII characters at line $line_num"
      return 2
    fi
    
    trimmed_line=$(printf '%s\n' "$line" | sed 's/[[:space:]]*$//')
    [ -z "$trimmed_line" ] && continue
    
    if echo "$trimmed_line" | grep -qE '^[[:space:]]*#'; then
      continue
    fi
    
    if echo "$trimmed_line" | grep -q '#'; then
      ga_policy_invalid "Inline comments not allowed at line $line_num: $trimmed_line"
      return 2
    fi
    
    has_effective_lines=true
    
    case "$trimmed_line" in
      @[a-zA-Z0-9]*)
        domain=$(printf '%s\n' "$trimmed_line" | sed 's/^@//')
        if ! validate_domain "$domain"; then
          ga_policy_invalid "Invalid domain format at line $line_num: $trimmed_line"
          return 2
        fi
        continue
        ;;
    esac
    
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
    
    ga_policy_invalid "Invalid entry at line $line_num: $trimmed_line"
    return 2
  done < "$policy_file"
  
  if [ "$has_effective_lines" = false ]; then
    ga_policy_invalid "Policy file contains no valid entries"
    return 2
  fi
  
  return 0
}

validate_local_part() {
  local local="$1"
  if [ -z "$local" ]; then return 1; fi
  if [ \${#local} -gt 254 ]; then return 1; fi
  if echo "$local" | grep -qE '[^a-zA-Z0-9_\.\+\-\[\]]'; then return 1; fi
  return 0
}

validate_domain() {
  local domain="$1"
  if [ -z "$domain" ]; then return 1; fi
  if [ \${#domain} -gt 253 ]; then return 1; fi
  
  case "$domain" in
    *..*) return 1 ;;
    .* | *. ) return 1 ;;
  esac
  
  oldIFS="$IFS"
  IFS='.'
  set -- $domain
  IFS="$oldIFS"
  
  for label do
    label_len=\${#label}
    if [ "$label_len" -lt 1 ] || [ "$label_len" -gt 63 ]; then return 1; fi
    
    first_char=$(printf '%s\n' "$label" | cut -c1)
    last_char=$(printf '%s\n' "$label" | cut -c\${#label})
    
    case "$first_char" in [a-zA-Z0-9]) ;; *) return 1 ;; esac
    case "$last_char" in [a-zA-Z0-9]) ;; *) return 1 ;; esac
    
    if echo "$label" | grep -qE '[^a-zA-Z0-9-]'; then return 1; fi
  done
  
  return 0
}

check_email_against_policy() {
  local email="$1" policy_file="$2" line trimmed_line entry
  
  while IFS= read -r line || [ -n "$line" ]; do
    line=$(printf '%s\n' "$line" | tr -d '\r')
    trimmed_line=$(printf '%s\n' "$line" | sed 's/[[:space:]]*$//')
    [ -z "$trimmed_line" ] && continue
    
    if echo "$trimmed_line" | grep -qE '^[[:space:]]*#'; then continue; fi
    if echo "$trimmed_line" | grep -q '#'; then continue; fi
    
    entry="$trimmed_line"
    
    case "$entry" in
      @*)
        domain=$(printf '%s\n' "$entry" | sed 's/^@//')
        email_domain=$(printf '%s\n' "$email" | sed 's/^[^@]*@//')
        email_domain_lower=$(printf '%s\n' "$email_domain" | tr '[:upper:]' '[:lower:]')
        domain_lower=$(printf '%s\n' "$domain" | tr '[:upper:]' '[:lower:]')
        if [ "$email_domain_lower" = "$domain_lower" ]; then return 0; fi
        continue
        ;;
    esac
    
    if [ "$entry" = "$email" ]; then return 0; fi
  done < "$policy_file"
  
  return 1
}

get_staged_policy_content() {
  local toplevel="$1" policy_content temp_file
  cd "$toplevel"
  
  if ! git cat-file blob ':.gitauthors' >/dev/null 2>&1; then
    ga_policy_missing "Staged .gitauthors not found"
    return 2
  fi
  
  policy_content=$(git cat-file blob ':.gitauthors' 2>/dev/null) || {
    ga_git_error "Failed to read staged .gitauthors"
    return 2
  }
  
  temp_file=$(mktemp) || { ga_git_error "Failed to create temporary file"; return 2; }
  printf '%s\n' "$policy_content" > "$temp_file"
  printf '%s\n' "$temp_file"
  
  if ! parse_policy "$temp_file"; then
    rm -f "$temp_file"
    return 2
  fi
  
  return 0
}

get_head_policy_content() {
  local toplevel="$1" policy_content temp_file
  cd "$toplevel"
  
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    if git cat-file blob 'HEAD:.gitauthors' >/dev/null 2>&1; then
      policy_content=$(git cat-file blob 'HEAD:.gitauthors' 2>/dev/null) || {
        ga_git_error "Failed to read HEAD .gitauthors"
        return 2
      }
      temp_file=$(mktemp) || { ga_git_error "Failed to create temporary file"; return 2; }
      printf '%s\n' "$policy_content" > "$temp_file"
      printf '%s\n' "$temp_file"
      if ! parse_policy "$temp_file"; then rm -f "$temp_file"; return 2; fi
      return 0
    else
      printf '\n'; return 0
    fi
  else
    printf '\n'; return 0
  fi
}

# Extract email from git ident - use simple sed pattern
extract_email_from_ident() {
  echo "$1" | sed 's/.*<//;s/>.*//'
}

validate_and_extract_email() {
  local ident="$1" email
  
  case "$ident" in *'<'*'>'*) ;; *) ga_git_error "Invalid git ident: $ident"; return 2 ;; esac
  
  email=$(extract_email_from_ident "$ident")
  [ -z "$email" ] && { ga_git_error "Failed to extract email from: $ident"; return 2; }
  
  echo "$email" | grep -qE '[^@]+@[^@]+' || { ga_git_error "Invalid email format: $email"; return 2; }
  
  printf '%s\n' "$email"
  return 0
}

validate_pending_commit() {
  local toplevel="$1" author_ident committer_ident
  local author_email committer_email staged_policy_file head_policy_file
  local author_approved_by_head=false committer_approved_by_head=false
  local author_approved_by_staged=false committer_approved_by_staged=false
  local author_needs_onboarding=false committer_needs_onboarding=false

  cd "$toplevel"
  
  staged_policy_file=$(get_staged_policy_content "$toplevel") || exit $?
  head_policy_file=$(get_head_policy_content "$toplevel") || { rm -f "$staged_policy_file"; exit $?; }
  
  author_ident=$(git var GIT_AUTHOR_IDENT 2>/dev/null) || { ga_git_error "Failed to get author identity"; rm -f "$staged_policy_file" "$head_policy_file"; exit 2; }
  committer_ident=$(git var GIT_COMMITTER_IDENT 2>/dev/null) || { ga_git_error "Failed to get committer identity"; rm -f "$staged_policy_file" "$head_policy_file"; exit 2; }
  
  author_email=$(validate_and_extract_email "$author_ident") || { rm -f "$staged_policy_file" "$head_policy_file"; exit $?; }
  committer_email=$(validate_and_extract_email "$committer_ident") || { rm -f "$staged_policy_file" "$head_policy_file"; exit $?; }
  
  if [ -n "$head_policy_file" ] && [ -f "$head_policy_file" ] && [ -s "$head_policy_file" ]; then
    check_email_against_policy "$author_email" "$head_policy_file" && author_approved_by_head=true
    check_email_against_policy "$committer_email" "$head_policy_file" && committer_approved_by_head=true
  fi
  
  check_email_against_policy "$author_email" "$staged_policy_file" && author_approved_by_staged=true
  check_email_against_policy "$committer_email" "$staged_policy_file" && committer_approved_by_staged=true
  
  rm -f "$staged_policy_file" "$head_policy_file"
  
  if $author_approved_by_head && $committer_approved_by_head; then exit 0; fi
  
  $author_approved_by_staged && ! $author_approved_by_head && author_needs_onboarding=true
  $committer_approved_by_staged && ! $committer_approved_by_head && committer_needs_onboarding=true
  
  if $author_needs_onboarding || $committer_needs_onboarding; then
    if git diff --cached --quiet --no-renames --no-ext-diff --no-textconv -- ':(top,literal).gitauthors' 2>/dev/null; then
      if [ $? -ne 0 ]; then
        if git diff --cached --quiet --no-renames --no-ext-diff --no-textconv -- . ':(top,exclude,literal).gitauthors' 2>/dev/null; then
          [ $? -eq 0 ] && exit 0
        fi
      fi
    fi
    ga_onboarding_not_policy_only "Onboarding requires .gitauthors to be the only changed path and actually changed"
    exit 1
  fi
  
  ga_identity_denied "Author email $author_email and committer email $committer_email are not approved by policy"
  printf 'Suggest correcting with: git config --local user.email <approved-email>\n' >&2
  exit 1
}

validate_policy_mode() {
  local policy_file="$1"
  [ ! -f "$policy_file" ] && { ga_policy_missing "Policy file not found: $policy_file"; exit 2; }
  parse_policy "$policy_file" && { printf 'Policy is valid\n' >&2; exit 0; } || exit 2
}

range_mode() {
  local base_ref="$1" head_ref="$2" toplevel resolved_base resolved_head
  local current_commit first_parent_commit author_email committer_email
  local commit_policy_file first_parent_policy_file

  toplevel=$(resolve_git_toplevel) || exit 2
  cd "$toplevel"
  
  resolved_base=$(git rev-parse --verify --end-of-options "\${base_ref}^{commit}" 2>/dev/null) || { ga_git_error "Invalid base reference: $base_ref"; exit 2; }
  resolved_head=$(git rev-parse --verify --end-of-options "\${head_ref}^{commit}" 2>/dev/null) || { ga_git_error "Invalid head reference: $head_ref"; exit 2; }
  
  git merge-base --is-ancestor "$resolved_base" "$resolved_head" >/dev/null 2>&1 || { ga_git_error "BASE is not an ancestor of HEAD"; exit 2; }
  [ "$resolved_base" = "$resolved_head" ] && exit 0
  
  git rev-list --reverse "\${resolved_base}..\${resolved_head}" 2>/dev/null | while IFS= read -r current_commit; do
    [ -z "$current_commit" ] && continue
    
    first_parent_commit=$(git rev-parse --verify "\${current_commit}^1" 2>/dev/null) || first_parent_commit=""
    
    author_email=$(git show -s --format='%ae' "$current_commit" 2>/dev/null) || { ga_git_error "Failed to get author email for commit $current_commit"; exit 2; }
    committer_email=$(git show -s --format='%ce' "$current_commit" 2>/dev/null) || { ga_git_error "Failed to get committer email for commit $current_commit"; exit 2; }
    
    commit_policy_file=$(get_commit_policy "$current_commit") || { ga_git_error "Failed to get policy for commit $current_commit"; exit 2; }
    
    if [ -n "$first_parent_commit" ] && [ "$first_parent_commit" != "$current_commit" ]; then
      first_parent_policy_file=$(get_commit_policy "$first_parent_commit") || first_parent_policy_file=""
    else
      first_parent_policy_file=""
    fi
    
    ! check_commit_identity "$author_email" "$commit_policy_file" "$first_parent_policy_file" && { ga_identity_denied "Author $author_email not approved for $current_commit"; exit 1; }
    ! check_commit_identity "$committer_email" "$commit_policy_file" "$first_parent_policy_file" && { ga_identity_denied "Committer $committer_email not approved for $current_commit"; exit 1; }
    
    rm -f "$commit_policy_file" "$first_parent_policy_file"
  done
  
  exit 0
}

get_commit_policy() {
  local commit="$1" policy_content temp_file
  
  if git cat-file blob "\${commit}:.gitauthors" >/dev/null 2>&1; then
    policy_content=$(git cat-file blob "\${commit}:.gitauthors" 2>/dev/null) || { ga_git_error "Failed to read .gitauthors from $commit"; return 2; }
    temp_file=$(mktemp) || { ga_git_error "Failed to create temporary file"; return 2; }
    printf '%s\n' "$policy_content" > "$temp_file"
    parse_policy "$temp_file" || { rm -f "$temp_file"; return 2; }
    printf '%s\n' "$temp_file"
    return 0
  else
    printf '\n'; return 0
  fi
}

check_commit_identity() {
  local email="$1" commit_policy_file="$2" parent_policy_file="$3"
  
  [ -n "$commit_policy_file" ] && [ -f "$commit_policy_file" ] && [ -s "$commit_policy_file" ] && check_email_against_policy "$email" "$commit_policy_file" && return 0
  [ -n "$parent_policy_file" ] && [ -f "$parent_policy_file" ] && [ -s "$parent_policy_file" ] && check_email_against_policy "$email" "$parent_policy_file" && return 0
  [ -z "$commit_policy_file" ] && [ -z "$parent_policy_file" ] && return 0
  
  return 1
}

main() {
  if [ $# -eq 0 ]; then
    toplevel=$(resolve_git_toplevel) || exit 2
    validate_pending_commit "$toplevel"
    exit $?
  elif [ "$1" = "--validate-policy" ] && [ $# -eq 2 ]; then
    validate_policy_mode "$2"
    exit $?
  elif [ "$1" = "--range" ] && [ $# -eq 3 ]; then
    range_mode "$2" "$3"
    exit $?
  else
    usage_error
  fi
}

main "$@"`;

export const version = '1.0.0-rc.1';
export const sourceSha = 'd3b0e033e047fed367ccc0929199bcdd4445df34';
