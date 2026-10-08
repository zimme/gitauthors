// prepare-hook.cjs - Auto-install git hook on npm install
const { execSync } = require('child_process');

try {
  execSync('sh install.sh --from-source', { stdio: 'inherit' });
} catch (error) {
  // Silently fail in environments where installation isn't possible
  // (e.g., no git, no write access, CI with HUSKY=0, already installed)
  process.exit(0);
}
