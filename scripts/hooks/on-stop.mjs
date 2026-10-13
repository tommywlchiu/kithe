// Claude Code Stop hook: typecheck every workspace and run the tests, skipping when the tree
// is unchanged since the last green run. Exit 2 keeps Claude working on a failure. To avoid
// looping, a failure Claude already saw (same tree, stop_hook_active) is let through; any
// edit after it is verified again.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { projectRoot, readPayload } from './project-root.mjs';

const payload = readPayload();
const continuing = Boolean(payload?.stop_hook_active);
const root = projectRoot(payload);
const cacheDir = join(root, '.cache');
const greenStamp = join(cacheDir, 'on-stop.green');
const failStamp = join(cacheDir, 'on-stop.fail');

const vitest = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
if (!existsSync(vitest) || !existsSync(tsc)) {
  if (continuing) process.exit(0);
  process.stderr.write(`on-stop: dependencies not installed in ${root}. Run npm ci there.\n`);
  process.exit(2);
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.status === 0 ? (result.stdout ?? '') : null;
}

function treeKey() {
  const head = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain', '-z', '--untracked-files=all']);
  const diff = git(['diff', 'HEAD']);
  if (head === null || status === null || diff === null) return null;
  const untracked = status
    .split('\0')
    .filter((entry) => entry.startsWith('?? '))
    .map((entry) => {
      const path = entry.slice(3);
      try {
        const s = statSync(join(root, path));
        return `${path}:${s.size}:${s.mtimeMs}`;
      } catch {
        return path;
      }
    })
    .join('\n');
  return createHash('sha1')
    .update(head)
    .update(status)
    .update(diff)
    .update(untracked)
    .digest('hex');
}

const read = (path) => {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return '';
  }
};
const write = (path, value) => {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path, value);
};

const key = treeKey();
if (key !== null && read(greenStamp) === key) process.exit(0);
if (key !== null && continuing && read(failStamp) === key) process.exit(0);

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`,
  };
}

const failures = [];
const typecheck = spawnSync('npm', ['run', '-s', 'typecheck'], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
if (typecheck.status !== 0) {
  failures.push(`typecheck:\n${`${typecheck.stdout ?? ''}${typecheck.stderr ?? ''}`.slice(-4000)}`);
}
const tests = run(vitest, ['run']);
if (!tests.ok) failures.push(`tests:\n${tests.out.slice(-4000)}`);

if (failures.length === 0) {
  if (key !== null) write(greenStamp, key);
  process.exit(0);
}
if (key !== null) write(failStamp, key);
process.stderr.write(`checks failed on stop:\n\n${failures.join('\n\n')}\n`);
process.exit(2);
