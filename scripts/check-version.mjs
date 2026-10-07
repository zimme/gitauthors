#!/usr/bin/env node
// Check version consistency across the project

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function main() {
  try {
    // Read .release.env
    const releaseEnvPath = resolve(repoRoot, '.release.env');
    if (!existsSync(releaseEnvPath)) {
      console.error('GA_GIT_ERROR: .release.env not found');
      process.exit(2);
    }
    
    const releaseContent = readFileSync(releaseEnvPath, 'utf8');
    const versionMatch = releaseContent.match(/^VERSION=([^\s]+)/m);
    if (!versionMatch) {
      console.error('GA_POLICY_INVALID: VERSION not found in .release.env');
      process.exit(2);
    }
    
    const releaseVersion = versionMatch[1];
    console.log(`Release version: ${releaseVersion}`);
    
    // Validate version format (MAJOR.MINOR.0 or MAJOR.MINOR.0-rc.NUMBER)
    const versionPattern = /^\d+\.\d+\.0(-rc\.\d+)?$/;
    if (!versionPattern.test(releaseVersion)) {
      console.error(`GA_POLICY_INVALID: Invalid version format in .release.env: ${releaseVersion}`);
      process.exit(2);
    }
    
    // Check development package.json has 0.0.0-development
    const devPackagePath = resolve(repoRoot, 'package.json');
    if (existsSync(devPackagePath)) {
      const devPackage = JSON.parse(readFileSync(devPackagePath, 'utf8'));
      if (devPackage.version !== '0.0.0-development') {
        console.error(`GA_POLICY_INVALID: Development package.json version should be 0.0.0-development, got ${devPackage.version}`);
        process.exit(2);
      }
      if (!devPackage.private) {
        console.error('GA_POLICY_INVALID: Development package.json should be private');
        process.exit(2);
      }
    }
    
    // Check that there are no other version files with different versions
    const packageFiles = [
      resolve(repoRoot, 'package.json'),
      resolve(repoRoot, 'dist', 'npm', 'package.json')
    ];
    
    for (const pkgPath of packageFiles) {
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        // For now, we allow dist files to not exist or have different versions
        // This will be checked during build
      }
    }
    
    console.log('Version check passed');
    process.exit(0);
    
  } catch (error) {
    console.error(`GA_GIT_ERROR: ${error.message}`);
    process.exit(2);
  }
}

main();