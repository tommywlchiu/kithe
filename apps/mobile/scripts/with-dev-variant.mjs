// Runs an Expo CLI command as the development variant (adds the dev-only health write
// permission). Plain `VAR=value cmd` does not work in npm scripts on Windows.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['expo', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, APP_VARIANT: 'development' },
});
process.exit(result.status ?? 1);
