// Fixture helpers for the hand-write-detect test files: a throwaway adopted repo, a hook spawner on a private
// turn-state directory, a shell call simulated as Pre -> action -> Post, and a commit through commit-gate.
//   handWriteHarness() -> { state, scratch, spawnHook, spawnHookAsync, node, call, commit, fresh, rewrite }
// Hooks run with a CLAUDE_KIT_WRITE_SETTLE_MS of SETTLE_MS, the wait for a lagging Edit confirmation.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { ENV, HOOKS, git, identify, repo, tmpDir } from './test-harness.mjs';

export const SETTLE_MS = 1500;

export function handWriteHarness() {
  const state = tmpDir('hw-state-');
  const scratch = tmpDir('hw-scratch-');
  const hookEnv = { ...ENV, CLAUDE_KIT_TURN_STATE: state, CLAUDE_KIT_WRITE_SETTLE_MS: String(SETTLE_MS) };
  const spawnHook = (name, input, cwd) => spawnSync(process.execPath, [join(HOOKS, name)], {
    input: JSON.stringify(input), cwd, encoding: 'utf8', env: hookEnv,
  });
  const spawnHookAsync = (name, input, cwd) => new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HOOKS, name)], { cwd, env: hookEnv });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
  const node = (cwd, code) => spawnSync(process.execPath, ['--input-type=commonjs', '-e', code], { cwd, encoding: 'utf8' });
  let callId = 0;
  const call = (d, sid, command, action) => {
    const id = `t${++callId}`;
    spawnHook('hand-write-detect.mjs', { hook_event_name: 'PreToolUse', session_id: sid, tool_use_id: id, tool_input: { command } }, d);
    action();
    return spawnHook('hand-write-detect.mjs', { hook_event_name: 'PostToolUse', session_id: sid, tool_use_id: id, tool_input: { command }, tool_response: {} }, d);
  };
  const commit = (d, sid, paths) => {
    git(['add', '--', ...paths], d);
    const r = spawnHook('commit-gate.mjs', { session_id: sid, tool_input: { command: `git -C ${d} commit -m "implements KIT-T706"` } }, d);
    git(['reset', '-q'], d);
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };
  const fresh = () => {
    const d = identify(repo());
    mkdirSync(join(d, '.ai'));
    mkdirSync(join(d, 'src'));
    writeFileSync(join(d, 'src', 'a.mjs'), 'export const a = 1;\n');
    writeFileSync(join(d, 'src', 'b.mjs'), 'export const b = 2;\n');
    git(['add', '-A'], d);
    git(['commit', '-q', '-m', 'seed'], d);
    return d;
  };
  const rewrite = (d, expr) => node(d, `const fs = require('fs'); const p = 'src/' + 'a.mjs'; ${expr}`);
  return { state, scratch, spawnHook, spawnHookAsync, node, call, commit, fresh, rewrite };
}
