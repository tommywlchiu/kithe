import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function readPayload() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

// The checkout the session is working in: the payload cwd's git root, so a worktree session
// checks the worktree, not the main checkout that CLAUDE_PROJECT_DIR points at.
// realpathSync.native restores the canonical drive-letter casing on Windows; a lowercase
// c:\ makes Node load one file as two modules (vitest then fails every suite).
export function projectRoot(payload) {
  const fallback =
    process.env.CLAUDE_PROJECT_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const cwd = payload?.cwd && existsSync(payload.cwd) ? payload.cwd : fallback;
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  const root = top.status === 0 ? top.stdout.trim() : fallback;
  return realpathSync.native(root);
}
