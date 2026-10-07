// commitlint configuration for gitauthors
// Extends config-conventional with project-specific rules

import conventionalConfig from '@commitlint/config-conventional';

export default {
  ...conventionalConfig,
  rules: {
    ...conventionalConfig.rules,
    // Disallow subject case requirements (we don't care about case)
    'subject-case': [0],
    // Header max length 100 characters
    'header-max-length': [2, 'always', 100],
    // Allow specific types only
    'type-enum': [2, 'always', [
      'build',
      'chore',
      'ci',
      'docs',
      'feat',
      'fix',
      'perf',
      'refactor',
      'revert',
      'style',
      'test'
    ]]
  }
};