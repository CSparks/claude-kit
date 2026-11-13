// One file, one writer, across the agents of one session (KIT-T1114): the write guard (holder-beat.mjs) refuses an edit of a
// file another live writer of the same session changed and has not committed, naming that writer. A writer's own files, other
// files, a stopped agent's files and committed files always pass.
// Run: node hooks/agent-claims.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, makeRepo } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'ac-state-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'ac-holders-'));
process.env.CLAUDE_KIT_BUILD_SLOT_DIR = mkdtempSync(join(tmpdir(), 'ac-slots-'));

const tree = makeRepo();
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: tree, stdio: 'ignore' });
for (const f of ['a.js', 'b.js']) writeFileSync(join(tree, f), 'export const x = 1;\n');
git('add', '-A');
git('commit', '-qm', 'init');

const SESSION = 'S1';
let n = 1;
const hook = (script, input) => spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify(input) });
const edit = (agent, file) => {
  writeFileSync(join(tree, file), `export const x = ${(n += 1)};\n`);
  return hook('./holder-beat.mjs', { session_id: SESSION, ...(agent ? { agent_id: agent, agent_type: 'claude-kit:agent' } : {}), tool_input: { file_path: join(tree, file) } });
};
const stop = (agent) => hook('./agent-roster.mjs', { hook_event_name: 'SubagentStop', session_id: SESSION, agent_id: agent });

expect('agent A edits a.js: passes', edit('agentA', 'a.js').status, 0);
const refused = edit('agentB', 'a.js');
expect('agent B, same session, editing A\'s uncommitted a.js is refused', refused.status, 2);
expect('the refusal names agent A, the file and the check', /agent agentA/.test(refused.stderr) && /a\.js/.test(refused.stderr) && /checkout-holder/.test(refused.stderr) ? 1 : 0, 1);
expect('negative control: agent B editing another file passes', edit('agentB', 'b.js').status, 0);
expect('agent A editing its own file again passes', edit('agentA', 'a.js').status, 0);
const main = edit('', 'a.js');
expect('the main thread editing A\'s file is refused too, naming A', main.status === 2 && /agent agentA/.test(main.stderr) ? 1 : 0, 1);
expect('agent A editing B\'s file is refused (B\'s claim stands)', edit('agentA', 'b.js').status, 2);

stop('agentA');
expect('once agent A stops, its uncommitted file is free for B', edit('agentB', 'a.js').status, 0);

git('commit', '-qam', 'B work');
expect('after a commit the file is clean: agent C edits a.js though B claimed it', edit('agentC', 'a.js').status, 0);
git('commit', '-qam', 'C work');
expect('a committed claim never refuses another writer', edit('agentB', 'a.js').status, 0);

finish();
