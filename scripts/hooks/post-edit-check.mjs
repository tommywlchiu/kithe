// Claude Code PostToolUse hook: format the touched file, typecheck its workspace, lint it.
// Exit code 2 sends stderr back to Claude so it fixes the problem in the same turn.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// realpathSync.native restores the canonical drive-letter casing on Windows; Claude Code can
// hand hooks a lowercase drive (c:\...), which makes Node treat one file as two modules.
const root = realpathSync.native(
  process.env.CLAUDE_PROJECT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
);

const CODE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const DATA = new Set(['.json', '.yml', '.yaml']);

const tool = (...segments) => join(root, 'node_modules', ...segments);
const TOOLS = {
  prettier: tool('prettier', 'bin', 'prettier.cjs'),
  tsc: tool('typescript', 'bin', 'tsc'),
  eslint: tool('eslint', 'bin', 'eslint.js'),
};

function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

function owningWorkspace(file) {
  let dir = dirname(file);
  while (dir.startsWith(root) && dir !== root) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'tsconfig.json'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

function run(script, args, cwd) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

const payload = readPayload();
const target = payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? null;
if (!target) process.exit(0);

const requested = resolve(root, target);
if (!existsSync(requested)) process.exit(0);
const file = realpathSync.native(requested);
const rel = relative(root, file);
const ext = extname(file);
if (
  rel.startsWith('..') ||
  rel.split(sep).includes('node_modules') ||
  (!CODE.has(ext) && !DATA.has(ext))
) {
  process.exit(0);
}

for (const [name, path] of Object.entries(TOOLS)) {
  if (!existsSync(path)) {
    process.stderr.write(`post-edit-check: ${name} not installed, run npm ci\n`);
    process.exit(0);
  }
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
    `post-edit-check failed for ${rel} (${Date.now() - started} ms, node ${process.version} at ${process.execPath}, cwd ${root})\n\n${failures.join('\n\n')}\n`,
  );
  process.exit(2);
}
process.exit(0);
