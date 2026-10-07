#!/usr/bin/env node
// Husky install script for gitauthors
// Sets up Husky hooks for development

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

try {
  // Only install in the gitauthors repository
  const repoRoot = resolve(process.cwd());
  
  // Check if this is the gitauthors repo by looking for .release.env
  if (!existsSync(resolve(repoRoot, '.release.env'))) {
    console.log('Not a gitauthors repository, skipping Husky setup');
    process.exit(0);
  }
  
  // Install Husky hooks
  execSync('husky install', { stdio: 'inherit' });
  
  // Set up pre-commit hook
  const huskyDir = resolve(repoRoot, '.husky');
  const preCommitHook = resolve(huskyDir, 'pre-commit');
  
  // Create pre-commit hook that runs gitauthors validation
  const hookContent = `#!/bin/sh
# Husky pre-commit hook for gitauthors development

# Run gitauthors validation
sh hooks/gitauthors.sh || exit $?

# Run formatting checks
npm run format:check || exit $?

# Run tests
npm run test:unit || exit $?
`;
  
  // Write the hook file
  require('fs').writeFileSync(preCommitHook, hookContent);
  require('fs').chmodSync(preCommitHook, 0o755);
  
  // Set up commit-msg hook for commitlint
  const commitMsgHook = resolve(huskyDir, 'commit-msg');
  const commitMsgContent = `#!/bin/sh
# Husky commit-msg hook for commitlint

./node_modules/.bin/commitlint --edit "$1"
`;
  
  require('fs').writeFileSync(commitMsgHook, commitMsgContent);
  require('fs').chmodSync(commitMsgHook, 0o755);
  
  console.log('Husky hooks installed successfully');
  
} catch (error) {
  console.error('Failed to install Husky hooks:', error.message);
  process.exit(1);
}