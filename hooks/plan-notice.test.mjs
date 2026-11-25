// plan-notice (KIT-T1532): the first plan file a session writes in a repo with a framework crate index prints the plan-exit
// requirements once, as an advisory; no index, another path, or a second write prints nothing.
// Run: node hooks/plan-notice.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, ignoreFile, makeRepo } from './dispatch-guard-harness.mjs';

const HOOK = fileURLToPath(new URL('./plan-notice.mjs', import.meta.url));
const INDEX = ['# Crates', '', '| Crate | What it is |', '| --- | --- |', '| `rg-landform` | Far, mid and near rings. |', ''].join('\n');
const STATE = mkdtempSync(join(tmpdir(), 'plan-notice-state-'));
const PLAN_FILE = join(homedir(), '.claude', 'plans', 'ring-layout-plan.md');

function game({ index = true } = {}) {
  const dir = makeRepo();
  writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  mkdirSync(join(dir, 'rapid-game', 'docs'), { recursive: true });
  if (index) writeFileSync(join(dir, 'rapid-game', 'docs', 'CRATES.md'), INDEX);
  return dir;
}

const write = (dir, session, file = PLAN_FILE, tool = 'Write') => {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: tool, session_id: session, tool_input: { file_path: file } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_TURN_STATE: STATE },
  });
  return { code: r.status, out: r.stdout || '' };
};
const context = (r) => (r.out ? JSON.parse(r.out).hookSpecificOutput.additionalContext : '');

const repo = game();
const first = write(repo, 'sess-a');
expect('the first plan write exits 0 (advisory, never a block)', first.code, 0);
expect('the first plan write names the plan gate and the framework-checked tag form', /GATE plan/.test(context(first)) && context(first).includes('[framework-checked:') ? 1 : 0, 1);
expect('the second plan write in the same session prints nothing', write(repo, 'sess-a', PLAN_FILE, 'Edit').out, '');
expect('another session is told once too', /GATE plan/.test(context(write(repo, 'sess-b'))) ? 1 : 0, 1);
expect('a file outside ~/.claude/plans prints nothing', write(repo, 'sess-c', join(repo, 'notes.md')).out, '');
expect('the plans directory itself is not a plan file', write(repo, 'sess-d', join(homedir(), '.claude', 'plans')).out, '');
expect('no crate index: nothing printed', write(game({ index: false }), 'sess-e').out, '');
expect('a repo without the framework: nothing printed', write(makeRepo(), 'sess-f').out, '');
expect('the ignore file lifts the notice', write(ignoreFile(game(), 'framework-checked'), 'sess-g').out, '');

finish();
