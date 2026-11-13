// checkout-holder (KIT-T811, KIT-D155, KIT-T1114): two simulated sessions in two projects dispatch writers into one third
// checkout. A second session's writer is refused only when its declared [paths:] touch a file the holder changed and has not
// committed; a holder that stops, goes silent or a read-only dispatch never blocks.
// Run: node hooks/dispatch-holder.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, ignoreFile, makeRepo, runRaw } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'dh-state-'));
const fresh = () => { process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-')); };
fresh();
const { beatHolder } = await import('./lib/checkout-holder.mjs');
const { recordTurnWrite } = await import('./turn-writes.mjs');

const target = makeRepo();
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: target, stdio: 'ignore' });
for (const f of ['f.js', 'g.js']) writeFileSync(join(target, f), 'export const x = 1;\n');
git('add', '-A');
git('commit', '-qm', 'init');
writeFileSync(join(target, 'f.js'), 'export const x = 2;\n');

const homeA = makeRepo();
const homeB = makeRepo();
const send = (home, sid, input = {}, paths = 'f.js') => runRaw(home, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: { model: 'sonnet', subagent_type: 'general-purpose', ...input, prompt: `${input.prompt || 'x'} [tree: ${target}]${paths ? ` [paths: ${paths}]` : ''} [job: fix]` } }));
const editBy = (sid, file, agent) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'x\n');
  spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: homeA, encoding: 'utf8', input: JSON.stringify({ session_id: sid, ...(agent ? { agent_id: agent, agent_type: 'claude-kit:agent' } : {}), tool_input: { file_path: file } }) });
};
const holdBy = (session, files, { agent = '', now = Date.now() } = {}) => {
  beatHolder({ tree: gitTop(target), session, agent, label: 'claude-kit:agent', now });
  for (const f of files) recordTurnWrite(gitTop(target), join(target, f), session);
};

expect('with no holder the writer dispatch is allowed', send(homeA, 'SA').code, 0);

holdBy('SA', ['f.js']);
const refused = send(homeB, 'SB');
expect('a second session declaring the file the holder changed and has not committed is blocked', refused.code, 2);
expect('the block names the file, the holder session and the check', /f\.js/.test(refused.err) && /session SA/.test(refused.err) && /checkout-holder/.test(refused.err) ? 1 : 0, 1);
expect('a second session declaring another file is allowed', send(homeB, 'SB', {}, 'g.js').code, 0);
expect('a second session declaring no paths is allowed', send(homeB, 'SB', {}, '').code, 0);
expect('the holder\'s own session is allowed on its file', send(homeA, 'SA').code, 0);
expect('a read-only agent type is allowed on the held file', send(homeB, 'SB', { subagent_type: 'claude-kit:researcher' }).code, 0);
expect('[read-only: reason] on a writer type is allowed', send(homeB, 'SB', { prompt: 'x [read-only: audit]' }).code, 0);
expect('[maintainer-asked-parallel: his words] lifts the overlap', send(homeB, 'SB', { prompt: 'x [maintainer-asked-parallel: run both]' }).code, 0);
expect('the ignore file key lifts it', runRaw(ignoreFile(makeRepo(), 'checkout-holder'), JSON.stringify({ tool_name: 'Agent', session_id: 'SB', tool_input: { model: 'sonnet', subagent_type: 'general-purpose', prompt: `x [tree: ${target}] [paths: f.js] [job: fix]` } })).code, 0);
expect('a dispatch with no session id fails open', runRaw(homeB, JSON.stringify({ tool_name: 'Agent', tool_input: { model: 'sonnet', subagent_type: 'general-purpose', prompt: `x [tree: ${target}] [paths: f.js] [job: fix]` } })).code, 0);

fresh();
holdBy('SA', ['f.js'], { now: Date.now() - 20 * 60 * 1000 });
expect('a holder silent past the heartbeat window does not block', send(homeB, 'SB').code, 0);

fresh();
editBy('SA', join(target, 'f.js'), 'agent-kit-1');
recordTurnWrite(gitTop(target), join(target, 'f.js'), 'SA');
expect('an edit in the checkout by the holder\'s agent renews the hold', send(homeB, 'SB').code, 2);
spawnSync(process.execPath, [fileURLToPath(new URL('./agent-roster.mjs', import.meta.url))], { cwd: homeA, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'SubagentStop', session_id: 'SA', agent_id: 'agent-kit-1' }) });
expect('the holder\'s agent stopping releases the checkout', send(homeB, 'SB').code, 0);

// A session's store (.ai/) writes into a checkout are not a writer there (KIT-T882).
fresh();
editBy('SG', join(target, '.ai', 'tickets', 'KIT-T1-x.md'));
editBy('SG', join(target, '.ai', 'decisions', 'KIT-D1-x.md'), 'agent-store-1');
expect('a store (.ai/) write from another project\'s session leaves no hold', readdirSync(process.env.CLAUDE_KIT_HOLDERS_DIR).length, 0);
expect('a store write does not block a writer dispatch', send(homeB, 'SB').code, 0);

finish();
