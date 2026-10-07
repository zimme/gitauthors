#!/usr/bin/env node
// Version management utilities for gitauthors

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/**
 * Reads the current version from .release.env
 * @returns {string} The current version
 */
export function getVersion() {
  const releaseEnvPath = resolve(repoRoot, '.release.env');
  if (!existsSync(releaseEnvPath)) {
    throw new Error('GA_GIT_ERROR: .release.env not found');
  }
  
  const content = readFileSync(releaseEnvPath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    
    const [key, value] = trimmed.split('=');
    if (key === 'VERSION') {
      return value;
    }
  }
  
  throw new Error('GA_POLICY_INVALID: VERSION not found in .release.env');
}

/**
 * Validates a version string
 * @param {string} version - Version to validate
 * @returns {boolean} True if valid
 */
export function validateVersion(version) {
  // Must be MAJOR.MINOR.0 or MAJOR.MINOR.0-rc.NUMBER
  const validPattern = /^\d+\.\d+\.0(-rc\.\d+)?$/;
  return validPattern.test(version);
}

/**
 * Bumps version according to ComVer rules
 * @param {string} currentVersion - Current version
 * @param {'major' | 'minor'} bumpType - Type of bump
 * @returns {string} New version
 */
export function bumpVersion(currentVersion, bumpType) {
  if (!validateVersion(currentVersion)) {
    throw new Error(`GA_POLICY_INVALID: Invalid version format: ${currentVersion}`);
  }
  
  const match = currentVersion.match(/^(\d+)\.(\d+)\.0(-rc\.\d+)?$/);
  if (!match) {
    throw new Error(`GA_POLICY_INVALID: Cannot parse version: ${currentVersion}`);
  }
  
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  
  if (bumpType === 'major') {
    return `${major + 1}.0.0`;
  } else if (bumpType === 'minor') {
    return `${major}.${minor + 1}.0`;
  } else {
    throw new Error(`GA_POLICY_INVALID: Unknown bump type: ${bumpType}`);
  }
}

// Main function for CLI usage
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(getVersion());
  } else if (args[0] === '--bump') {
    const bumpType = args[1];
    if (bumpType !== 'major' && bumpType !== 'minor') {
      console.error(`GA_POLICY_INVALID: Unknown bump type: ${bumpType}`);
      process.exit(2);
    }
    const current = getVersion();
    const next = bumpVersion(current, bumpType);
    console.log(next);
  } else if (args[0] === '--validate') {
    const version = args[1] || getVersion();
    if (validateVersion(version)) {
      console.log('Version is valid');
      process.exit(0);
    } else {
      console.error(`GA_POLICY_INVALID: Invalid version: ${version}`);
      process.exit(2);
    }
  } else {
    console.error('Usage: node scripts/version.mjs [--bump major|minor] [--validate [version]]');
    process.exit(2);
  }
}

main();