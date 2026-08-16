// Automated test for concurrent-session detection (hooks/live-sessions.mjs, KIT-T225) and
// its SessionStart surface: recentCommits honors the window, foreignDirty subtracts this
// turn's writes ledger, both fail open on a non-repo, and orient prints the FRESH COMMITS
// banner only when a commit landed inside the look-back.
// Run: node hooks/live-sessions.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ORIENT = fileURLToPath(new URL('./orient.mjs', import.meta.url));
const OLD_DATE = '2001-01-01T00:00:00 +0000';
const WIDE_WINDOW_MIN = 99999999;
let failures = 0;

function seedRepo({ stale = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ls-'));
  const env = stale ? { GIT_AUTHOR_DATE: OLD_DATE, GIT_COMMITTER_DATE: OLD_DATE } : {};
  const g = (args) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...env } });
  g(['init', '-q', '-b', 'main']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'other-session']);
  mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  g(['add', '-A']);
  g(['commit', '-q', '-m', 'seed']);
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();
}

function ok(name, pass, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ` — ${detail}`}`);
  if (!pass) failures++;
}

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'ls-state-'));
const { recentCommits, foreignDirty } = await import('./live-sessions.mjs');
const { recordTurnWrite } = await import('./turn-writes.mjs');

// recentCommits — window filter, author carried, non-repo fails open.
{
  const fresh = seedRepo();
  const rows = recentCommits(fresh);
  ok('recentCommits lists a just-landed commit', rows.length === 1 && rows[0].author === 'other-session', JSON.stringify(rows));

  const stale = seedRepo({ stale: true });
  ok('recentCommits drops a commit outside the window', recentCommits(stale).length === 0);
  ok('recentCommits honors a wide window', recentCommits(stale, WIDE_WINDOW_MIN).length === 1);
  ok('recentCommits fails open outside a repo', recentCommits(mkdtempSync(join(tmpdir(), 'ls-bare-'))).length === 0);
}

// foreignDirty — the writes ledger subtracts this turn's own paths.
{
  const repo = seedRepo({ stale: true });
  ok('foreignDirty is empty on a clean tree', foreignDirty(repo).length === 0);

  writeFileSync(join(repo, 'theirs.txt'), 'a\n');
  writeFileSync(join(repo, 'mine.txt'), 'b\n');
  recordTurnWrite(repo, join(repo, 'mine.txt'));
  const dirty = foreignDirty(repo);
  ok('foreignDirty keeps only paths this turn did not write', dirty.length === 1 && dirty[0] === 'theirs.txt', JSON.stringify(dirty));
  ok('foreignDirty fails open outside a repo', foreignDirty(mkdtempSync(join(tmpdir(), 'ls-bare2-'))).length === 0);
}

// orient — the SessionStart banner.
function orient(cwd) {
  const r = spawnSync(process.execPath, [ORIENT], {
    cwd,
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' },
  });
  return (r.stdout || '') + (r.stderr || '');
}
{
  const fresh = seedRepo();
  ok('orient flags fresh commits as a possible other live session', /FRESH COMMITS/.test(orient(fresh)));

  const stale = seedRepo({ stale: true });
  ok('orient stays quiet when nothing landed recently', !/FRESH COMMITS/.test(orient(stale)));
}

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
