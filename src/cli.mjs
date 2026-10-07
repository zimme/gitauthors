#!/usr/bin/env node
// gitauthors CLI adapter
// Invokes the main gitauthors hook functionality

import { runHook } from './mod.mjs';

// Parse command line arguments, skipping the first two (node path and script path)
const args = process.argv.slice(2);

// Run the hook and set the exit code
process.exitCode = runHook(args, { cwd: process.cwd() });