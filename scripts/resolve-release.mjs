#!/usr/bin/env node
// Resolve release - validates and outputs release parameters
// Does NOT commit, tag, or publish

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/**
 * Reads version from .release.env
 */
function readReleaseVersion() {
  const releaseEnvPath = resolve(repoRoot, '.release.env');
  if (!existsSync(releaseEnvPath)) {
    throw new Error('GA_GIT_ERROR: .release.env not found');
  }
  
  const content = readFileSync(releaseEnvPath, 'utf8');
  const versionMatch = content.match(/^VERSION=([^\s\n]+)/m);
  if (!versionMatch) {
    throw new Error('GA_POLICY_INVALID: VERSION not found in .release.env');
  }
  
  return versionMatch[1];
}

/**
 * Gets GitHub SHA from environment or current HEAD
 */
function getGitHubSha() {
  // Check if GITHUB_SHA is provided (GitHub Actions)
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }
  
  // Fall back to current HEAD
  try {
    return execSync('git rev-parse HEAD', { 
      cwd: repoRoot, 
      encoding: 'utf8' 
    }).trim();
  } catch (error) {
    throw new Error(`GA_GIT_ERROR: Could not get Git SHA: ${error.message}`);
  }
}

/**
 * Gets the latest completed stable release version
 */
function getLatestCompletedStable() {
  try {
    const tags = execSync('git tag -l v* --sort=-version:refname', { 
      cwd: repoRoot, 
      encoding: 'utf8' 
    }).trim().split('\n');
    
    const stableTags = tags.filter(tag => {
      const version = tag.replace(/^v/, '');
      return !version.includes('-rc') && /^\d+\.\d+\.0$/.test(version);
    });
    
    if (stableTags.length === 0) {
      return null; // No completed stable releases
    }
    
    return stableTags[0].replace(/^v/, '');
    
  } catch (error) {
    // If we can't get tags, assume no previous releases
    return null;
  }
}

/**
 * Validates version format
 */
function validateVersion(version) {
  const validPattern = /^\d+\.\d+\.0(-rc\.\d+)?$/;
  if (!validPattern.test(version)) {
    throw new Error(`GA_POLICY_INVALID: Invalid version format: ${version}. Must be MAJOR.MINOR.0 or MAJOR.MINOR.0-rc.N`);
  }
  
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(`GA_POLICY_INVALID: Version must have exactly 3 parts: ${version}`);
  }
  
  const patch = parts[2];
  if (patch !== '0') {
    if (!patch.startsWith('0-rc.')) {
      throw new Error(`GA_POLICY_INVALID: Patch must be 0 or 0-rc.N: ${version}`);
    }
  }
  
  return true;
}

/**
 * Determines the release channel from version
 */
function getChannelFromVersion(version) {
  if (version.includes('-rc.')) {
    return 'prerelease';
  }
  return 'stable';
}

/**
 * Main function
 */
function main() {
  try {
    const args = process.argv.slice(2);
    const channelArg = args.find(arg => arg.startsWith('--channel='));
    const versionArg = args.find(arg => arg.startsWith('--version='));
    const shaArg = args.find(arg => arg.startsWith('--source-sha='));
    
    // Determine channel
    let channel = 'prerelease'; // default
    if (channelArg) {
      channel = channelArg.split('=')[1];
      if (channel !== 'stable' && channel !== 'prerelease') {
        throw new Error(`GA_POLICY_INVALID: Unknown channel: ${channel}. Use 'stable' or 'prerelease'`);
      }
    }
    
    // Get version from .release.env or argument
    let version;
    if (versionArg) {
      version = versionArg.split('=')[1];
    } else {
      version = readReleaseVersion();
    }
    
    // Get SHA from environment or argument
    let sourceSha;
    if (shaArg) {
      sourceSha = shaArg.split('=')[1];
    } else {
      sourceSha = getGitHubSha();
    }
    
    // Validate version
    validateVersion(version);
    
    // Check channel consistency
    const versionChannel = getChannelFromVersion(version);
    if (versionChannel !== channel) {
      throw new Error(`GA_POLICY_INVALID: Version ${version} is ${versionChannel} but requested channel is ${channel}`);
    }
    
    // For stable releases, check that we have a completed stable baseline
    if (channel === 'stable') {
      const latestStable = getLatestCompletedStable();
      if (!latestStable) {
        // No previous stable release - this is the first one
        if (version !== '1.0.0') {
          throw new Error(`GA_POLICY_INVALID: First stable release must be 1.0.0, got ${version}`);
        }
      } else {
        // Check that this is the next stable version
        const latestMajor = parseInt(latestStable.split('.')[0], 10);
        const latestMinor = parseInt(latestStable.split('.')[1], 10);
        const versionMajor = parseInt(version.split('.')[0], 10);
        const versionMinor = parseInt(version.split('.')[1], 10);
        
        if (versionMajor < latestMajor || 
            (versionMajor === latestMajor && versionMinor <= latestMinor)) {
          throw new Error(`GA_POLICY_INVALID: Stable version ${version} is not greater than latest ${latestStable}`);
        }
      }
    }
    
    // Output results
    console.log(`Channel: ${channel}`);
    console.log(`Version: ${version}`);
    console.log(`Source SHA: ${sourceSha}`);
    
    // Set GitHub outputs
    console.log(`channel=${channel}`);
    console.log(`version=${version}`);
    console.log(`source_sha=${sourceSha}`);
    
    // Validate that we can read the source SHA
    try {
      execSync('git cat-file -t ' + sourceSha, { 
        cwd: repoRoot,
        stdio: 'pipe'
      });
      console.log(`✅ Source SHA ${sourceSha} is valid`);
    } catch (error) {
      throw new Error(`GA_GIT_ERROR: Invalid source SHA ${sourceSha}: ${error.message}`);
    }
    
    console.log('✅ Release resolved successfully');
    
  } catch (error) {
    console.error(`GA_GIT_ERROR: ${error.message}`);
    process.exit(2);
  }
}

main();