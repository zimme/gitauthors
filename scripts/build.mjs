#!/usr/bin/env node
// Build script for gitauthors
// Reads .release.env, validates version, and generates distribution files

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Read .release.env
function readReleaseEnv() {
  const releaseEnvPath = resolve(repoRoot, '.release.env');
  if (!existsSync(releaseEnvPath)) {
    console.error('GA_GIT_ERROR: .release.env not found');
    process.exit(2);
  }
  
  const content = readFileSync(releaseEnvPath, 'utf8');
  const lines = content.split('\n');
  const env = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    
    const [key, value] = trimmed.split('=');
    if (!key || !value) {
      console.error(`GA_POLICY_INVALID: Invalid line in .release.env: ${line}`);
      process.exit(2);
    }
    
    env[key] = value;
  }
  
  if (!env.VERSION) {
    console.error('GA_POLICY_INVALID: VERSION not found in .release.env');
    process.exit(2);
  }
  
  return env;
}

// Validate version format
function validateVersion(version) {
  // Must be a valid semver: MAJOR.MINOR.0 or MAJOR.MINOR.0-rc.NUMBER
  const rcVersionPattern = /^\d+\.\d+\.0-rc\.\d+$/;
  const stableVersionPattern = /^\d+\.\d+\.0$/;
  
  if (!rcVersionPattern.test(version) && !stableVersionPattern.test(version)) {
    console.error(`GA_POLICY_INVALID: Version must be MAJOR.MINOR.0 or MAJOR.MINOR.0-rc.NUMBER: ${version}`);
    process.exit(2);
  }
  
  return true;
}

// Read shell source and escape it for JavaScript
function readShellSource() {
  const hookPath = resolve(repoRoot, 'hooks', 'gitauthors.sh');
  if (!existsSync(hookPath)) {
    console.error('GA_GIT_ERROR: hooks/gitauthors.sh not found');
    process.exit(2);
  }
  
  let content = readFileSync(hookPath, 'utf8');
  
  // Remove shebang line
  content = content.replace(/^#!\/.*\n/, '');
  
  // Escape for JavaScript template literal
  // Replace backticks with escaped backticks
  content = content.replace(/`/g, '\\`');
  // Replace ${ with escaped ${ to prevent interpolation
  content = content.replace(/\${/g, '\\${');
  // Replace newlines with actual newlines (template literals preserve them)
  
  return content;
}

// Generate the ESM module with embedded shell source
function generateESMModule(version, sourceSha = '') {
  const shellContent = readShellSource();
  
  const moduleContent = `// gitauthors ESM module
// Generated from gitauthors.sh - do not edit directly

/**
 * @typedef {Object} RunHookOptions
 * @property {string} [cwd] - Working directory for the Git operation
 */

/**
 * Runs the gitauthors hook with the given arguments
 * @param {string[]} [args=[]] - Arguments to pass to the hook
 * @param {RunHookOptions} [options={}] - Options for running the hook
 * @returns {Promise<number>} The exit status code (0=success, 1=denied, 2=error)
 */
export async function runHook(args = [], options = {}) {
  const { cwd = process.cwd() } = options;
  
  try {
    const { spawnSync } = await import('child_process');
    const result = spawnSync('sh', ['-c', shellSource, 'gitauthors', ...args], {
      cwd,
      stdio: 'inherit'
    });
    
    if (result.error) {
      throw result.error;
    }
    
    return result.status ?? 0;
  } catch (error) {
    console.error(\`GA_GIT_ERROR: \${error.message}\`);
    return 2;
  }
}

// Embedded shell source for gitauthors hook
export const shellSource = \`${shellContent}\`;

export const version = '${version}';
export const sourceSha = '${sourceSha}';
`;
  
  return moduleContent;
}

// Generate CLI module
function generateCLIModule() {
  return `#!/usr/bin/env node
// gitauthors CLI adapter
// Handles both installation and hook execution

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runHook } from './mod.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments, skipping the first two (node path and script path)
const args = process.argv.slice(2);

// If no arguments or first arg is not a hook flag, run installation
if (args.length === 0 || !args[0].startsWith('--')) {
  // Try to run the install script
  const installScript = join(__dirname, '../install.sh');
  
  if (existsSync(installScript)) {
    // Run install.sh from the package root
    const result = spawnSync('sh', [installScript, '--from-source'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    process.exitCode = result.status ?? 1;
  } else {
    console.error('GA_GIT_ERROR: install.sh not found');
    process.exitCode = 2;
  }
} else {
  // Run the hook with provided arguments
  runHook(args, { cwd: process.cwd() }).then(code => {
    process.exitCode = code;
  }).catch(() => {
    process.exitCode = 2;
  });
}`;
}

// Generate package.json for npm distribution
function generatePackageJson(version) {
  return `{
  "name": "@zimme/gitauthors",
  "version": "${version}",
  "description": "Git author validation hook - mistake prevention for git commits",
  "type": "module",
  "main": "src/mod.mjs",
  "exports": {
    ".": {
      "import": "./src/mod.mjs",
      "default": "./src/mod.mjs"
    },
    "./src/mod.mjs": "./src/mod.mjs",
    "./src/cli.mjs": "./src/cli.mjs"
  },
  "bin": {
    "gitauthors": "./src/cli.mjs"
  },
  "keywords": [
    "git",
    "hook",
    "author",
    "committer",
    "validation",
    "policy"
  ],
  "author": "Simon Fridlund <simon@fridlund.email>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/zimme/gitauthors.git"
  },
  "bugs": {
    "url": "https://github.com/zimme/gitauthors/issues"
  },
  "homepage": "https://github.com/zimme/gitauthors",
  "engines": {
    "node": ">=20"
  },
  "dependencies": {},
  "files": [
    "hooks",
    "src",
    "install.sh",
    "uninstall.sh"
  ]
}`;
}

// Generate JSR configuration
function generateJSRConfig(version) {
  return `{
  "name": "@zimme/gitauthors",
  "version": "${version}",
  "description": "Git author validation hook - mistake prevention for git commits",
  "license": "MIT",
  "exports": {
    ".": "./src/mod.mjs",
    "./src/mod.mjs": "./src/mod.mjs",
    "./src/cli.mjs": "./src/cli.mjs"
  },
  "files": [
    "hooks",
    "src",
    "install.sh",
    "uninstall.sh"
  ]
}`;
}

// Main build function
function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const versionArg = args.find(arg => arg.startsWith('--version='));
  const shaArg = args.find(arg => arg.startsWith('--source-sha='));
  
  const customVersion = versionArg ? versionArg.split('=')[1] : null;
  const customSha = shaArg ? shaArg.split('=')[1] : null;
  
  // Read release environment
  const releaseEnv = readReleaseEnv();
  const version = customVersion || releaseEnv.VERSION;
  
  // Validate version
  validateVersion(version);
  
  // Get current git SHA if not provided
  const sourceSha = customSha || execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  
  // Create dist directories
  const distDirs = [
    resolve(repoRoot, 'dist'),
    resolve(repoRoot, 'dist', 'npm'),
    resolve(repoRoot, 'dist', 'jsr'),
    resolve(repoRoot, 'dist', 'release')
  ];
  
  for (const dir of distDirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
  
  console.log(`Building gitauthors v${version} from ${sourceSha}`);
  
  // Generate ESM module with embedded shell source
  const esmContent = generateESMModule(version, sourceSha);
  const modPath = resolve(repoRoot, 'dist', 'npm', 'src', 'mod.mjs');
  
  // Ensure dist directories exist
  mkdirSync(resolve(repoRoot, 'dist', 'npm', 'src'), { recursive: true });
  
  // Write ESM module
  writeFileSync(modPath, esmContent);
  console.log(`Generated ${modPath}`);
  
  // Write CLI module
  const cliContent = generateCLIModule();
  const cliPath = resolve(repoRoot, 'dist', 'npm', 'src', 'cli.mjs');
  writeFileSync(cliPath, cliContent);
  console.log(`Generated ${cliPath}`);
  
  // Copy hook script
  const hookPath = resolve(repoRoot, 'hooks', 'gitauthors.sh');
  const distHookPath = resolve(repoRoot, 'dist', 'npm', 'hooks', 'gitauthors.sh');
  mkdirSync(resolve(repoRoot, 'dist', 'npm', 'hooks'), { recursive: true });
  cpSync(hookPath, distHookPath);
  console.log(`Copied hook to ${distHookPath}`);
  
  // Generate npm package.json
  const npmPackageJson = generatePackageJson(version);
  const npmPackagePath = resolve(repoRoot, 'dist', 'npm', 'package.json');
  writeFileSync(npmPackagePath, npmPackageJson);
  console.log(`Generated ${npmPackagePath}`);
  
  // Generate JSR configuration
  const jsrConfig = generateJSRConfig(version);
  const jsrConfigPath = resolve(repoRoot, 'dist', 'jsr', 'jsr.json');
  writeFileSync(jsrConfigPath, jsrConfig);
  console.log(`Generated ${jsrConfigPath}`);
  
  // Copy ESM modules for JSR
  const jsrModPath = resolve(repoRoot, 'dist', 'jsr', 'src', 'mod.mjs');
  const jsrCliPath = resolve(repoRoot, 'dist', 'jsr', 'src', 'cli.mjs');
  mkdirSync(resolve(repoRoot, 'dist', 'jsr', 'src'), { recursive: true });
  writeFileSync(jsrModPath, esmContent);
  writeFileSync(jsrCliPath, cliContent);
  console.log(`Generated JSR modules`);
  
  // Copy hook for JSR
  const jsrHookPath = resolve(repoRoot, 'dist', 'jsr', 'hooks', 'gitauthors.sh');
  mkdirSync(resolve(repoRoot, 'dist', 'jsr', 'hooks'), { recursive: true });
  cpSync(hookPath, jsrHookPath);
  console.log(`Copied hook for JSR`);
  
  // Generate release files
  cpSync(hookPath, resolve(repoRoot, 'dist', 'release', 'gitauthors.sh'));
  console.log('Generated release hook');
  
  // Copy install.sh and uninstall.sh if they exist
  const installShPath = resolve(repoRoot, 'install.sh');
  const uninstallShPath = resolve(repoRoot, 'uninstall.sh');
  
  if (existsSync(installShPath)) {
    cpSync(installShPath, resolve(repoRoot, 'dist', 'release', 'install.sh'));
    cpSync(installShPath, resolve(repoRoot, 'dist', 'npm', 'install.sh'));
    cpSync(installShPath, resolve(repoRoot, 'dist', 'jsr', 'install.sh'));
    console.log('Copied install.sh');
  }
  
  if (existsSync(uninstallShPath)) {
    cpSync(uninstallShPath, resolve(repoRoot, 'dist', 'release', 'uninstall.sh'));
    cpSync(uninstallShPath, resolve(repoRoot, 'dist', 'npm', 'uninstall.sh'));
    cpSync(uninstallShPath, resolve(repoRoot, 'dist', 'jsr', 'uninstall.sh'));
    console.log('Copied uninstall.sh');
  }
  
  console.log('Build completed successfully');
}

main();