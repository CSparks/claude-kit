// A shell call that another session's Edit overlapped never makes that file the calling session's (KIT-T953): the
// calling session's write ledger would list a file it never wrote, and the checkout holder would refuse the real
// writer's repeat edits and commits as another live session's uncommitted work (KIT-D155). Only pre-write runs for the
// writer here, as for a session started before the PostToolUse recorder was wired (KIT-T949).
// Run: node hooks/holder-shell-attribution.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, makeRepo } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'hsa-state-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'hsa-holders-'));

const git = (tree, ...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: tree, stdio: 'ignore' });
const hook = (name, tree, input) => spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}`, import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify(input) });

const tree = makeRepo();
writeFileSync(join(tree, 'package.json'), JSON.stringify({ name: 'claude-kit' }));
for (const f of ['a.js', 'b.js', 'c.js']) writeFileSync(join(tree, f), 'export const x = 1;\n');
git(tree, 'add', '-A');
git(tree, 'commit', '-qm', 'init');

const file = (rel) => join(tree, rel);
const edit = (session, rel, next) => {
  const input = { session_id: session, tool_input: { file_path: file(rel), old_string: readFileSync(file(rel), 'utf8').trim(), new_string: next } };
  const refused = hook('holder-beat.mjs', tree, input).status;
  if (!refused) {
    hook('pre-write.mjs', tree, input);
    writeFileSync(file(rel), `${next}\n`);
  }
  return refused;
};
let callId = 0;
const shellCall = (session, during) => {
  const id = `call${++callId}`;
  hook('shell-writes.mjs', tree, { hook_event_name: 'PreToolUse', session_id: session, tool_use_id: id, tool_input: { command: 'node scratch.js' } });
  during();
  hook('shell-writes.mjs', tree, { hook_event_name: 'PostToolUse', session_id: session, tool_use_id: id, tool_input: { command: 'node scratch.js' }, tool_response: {} });
};
const commit = (session, rel) => {
  git(tree, 'reset', '-q');
  git(tree, 'add', rel);
  return hook('commit-gate.mjs', tree, { session_id: session, tool_input: { command: `git -C ${tree} commit -m "implements KIT-T407"` } });
};

expect('SA edits a.js through the tool', edit('SA', 'a.js', 'export const x = 2;'), 0);
shellCall('SA', () => {
  writeFileSync(file('c.js'), 'export const x = 5;\n');
  edit('SB', 'b.js', 'export const x = 3;');
});

expect("SB's repeat edit of the file it wrote inside SA's shell call is not refused as SA's", edit('SB', 'b.js', 'export const x = 4;'), 0);
expect("SB's commit of that file needs no [commit-foreign]", commit('SB', 'b.js').status, 0);
expect("control: SA's own Edit of a.js still holds it against SB", edit('SB', 'a.js', 'export const x = 9;'), 2);
expect("control: a file SA's shell call wrote itself still holds it against SB", edit('SB', 'c.js', 'export const x = 9;'), 2);
expect("control: SA's commit of the file its own shell call wrote needs no [commit-foreign]", commit('SA', 'c.js').status, 0);

finish();
