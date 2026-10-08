#!/usr/bin/env node
// Test packages script for gitauthors
// Validates that npm and JSR package structures are correct

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

function main() {
  console.log('Testing package structures...');
  
  // Check npm package structure
  const npmPackagePath = resolve(repoRoot, 'dist', 'npm', 'package.json');
  if (!existsSync(npmPackagePath)) {
    console.error('GA_GIT_ERROR: npm package.json not found in dist/npm');
    process.exit(2);
  }
  
  const npmPkg = JSON.parse(readFileSync(npmPackagePath, 'utf8'));
  
  // Validate required fields
  if (!npmPkg.name) {
    console.error('GA_POLICY_INVALID: npm package missing name');
    process.exit(2);
  }
  
  if (!npmPkg.version) {
    console.error('GA_POLICY_INVALID: npm package missing version');
    process.exit(2);
  }
  
  if (!npmPkg.main) {
    console.error('GA_POLICY_INVALID: npm package missing main');
    process.exit(2);
  }
  
  console.log(`npm package: ${npmPkg.name}@${npmPkg.version}`);
  
  // Check JSR config structure
  const jsrConfigPath = resolve(repoRoot, 'dist', 'jsr', 'jsr.json');
  if (!existsSync(jsrConfigPath)) {
    console.error('GA_GIT_ERROR: JSR jsr.json not found in dist/jsr');
    process.exit(2);
  }
  
  const jsrConfig = JSON.parse(readFileSync(jsrConfigPath, 'utf8'));
  
  if (!jsrConfig.name) {
    console.error('GA_POLICY_INVALID: JSR config missing name');
    process.exit(2);
  }
  
  if (!jsrConfig.version) {
    console.error('GA_POLICY_INVALID: JSR config missing version');
    process.exit(2);
  }
  
  console.log(`JSR package: ${jsrConfig.name}@${jsrConfig.version}`);
  
  // Check that hook exists in dist
  const hookPath = resolve(repoRoot, 'dist', 'npm', 'hooks', 'gitauthors.sh');
  if (!existsSync(hookPath)) {
    console.error('GA_GIT_ERROR: gitauthors.sh not found in dist/npm/hooks');
    process.exit(2);
  }
  
  console.log('Package structure tests passed');
}

main();
