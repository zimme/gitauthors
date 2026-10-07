#!/usr/bin/env node
// PR checks script for gitauthors
// Validates PR title, commit messages, and authors

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/**
 * Reads the GitHub event path to get PR information
 */
function getGitHubEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) {
    throw new Error('GA_GIT_ERROR: GITHUB_EVENT_PATH not set or file not found');
  }
  
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  return event;
}

/**
 * Validates a commit message using commitlint
 */
function validateCommitMessage(message) {
  try {
    // Create a temporary file with the message
    const tempFile = '/tmp/commit-msg-temp.txt';
    execSync(`echo "${message.replace(/"/g, '\\"')}" > ${tempFile}`, {
      stdio: 'pipe'
    });
    
    // Run commitlint
    execSync(`./node_modules/.bin/commitlint --edit ${tempFile}`, {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    
    return true;
  } catch (error) {
    console.error(`Invalid commit message: ${message}`);
    return false;
  }
}

/**
 * Validates commit authors using gitauthors
 */
function validateCommitAuthors(baseSha, headSha) {
  try {
    const result = execSync(`sh hooks/gitauthors.sh --range ${baseSha} ${headSha}`, {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    return true;
  } catch (error) {
    console.error(`gitauthors range validation failed for ${baseSha}..${headSha}`);
    return false;
  }
}

/**
 * Main function
 */
function main() {
  try {
    const event = getGitHubEvent();
    const pr = event.pull_request;
    const baseSha = pr.base.sha;
    const headSha = pr.head.sha;
    
    console.log(`Checking PR: ${pr.title}`);
    console.log(`Base SHA: ${baseSha}`);
    console.log(`Head SHA: ${headSha}`);
    
    // Validate PR title
    console.log('Validating PR title...');
    if (!validateCommitMessage(pr.title)) {
      console.error('PR title validation failed');
      process.exit(1);
    }
    console.log('✅ PR title is valid');
    
    // Get commits in the PR
    console.log('Getting commits...');
    const commitsResult = execSync(`git rev-list --format='%H %s' ${baseSha}..${headSha}`, {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    
    const commits = commitsResult.trim().split('\n').filter(line => line.trim() !== '');
    console.log(`Found ${commits.length} commits to validate`);
    
    // Validate each commit message
    for (const commitLine of commits) {
      const [sha, message] = commitLine.split(' ', 2);
      console.log(`Validating commit: ${sha.substring(0, 7)} ${message}`);
      
      if (!validateCommitMessage(message)) {
        console.error(`Commit message validation failed for ${sha}`);
        process.exit(1);
      }
    }
    console.log('✅ All commit messages are valid');
    
    // Validate commit authors
    console.log('Validating commit authors...');
    if (!validateCommitAuthors(baseSha, headSha)) {
      console.error('Commit author validation failed');
      process.exit(1);
    }
    console.log('✅ All commit authors are valid');
    
    // Check version consistency if version files changed
    console.log('Checking version consistency...');
    const changedFiles = execSync(`git diff --name-only ${baseSha}..${headSha}`, {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim().split('\n');
    
    const versionFilesChanged = changedFiles.some(file => 
      file.includes('.release.env') || file.includes('package.json')
    );
    
    if (versionFilesChanged) {
      console.log('Version files changed, running version check...');
      execSync('npm run check:version', {
        cwd: repoRoot,
        stdio: 'inherit'
      });
      console.log('✅ Version consistency check passed');
    } else {
      console.log('No version files changed, skipping version check');
    }
    
    console.log('✅ All PR checks passed');
    
  } catch (error) {
    console.error(`GA_GIT_ERROR: ${error.message}`);
    process.exit(1);
  }
}

main();