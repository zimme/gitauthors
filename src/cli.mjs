#!/usr/bin/env node
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
}