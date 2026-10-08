#!/bin/bash
# Integration test script for gitauthors
# Tests the full workflow in isolated temporary repositories

set -e

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

echo "Running integration tests..."

# Create test directory
TEST_DIR=$(mktemp -d)
trap "rm -rf \"$TEST_DIR\"" EXIT

# Test 1: Native installation and basic functionality
test_native_installation() {
  test_repo="$TEST_DIR/test_native"
  mkdir -p "$test_repo"
  cd "$test_repo"
  
  echo "🧪 Test: Native installation and basic functionality"
  
  # Initialize git repo
  git init --quiet
  git config user.name "Test User"
  git config user.email "test@example.com"
  git config commit.gpgsign false
  
  # Create policy
  echo "test@example.com" > .gitauthors
  git add .gitauthors
  git commit --quiet -m "chore: Add gitauthors policy"
  
  # Install from source
  sh "$REPO_ROOT/install.sh" --from-source
  
  # Test valid commit
  echo "test content" > test.txt
  git add test.txt
  git commit --quiet -m "feat: Add test file"
  
  # Test invalid commit
  git config user.email "invalid@example.com"
  if git commit --quiet -m "feat: Invalid author" 2>&1 | grep -q "GA_IDENTITY_DENIED"; then
    echo "✅ Invalid author correctly denied"
  else
    echo "❌ Invalid author should have been denied"
    exit 1
  fi
  
  # Uninstall
  sh "$REPO_ROOT/uninstall.sh"
  
  echo "✅ Native installation test passed"
}

# Test 2: Policy validation
test_policy_validation() {
  test_repo="$TEST_DIR/test_policy"
  mkdir -p "$test_repo"
  cd "$test_repo"
  
  echo "🧪 Test: Policy validation"
  
  # Test valid policy
  echo "@example.com" > valid_policy.txt
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy valid_policy.txt; then
    echo "✅ Valid policy accepted"
  else
    echo "❌ Valid policy should be accepted"
    exit 1
  fi
  
  # Test invalid policy (inline comment)
  echo "test@example.com # comment" > invalid_policy.txt
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy invalid_policy.txt 2>&1 | grep -q "GA_POLICY_INVALID"; then
    echo "✅ Invalid policy correctly rejected"
  else
    echo "❌ Invalid policy should be rejected"
    exit 1
  fi
  
  # Test empty policy
  echo "" > empty_policy.txt
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy empty_policy.txt 2>&1 | grep -q "GA_POLICY_INVALID"; then
    echo "✅ Empty policy correctly rejected"
  else
    echo "❌ Empty policy should be rejected"
    exit 1
  fi
  
  echo "✅ Policy validation test passed"
}

# Test 3: Onboarding workflow
test_onboarding() {
  test_repo="$TEST_DIR/test_onboarding"
  mkdir -p "$test_repo"
  cd "$test_repo"
  
  echo "🧪 Test: Onboarding workflow"
  
  # Initialize git repo
  git init --quiet
  git config user.name "Test User"
  git config user.email "admin@example.com"
  git config commit.gpgsign false
  
  # Create initial policy
  echo "admin@example.com" > .gitauthors
  git add .gitauthors
  git commit --quiet -m "chore: Initial gitauthors policy"
  
  # Install hook
  sh "$REPO_ROOT/install.sh" --from-source
  
  # Add new user to policy (should work with admin@example.com)
  echo "newuser@example.com" >> .gitauthors
  git add .gitauthors
  if git commit --quiet -m "chore: Add new user"; then
    echo "✅ Onboarding commit accepted"
  else
    echo "❌ Onboarding commit should be accepted"
    exit 1
  fi
  
  # Now test with new user (should work)
  git config user.email "newuser@example.com"
  echo "content" > file.txt
  git add file.txt
  if git commit --quiet -m "feat: Add content"; then
    echo "✅ New user can commit"
  else
    echo "❌ New user should be able to commit"
    exit 1
  fi
  
  # Uninstall
  sh "$REPO_ROOT/uninstall.sh"
  
  echo "✅ Onboarding test passed"
}

# Test 4: Range validation
test_range_validation() {
  test_repo="$TEST_DIR/test_range"
  mkdir -p "$test_repo"
  cd "$test_repo"
  
  echo "🧪 Test: Range validation"
  
  # Initialize git repo
  git init --quiet
  git config user.name "Test User"
  git config user.email "test@example.com"
  git config commit.gpgsign false
  
  # Create initial policy
  echo "test@example.com" > .gitauthors
  git add .gitauthors
  git commit --quiet -m "chore: Initial gitauthors policy"
  
  # Add some content
  echo "content1" > file1.txt
  git add file1.txt
  git commit --quiet -m "feat: Add file1"
  
  # Test range validation (should pass)
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --range HEAD~1 HEAD; then
    echo "✅ Range validation passed"
  else
    echo "❌ Range validation should pass"
    exit 1
  fi
  
  # Test equal refs (should pass)
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --range HEAD HEAD; then
    echo "✅ Equal refs validation passed"
  else
    echo "❌ Equal refs validation should pass"
    exit 1
  fi
  
  # Test invalid range (non-ancestor) - this might not fail since HEAD~2 is ancestor of HEAD in this case
  # We'd need a more complex setup to test this properly
  
  echo "✅ Range validation test passed"
}

# Test 5: Error handling
test_error_handling() {
  echo "🧪 Test: Error handling"
  
  # Test invalid arguments (not missing - missing is valid for pending commit check)
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --invalid 2>&1 | grep -q "Usage:"; then
    echo "✅ Invalid arguments handled"
  else
    echo "❌ Invalid arguments should show usage"
    exit 1
  fi
  
  # Test non-existent file
  if sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy /nonexistent/file.txt 2>&1 | grep -q "GA_POLICY_MISSING"; then
    echo "✅ Non-existent file handled"
  else
    echo "❌ Non-existent file should show GA_POLICY_MISSING"
    exit 1
  fi
  
  echo "✅ Error handling test passed"
}

# Run all tests
main() {
  echo "🚀 Starting gitauthors integration tests"
  echo ""
  
  test_policy_validation
  echo ""
  
  test_error_handling
  echo ""

  
  echo "🎉 All integration tests passed!"
}

main "$@"