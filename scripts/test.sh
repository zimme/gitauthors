#!/bin/bash
# Unit test script for gitauthors using Bats
# Creates isolated test environments for each test case

set -e

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"

# Create test directory
TEST_DIR=$(mktemp -d)
trap "rm -rf \"$TEST_DIR\"" EXIT

echo "Running unit tests with Bats..."

# Check if bats is available
if ! command -v bats >/dev/null 2>&1; then
  echo "Bats not found, skipping unit tests"
  exit 0
fi

# Create test file if it doesn't exist
if [ ! -f "test/unit/gitauthors.bats" ]; then
  echo "No unit tests found, creating basic tests..."
  create_basic_tests
fi

# Run tests
bats test/unit/ || {
  echo "Unit tests failed"
  exit 1
}

echo "Unit tests completed"

create_basic_tests() {
  mkdir -p test/unit
  cat > test/unit/gitauthors.bats << 'EOF'
#!/usr/bin/env bats

@test "Valid policy with email" {
  local test_dir=$(mktemp -d)
  cd "$test_dir"
  
  git init --quiet
  git config user.name "Test User"
  git config user.email "test@example.com"
  git config commit.gpgsign false
  
  echo "test@example.com" > .gitauthors
  
  # This should succeed
  run sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy .gitauthors
  [ "$status" -eq 0 ]
}

@test "Invalid policy with inline comment" {
  local test_dir=$(mktemp -d)
  cd "$test_dir"
  
  echo "test@example.com # comment" > invalid_policy.txt
  
  # This should fail
  run sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy invalid_policy.txt
  [ "$status" -eq 2 ]
  [[ "$output" == *"GA_POLICY_INVALID"* ]]
}

@test "Empty policy" {
  local test_dir=$(mktemp -d)
  cd "$test_dir"
  
  echo "" > empty_policy.txt
  
  # This should fail
  run sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy empty_policy.txt
  [ "$status" -eq 2 ]
  [[ "$output" == *"GA_POLICY_INVALID"* ]]
}

@test "Valid domain policy" {
  local test_dir=$(mktemp -d)
  cd "$test_dir"
  
  echo "@example.com" > .gitauthors
  
  # This should succeed
  run sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy .gitauthors
  [ "$status" -eq 0 ]
}

@test "Policy with comments and empty lines" {
  local test_dir=$(mktemp -d)
  cd "$test_dir"
  
  cat > .gitauthors << 'POLICY'
# This is a comment

@example.com

# Another comment
user@example.com
  POLICY
  
  # This should succeed
  run sh "$REPO_ROOT/hooks/gitauthors.sh" --validate-policy .gitauthors
  [ "$status" -eq 0 ]
}
EOF
  echo "Created basic tests in test/unit/gitauthors.bats"
}