// gitauthors ESM module
// This module provides the shell source embedded for use with Node.js and Deno

/**
 * @typedef {Object} RunHookOptions
 * @property {string} [cwd] - Working directory for the Git operation
 */

/**
 * Runs the gitauthors hook with the given arguments
 * @param {string[]} [args=[]] - Arguments to pass to the hook
 * @param {RunHookOptions} [options={}] - Options for running the hook
 * @returns {number} The exit status code (0=success, 1=denied, 2=error)
 */
export function runHook(args = [], options = {}) {
  const { cwd = process.cwd() } = options;
  
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('sh', ['-c', shellSource, 'gitauthors', ...args], {
      cwd,
      stdio: 'inherit'
    });
    
    if (result.error) {
      throw result.error;
    }
    
    return result.status ?? 0;
  } catch (error) {
    console.error(`GA_GIT_ERROR: ${error.message}`);
    return 2;
  }
}

// Embedded shell source - will be replaced during build
export const shellSource = `// This will be replaced with the actual shell source during build
// Placeholder for gitauthors.sh content
exit 2
`;