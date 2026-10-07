#!/usr/bin/env node
// Format script for gitauthors
// Handles formatting of JS, JSON, Markdown, and shell files

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Files/directories to format
const FORMAT_FILES = [
  'package.json',
  'commitlint.config.mjs',
  'scripts/version.mjs',
  'scripts/check-version.mjs',
  'scripts/build.mjs',
  'src/mod.mjs',
  'src/cli.mjs',
  'hooks/gitauthors.sh',
  'install.sh',
  'uninstall.sh',
  '.husky/install.mjs'
];

const FORMAT_DIRS = [
  'scripts',
  'src',
  'docs'
];

// File extensions to format with Prettier
const PRETTIER_EXTENSIONS = [
  '.mjs',
  '.json',
  '.md'
];

// Files to format with shfmt
const SHFM_FILES = [
  'hooks/gitauthors.sh',
  'install.sh',
  'uninstall.sh'
];

function getAllFiles() {
  const files = [];
  
  // Add individual files
  for (const file of FORMAT_FILES) {
    const path = resolve(repoRoot, file);
    if (existsSync(path)) {
      files.push(path);
    }
  }
  
  // Add files from directories
  for (const dir of FORMAT_DIRS) {
    const dirPath = resolve(repoRoot, dir);
    if (existsSync(dirPath)) {
      // This is a simplified approach - in production you'd use a proper file walker
      // For now, we'll just handle the main files we know about
    }
  }
  
  return files;
}

function formatWithPrettier(filePath) {
  try {
    // Use prettier to format the file
    const result = execSync(`npx prettier --write "${filePath}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log(`Formatted: ${relative(repoRoot, filePath)}`);
    return true;
  } catch (error) {
    console.error(`Failed to format: ${relative(repoRoot, filePath)}`);
    console.error(error.stderr);
    return false;
  }
}

function formatWithShfmt(filePath) {
  try {
    // Use shfmt to format shell files
    const result = execSync(`shfmt -w -s "${filePath}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    console.log(`Formatted (shfmt): ${relative(repoRoot, filePath)}`);
    return true;
  } catch (error) {
    console.error(`Failed to format with shfmt: ${relative(repoRoot, filePath)}`);
    console.error(error.stderr);
    return false;
  }
}

function checkFormatWithPrettier(filePath) {
  try {
    execSync(`npx prettier --check "${filePath}"`, {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    return true;
  } catch (error) {
    return false;
  }
}

function checkFormatWithShfmt(filePath) {
  try {
    execSync(`shfmt -d "${filePath}"`, {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    return true;
  } catch (error) {
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const checkMode = args.includes('--check') || !writeMode;
  
  let allPassed = true;
  const files = getAllFiles();
  
  for (const filePath of files) {
    const relPath = relative(repoRoot, filePath);
    
    try {
      if (SHFM_FILES.includes(relPath)) {
        if (checkMode) {
          if (!checkFormatWithShfmt(filePath)) {
            allPassed = false;
          }
        } else {
          formatWithShfmt(filePath);
        }
      } else if (PRETTIER_EXTENSIONS.some(ext => relPath.endsWith(ext))) {
        if (checkMode) {
          if (!checkFormatWithPrettier(filePath)) {
            allPassed = false;
          }
        } else {
          formatWithPrettier(filePath);
        }
      }
    } catch (error) {
      console.error(`GA_GIT_ERROR: Failed to format ${relPath}: ${error.message}`);
      allPassed = false;
    }
  }
  
  if (checkMode && !allPassed) {
    console.error('Formatting check failed');
    process.exit(1);
  }
  
  if (writeMode) {
    console.log('Formatting completed');
  }
}

main();