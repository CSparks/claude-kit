// Automated test for the tree-liveness guard (hooks/tree-liveness.mjs, KIT-T219).
// WARN (exit 0 + stderr) on a Write/Edit into ANOTHER repo that looks live — a commit inside
// the window, or dirty paths this turn did not write. Silent for the session's own repo, a
// quiet foreign repo, dirt this turn authored, the escape token, an unadopted pair, and any
// malformed/non-git input (fail-open). Also covers the once-per-repo-per-turn dedupe.
// Run: node hooks/tree-liveness.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./tree-liveness.mjs', import.meta.url));
const OLD_DATE = '2001-01-01T00:00:00 +0000';
let failures = 0;

function seedRepo({ adopt = true, stale = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'tl-'));
  const env = stale ? { GIT_AUTHOR_DATE: OLD_DATE, GIT_COMMITTER_DATE: OLD_DATE } : {};
  const g = (args) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...env } });
  g(['init', '-q', '-b', 'main']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 't']);
  if (adopt) mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  g(['add', '-A']);
  g(['commit', '-q', '-m', 'seed']);
  // git's own spelling of the root — the hook keys turn state by it, and a Windows temp dir
  // reaches the test under its 8.3 short name.
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();
}

function turnStateDir() {
  return mkdtempSync(join(tmpdir(), 'tl-state-'));
}

function run(cwd, filePath, { state, env = {}, tool = 'Write' } = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd,
    input: JSON.stringify({ tool_name: tool, tool_input: { file_path: filePath } }),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_KIT_ALLOW_LIVE_TREE: '',
      CLAUDE_KIT_LIVE_TREE_MINUTES: '',
      CLAUDE_PLUGIN_ROOT: '',
      CLAUDE_KIT_TURN_STATE: state || turnStateDir(),
      ...env,
    },
  });
  return { code: r.status, err: r.stderr || '' };
}

function ok(name, pass, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : ` — ${detail}`}`);
  if (!pass) failures++;
}

const warned = (r) => r.code === 0 && /KIT-T219/.test(r.err);

// 1. Fresh commit in a foreign repo → warn.
{
  const session = seedRepo();
  const foreign = seedRepo();
  const r = run(session, join(foreign, 'f.txt'));
  ok('warns on a foreign repo with a fresh commit', warned(r) && /HEAD /.test(r.err), JSON.stringify(r));
}

// 2. Quiet foreign repo (old commit, clean tree) → silent.
{
  const session = seedRepo();
  const foreign = seedRepo({ stale: true });
  const r = run(session, join(foreign, 'f.txt'));
  ok('silent on a quiet foreign repo', r.code === 0 && r.err === '', JSON.stringify(r));
}

// 3. Foreign dirty path (no fresh commit) → warn naming the path.
{
  const session = seedRepo();
  const foreign = seedRepo({ stale: true });
  writeFileSync(join(foreign, 'other.txt'), 'theirs\n');
  const r = run(session, join(foreign, 'f.txt'));
  ok('warns on dirty paths this session did not write', warned(r) && /other\.txt/.test(r.err), JSON.stringify(r));
}

// 4. The same dirt, recorded in THIS turn's writes ledger → silent.
{
  const session = seedRepo();
  const foreign = seedRepo({ stale: true });
  const state = turnStateDir();
  writeFileSync(join(foreign, 'other.txt'), 'mine\n');
  process.env.CLAUDE_KIT_TURN_STATE = state;
  const { recordTurnWrite } = await import('./turn-writes.mjs');
  recordTurnWrite(foreign, join(foreign, 'other.txt'));
  const r = run(session, join(foreign, 'f.txt'), { state });
  ok('silent when the dirt is in this turn\'s writes ledger', r.code === 0 && r.err === '', JSON.stringify(r));
}

// 5. The session's OWN repo is never foreign.
{
  const session = seedRepo();
  const r = run(session, join(session, 'f.txt'));
  ok('silent for an edit inside the session repo', r.code === 0 && r.err === '', JSON.stringify(r));
}

// 6. Escape token in the captured prompt, and the env escape.
{
  const session = seedRepo();
  const foreign = seedRepo();
  const state = turnStateDir();
  process.env.CLAUDE_KIT_TURN_STATE = state;
  const { writeTurnState } = await import('./lib.mjs');
  writeTurnState(session, { prompt: 'edit it [allow-live-tree: coordinated]', ts: Date.now() }, 'request-capture');
  const r = run(session, join(foreign, 'f.txt'), { state });
  ok('silent on [allow-live-tree:] in the prompt', r.code === 0 && r.err === '', JSON.stringify(r));

  const e = run(session, join(foreign, 'f.txt'), { env: { CLAUDE_KIT_ALLOW_LIVE_TREE: '1' } });
  ok('silent on CLAUDE_KIT_ALLOW_LIVE_TREE=1', e.code === 0 && e.err === '', JSON.stringify(e));
}

// 7. Window is configurable — a wide window makes an old commit count again.
{
  const session = seedRepo();
  const foreign = seedRepo({ stale: true });
  const r = run(session, join(foreign, 'f.txt'), { env: { CLAUDE_KIT_LIVE_TREE_MINUTES: '99999999' } });
  ok('CLAUDE_KIT_LIVE_TREE_MINUTES widens the window', warned(r), JSON.stringify(r));
}

// 8. One warning per foreign repo per turn.
{
  const session = seedRepo();
  const foreign = seedRepo();
  const state = turnStateDir();
  const first = run(session, join(foreign, 'f.txt'), { state });
  const second = run(session, join(foreign, 'g.txt'), { state });
  ok('warns once per foreign repo per turn', warned(first) && second.code === 0 && second.err === '', JSON.stringify(second));
}

// 9. Neither repo adopted → no-op.
{
  const session = seedRepo({ adopt: false });
  const foreign = seedRepo({ adopt: false });
  const r = run(session, join(foreign, 'f.txt'));
  ok('no-ops when neither repo is adopted', r.code === 0 && r.err === '', JSON.stringify(r));
}

// 10. Fail-open: no path, and a target outside any git repo.
{
  const session = seedRepo();
  const none = run(session, '');
  ok('fail-open on a payload with no file path', none.code === 0 && none.err === '', JSON.stringify(none));

  const outside = run(session, join(mkdtempSync(join(tmpdir(), 'tl-bare-')), 'f.txt'));
  ok('fail-open on a target outside any git repo', outside.code === 0 && outside.err === '', JSON.stringify(outside));
}

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
