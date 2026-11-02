// checkout-holder (KIT-T811): two simulated sessions in two projects dispatch writers into one third checkout. The first
// becomes its holder; the second is refused until the holder stops, goes silent, or the dispatch is read-only.
// Run: node hooks/dispatch-holder.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, ignoreFile, makeRepo, runRaw } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
const { beatHolder } = await import('./lib/checkout-holder.mjs');
const target = makeRepo();
const homeA = makeRepo();
const homeB = makeRepo();
const send = (home, sid, input = {}) => runRaw(home, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: { model: 'sonnet', subagent_type: 'general-purpose', ...input, prompt: `${input.prompt || 'x'} [tree: ${target}] [job: fix]` } }));
const beat = (sid, agent) => {
  const file = join(target, 'f.js');
  writeFileSync(file, 'x\n');
  spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: homeA, encoding: 'utf8', input: JSON.stringify({ session_id: sid, ...(agent ? { agent_id: agent, agent_type: 'claude-kit:agent' } : {}), tool_input: { file_path: file } }) });
};

expect('the first session\'s writer dispatch into the checkout is allowed', send(homeA, 'SA').code, 0);
const refused = send(homeB, 'SB');
expect('a second session\'s writer dispatch into the held checkout is blocked', refused.code, 2);
expect('the block names the holder session, the full-id hand-off and the check', /session SA/.test(refused.err) && /SendMessage/.test(refused.err) && /KIT-T###/.test(refused.err) && /checkout-holder/.test(refused.err) ? 1 : 0, 1);
expect('the holder\'s own warm agent is allowed', send(homeA, 'SA', { prompt: 'next ticket' }).code, 0);
expect('a read-only agent type is allowed into the held checkout', send(homeB, 'SB', { subagent_type: 'claude-kit:researcher' }).code, 0);
expect('[read-only: reason] on a writer type is allowed', send(homeB, 'SB', { prompt: 'x [read-only: audit]' }).code, 0);
expect('[maintainer-asked-parallel: his words] is allowed', send(homeB, 'SB', { prompt: 'x [maintainer-asked-parallel: run both]' }).code, 0);
expect('the ignore file key lifts it', runRaw(ignoreFile(makeRepo(), 'checkout-holder'), JSON.stringify({ tool_name: 'Agent', session_id: 'SB', tool_input: { model: 'sonnet', subagent_type: 'general-purpose', prompt: `x [tree: ${target}] [job: fix]` } })).code, 0);
expect('a dispatch with no session id fails open', runRaw(homeB, JSON.stringify({ tool_name: 'Agent', tool_input: { model: 'sonnet', subagent_type: 'general-purpose', prompt: `x [tree: ${target}] [job: fix]` } })).code, 0);

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
beatHolder({ tree: target.replace(/\\/g, '/'), session: 'SA', label: 'claude-kit:agent', now: Date.now() - 20 * 60 * 1000 });
expect('a holder silent past the heartbeat window does not block', send(homeB, 'SB').code, 0);

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
beat('SA', 'agent-kit-1');
expect('an edit in the checkout by the holder\'s agent renews the hold', send(homeB, 'SB').code, 2);
spawnSync(process.execPath, [fileURLToPath(new URL('./agent-roster.mjs', import.meta.url))], { cwd: homeA, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'SubagentStop', session_id: 'SA', agent_id: 'agent-kit-1' }) });
expect('the holder\'s agent stopping releases the checkout', send(homeB, 'SB').code, 0);

finish();
