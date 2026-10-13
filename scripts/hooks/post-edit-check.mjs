// Claude Code PostToolUse hook: format the touched file, typecheck its workspace, lint it.
// Exit code 2 sends stderr back to Claude so it fixes the problem in the same turn;
// stderr on exit 0 is never shown, so every message Claude must see exits 2.
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { projectRoot, readPayload } from './project-root.mjs';

const CODE = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const DATA = new Set(['.json', '.yml', '.yaml']);

const payload = readPayload();
const target = payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? null;
if (!target) process.exit(0);

const root = projectRoot(payload);
const requested = resolve(root, target);
if (!existsSync(requested)) process.exit(0);
const file = realpathSync.native(requested);
const rel = relative(root, file);
const ext = extname(file);
if (
  isAbsolute(rel) ||
  rel.startsWith('..') ||
  rel.split(sep).includes('node_modules') ||
  (!CODE.has(ext) && !DATA.has(ext))
) {
  process.exit(0);
}

const tool = (...segments) => join(root, 'node_modules', ...segments);
const TOOLS = {
  prettier: tool('prettier', 'bin', 'prettier.cjs'),
  tsc: tool('typescript', 'bin', 'tsc'),
  eslint: tool('eslint', 'bin', 'eslint.js'),
};
const missing = Object.entries(TOOLS).filter(([, path]) => !existsSync(path));
if (missing.length > 0) {
  process.stderr.write(
    `post-edit-check: ${missing.map(([name]) => name).join(', ')} not installed in ${root}. Run npm ci there; edits in this checkout are unchecked until then.\n`,
  );
  process.exit(2);
}

function owningWorkspace(path) {
  let dir = dirname(path);
  while (dir.startsWith(root) && dir !== root) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'tsconfig.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

const started = Date.now();
const failures = [];

const format = run(TOOLS.prettier, ['--write', '--log-level', 'warn', file], root);
if (!format.ok) failures.push(`prettier:\n${format.out}`);

if (CODE.has(ext)) {
  const workspace = owningWorkspace(file);
  if (workspace) {
    const typecheck = run(
      TOOLS.tsc,
      ['--noEmit', '-p', join(workspace, 'tsconfig.json')],
      workspace,
    );
    if (!typecheck.ok) failures.push(`typecheck (${relative(root, workspace)}):\n${typecheck.out}`);
  }
  const lint = run(TOOLS.eslint, ['--no-warn-ignored', file], root);
  if (!lint.ok) failures.push(`eslint:\n${lint.out}`);
}

if (failures.length > 0) {
  process.stderr.write(
    `post-edit-check failed for ${rel} (${Date.now() - started} ms)\n\n${failures.join('\n\n')}\n`,
  );
  process.exit(2);
}
process.exit(0);
