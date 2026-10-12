// Claude Code Stop hook: run the test suite, but only when the working tree changed since
// the last green run, so conversational turns cost nothing. Exit code 2 keeps Claude
// working on the failure; `stop_hook_active` guards against looping on the same failure.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// realpathSync.native restores the canonical drive-letter casing on Windows. Claude Code can
// hand hooks a lowercase drive (c:\...), and Node then loads vitest's runner twice as two
// module instances, which fails every suite with "Cannot read properties of undefined".
const root = realpathSync.native(
  process.env.CLAUDE_PROJECT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
);
const stamp = join(root, '.cache', 'on-stop.hash');
const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function git(args, maxBuffer = 1024 * 1024) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer });
  return result.status === 0 ? (result.stdout ?? '') : null;
}

const payload = readPayload();
if (payload?.stop_hook_active) process.exit(0);
if (!existsSync(vitest)) process.exit(0);

const status = git(['status', '--porcelain', '--untracked-files=all']);
const head = git(['rev-parse', 'HEAD']);
if (status === null || head === null) process.exit(0);

const diff = git(['diff', 'HEAD'], 64 * 1024 * 1024) ?? '';
const untrackedStats = status
  .split('\n')
  .filter((line) => line.startsWith('?? '))
  .map((line) => line.slice(3).trim())
  .map((path) => {
    try {
      const s = statSync(join(root, path));
      return `${path}:${s.size}:${s.mtimeMs}`;
    } catch {
      return path;
    }
  })
  .join('\n');

const key = createHash('sha1')
  .update(head)
  .update(status)
  .update(diff)
  .update(untrackedStats)
  .digest('hex');

let previous = '';
try {
  previous = readFileSync(stamp, 'utf8').trim();
} catch {
  previous = '';
}
if (previous === key) process.exit(0);

const tests = spawnSync(process.execPath, [vitest, 'run'], { cwd: root, encoding: 'utf8' });
if (tests.status === 0) {
  mkdirSync(dirname(stamp), { recursive: true });
  writeFileSync(stamp, key);
  process.exit(0);
}

const output = `${tests.stdout ?? ''}${tests.stderr ?? ''}`;
process.stderr.write(
  `tests failed on stop (node ${process.version} at ${process.execPath}, cwd ${root}):\n${output.slice(-6000)}\n`,
);
process.exit(2);
