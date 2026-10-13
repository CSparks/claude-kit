// shell-writes (KIT-T436): a file a Bash/node call changed joins the session's writes ledger so
// commit-gate (KIT-T407) passes it without [commit-foreign]; a file changed outside any session
// call, or inside another session's call, still blocks. Run: node hooks/shell-writes.test.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { ENV, HOOKS, adopted, cleanup, git, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('shell-writes');
const CLOCK_GAP_MS = 300;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const wired = (event) => wiring.hooks[event].some((e) => /Bash/.test(e.matcher) && e.hooks.some((h) => h.command.includes('shell-writes')));
  ok('wired for PreToolUse and PostToolUse on Bash|PowerShell', wired('PreToolUse') && wired('PostToolUse'));

  const state = tmpDir('sw-state-');
  const spawnHook = (name, input, cwd) => spawnSync(process.execPath, [join(HOOKS, name)], {
    input: typeof input === 'string' ? input : JSON.stringify(input), cwd, encoding: 'utf8', env: { ...ENV, CLAUDE_KIT_TURN_STATE: state },
  });
  const shell = (d, session, id, action) => {
    spawnHook('shell-writes.mjs', { hook_event_name: 'PreToolUse', session_id: session, tool_use_id: id, tool_input: { command: 'node edit.js' } }, d);
    action();
    return spawnHook('shell-writes.mjs', { hook_event_name: 'PostToolUse', session_id: session, tool_use_id: id, tool_input: { command: 'node edit.js' }, tool_response: {} }, d);
  };
  const nodeWrite = (d, file) => spawnSync(process.execPath, ['--input-type=commonjs', '-e', `require('fs').writeFileSync(${JSON.stringify(join(d, file))}, 'export const z = 3;')`]);
  const gate = (d, session) => {
    const r = spawnHook('commit-gate.mjs', { session_id: session, tool_input: { command: `git -C ${d} commit -m "implements KIT-T436"` } }, d);
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  };

  const d = adopted();
  writeFileSync(join(d, 'seed.js'), 'export const s = 0;\n');
  spawnHook('pre-write.mjs', { session_id: 'A', tool_input: { file_path: join(d, 'seed.js'), content: 'export const s = 0;\n' } }, d);

  writeFileSync(join(d, 'theirs.js'), 'export const y = 2;\n');
  await sleep(CLOCK_GAP_MS);
  shell(d, 'B', 'b1', () => nodeWrite(d, 'bs.js'));
  shell(d, 'A', 'a1', () => nodeWrite(d, 'viaNode.js'));

  git(['add', 'seed.js', 'viaNode.js'], d);
  let r = gate(d, 'A');
  ok('a file a node script wrote in this session passes without [commit-foreign]', r.code === 0, r.out.trim());

  git(['add', 'theirs.js'], d);
  r = gate(d, 'A');
  ok('NEGATIVE CONTROL: a file changed outside any session call still blocks and is named', r.code === 2 && r.out.includes('theirs.js') && !r.out.includes('viaNode.js'), r.out.trim());

  git(['reset', '-q', 'theirs.js'], d);
  git(['add', 'bs.js'], d);
  r = gate(d, 'A');
  ok("a file another session's call wrote still blocks", r.code === 2 && r.out.includes('bs.js'), r.out.trim());

  const un = repo();
  writeFileSync(join(un, 'x.js'), 'x\n');
  const before = readdirSync(state).length;
  shell(un, 'A', 'u1', () => nodeWrite(un, 'x.js'));
  ok('unadopted repo: no ledger written', readdirSync(state).length === before);

  ok('malformed stdin fails open', spawnHook('shell-writes.mjs', '{not json', d).status === 0);
  ok('a post with no matching pre records nothing and exits 0', shell(d, 'A', 'a2', () => {}).status === 0);
} finally {
  cleanup();
}

done();
