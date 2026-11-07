// checkout-holder (KIT-T811): two simulated sessions in two projects dispatch writers into one third checkout. The first
// becomes its holder; the second is refused until the holder stops, goes silent, or the dispatch is read-only.
// Run: node hooks/dispatch-holder.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, ignoreFile, makeRepo, runRaw } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
const { beatHolder } = await import('./lib/checkout-holder.mjs');
const target = makeRepo();
const homeA = makeRepo();
const homeB = makeRepo();
const send = (home, sid, input = {}) => runRaw(home, JSON.stringify({ tool_name: 'Agent', session_id: sid, tool_input: { model: 'sonnet', subagent_type: 'general-purpose', ...input, prompt: `${input.prompt || 'x'} [tree: ${target}] [job: fix]` } }));
const editBy = (sid, file, agent) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'x\n');
  spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: homeA, encoding: 'utf8', input: JSON.stringify({ session_id: sid, ...(agent ? { agent_id: agent, agent_type: 'claude-kit:agent' } : {}), tool_input: { file_path: file } }) });
};
const beat = (sid, agent) => editBy(sid, join(target, 'f.js'), agent);

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
beatHolder({ tree: gitTop(target), session: 'SA', label: 'claude-kit:agent', now: Date.now() - 20 * 60 * 1000 });
expect('a holder silent past the heartbeat window does not block', send(homeB, 'SB').code, 0);

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
beat('SA', 'agent-kit-1');
expect('an edit in the checkout by the holder\'s agent renews the hold', send(homeB, 'SB').code, 2);
spawnSync(process.execPath, [fileURLToPath(new URL('./agent-roster.mjs', import.meta.url))], { cwd: homeA, encoding: 'utf8', input: JSON.stringify({ hook_event_name: 'SubagentStop', session_id: 'SA', agent_id: 'agent-kit-1' }) });
expect('the holder\'s agent stopping releases the checkout', send(homeB, 'SB').code, 0);

// Scoped to the repo being written: a session's store (.ai/) writes into a checkout are not a writer there (KIT-T882).
const holdersDir = () => process.env.CLAUDE_KIT_HOLDERS_DIR;
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
editBy('SG', join(target, '.ai', 'tickets', 'KIT-T1-x.md'));
editBy('SG', join(target, '.ai', 'decisions', 'KIT-D1-x.md'), 'agent-store-1');
expect('a store (.ai/) write from another project\'s session leaves no hold', readdirSync(holdersDir()).length, 0);
expect('a store write does not block a writer dispatch', send(homeB, 'SB').code, 0);
beat('SG', 'agent-src-1');
const withHolder = send(homeB, 'SB');
expect('control: a source write by the same session still blocks', withHolder.code, 2);
const entryFile = readdirSync(holdersDir()).flatMap((d) => readdirSync(join(holdersDir(), d)).map((n) => join(holdersDir(), d, n))).find((f) => f.endsWith('SG.json'));
const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase();
const originA = norm(gitTop(homeA));
expect('the block says which project the holder session came from', norm(withHolder.err).includes(`from ${originA}`) ? 1 : 0, 1);
expect('the block names the holder agent and how the hold lapses', /agent agent-src-1/.test(withHolder.err) && /15 min/.test(withHolder.err) ? 1 : 0, 1);
expect('the block gives the exact entry file to delete for a stale hold', norm(withHolder.err).includes(norm(entryFile)) ? 1 : 0, 1);
expect('the block points at the origin project\'s agent roster', norm(withHolder.err).includes(`${originA}/.ai/agents.jsonl`) ? 1 : 0, 1);

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
beatHolder({ tree: gitTop(target), session: 'SOLD', label: 'claude-kit:agent' });
expect('an entry without a recorded origin still blocks and says the origin is unknown', /origin unknown/.test(send(homeB, 'SB').err) ? 1 : 0, 1);

finish();
