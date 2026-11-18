// LANDED SINCE LAST REPLY (KIT-T1379): a prompt, task notification, hand-back or message puts the commits the coordinator has to
// name in its context, each once per session, the project's and its submodule's, collapsed past eight.
// Run: node hooks/landed-notice.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { namedInReply } from './lib/announced-landings.mjs';

const HOOK = fileURLToPath(new URL('./landed-notice.mjs', import.meta.url));
let fails = 0;
const check = (name, cond, detail = '') => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : `  ${detail}`}`); if (!cond) fails++; };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const ident = (dir) => { git(dir, 'config', 'user.email', 't@t'); git(dir, 'config', 'user.name', 't'); return dir; };
const commit = (dir, name, subject) => { writeFileSync(join(dir, name), `${name}\n`); git(dir, 'add', '--', name); git(dir, 'commit', '-q', '-m', subject); return git(dir, 'rev-parse', 'HEAD'); };

const bare = mkdtempSync(join(tmpdir(), 'ln-bare-'));
git(bare, 'init', '-q', '--bare', '-b', 'main');
const subBare = mkdtempSync(join(tmpdir(), 'ln-subbare-'));
git(subBare, 'init', '-q', '--bare', '-b', 'main');
const fresh = (prefix) => { const dir = mkdtempSync(join(tmpdir(), prefix)); git(dir, 'init', '-q', '-b', 'main'); return ident(dir); };
const seed = fresh('ln-seed-');
commit(seed, 'lib.rs', 'framework seed');
git(seed, 'push', '-q', subBare, 'HEAD:main');

const root = fresh('ln-root-');
mkdirSync(join(root, '.ai'));
git(root, 'remote', 'add', 'origin', bare);
commit(root, 'a.rs', 'seed');
git(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', subBare, 'framework');
git(root, 'commit', '-q', '-m', 'add framework');
git(root, 'push', '-q', 'origin', 'HEAD:main');
const sub = ident(join(root, 'framework'));

const env = { ...process.env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'ln-state-')) };
const transcript = join(mkdtempSync(join(tmpdir(), 'ln-tx-')), 's.jsonl');
const turn = (lines) => writeFileSync(transcript, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
turn([{ type: 'user', timestamp: new Date(Date.now() - 60000).toISOString(), message: { role: 'user', content: 'go' } }]);
const hook = (payload) => spawnSync(process.execPath, [HOOK], { cwd: root, env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', transcript_path: transcript, ...payload }) }).stdout;

const a = commit(root, 'b.rs', 'implements RDG-T1 the town streets');
const f = commit(sub, 'c.rs', 'framework: gully stage');
const first = hook({ hook_event_name: 'UserPromptSubmit', prompt: '<task-notification><status>completed</status></task-notification>' });
check('a task notification lists the project commit and the submodule commit not yet pushed', first.startsWith('LANDED SINCE LAST REPLY') && first.includes(`${a.slice(0, 8)} implements RDG-T1 the town streets`) && first.includes(f.slice(0, 8)) && /framework [0-9a-f]{8} framework: gully stage/.test(first), first);
check('a second notice lists nothing already listed', hook({ hook_event_name: 'UserPromptSubmit', prompt: 'next' }) === '');

const b = commit(root, 'd.rs', 'implements RDG-T2 the next landing');
const viaAgent = hook({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: {}, tool_response: {} });
const ctx = JSON.parse(viaAgent || '{}').hookSpecificOutput?.additionalContext || '';
check('a hand-back through PostToolUse(Agent) injects only the new commit as additionalContext', ctx.includes(b.slice(0, 8)) && !ctx.includes(a.slice(0, 8)), viaAgent);

const c = commit(root, 'e.rs', 'implements RDG-T3 named already');
turn([{ type: 'user', timestamp: new Date(Date.now() - 60000).toISOString(), message: { role: 'user', content: 'go' } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: `Landed ${c.slice(0, 7)}.` }] } },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'working' }] } }]);
check('a commit an earlier reply named by sha is not listed', !hook({ hook_event_name: 'PostToolUse', tool_name: 'SendMessage', tool_input: {}, tool_response: {} }).includes(c.slice(0, 8)));

for (let i = 0; i < 11; i++) commit(root, `m${i}.rs`, `implements RDG-T9${i} batch ${i}`);
const many = hook({ hook_event_name: 'UserPromptSubmit', prompt: '<task-notification>x</task-notification>' }).trim().split('\n');
check('past eight commits the block collapses to a count and stays under twelve lines', many.length <= 12 && many.length === 10 && /\+3 more/.test(many.at(-1)), many.join('\n'));

git(root, 'push', '-q', 'origin', 'HEAD:main');
git(sub, 'push', '-q', 'origin', 'HEAD:main');
const freshEnv = { ...env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'ln-state2-')) };
const pushedPrompt = spawnSync(process.execPath, [HOOK], { cwd: root, env: freshEnv, encoding: 'utf8', input: JSON.stringify({ session_id: 'S2', transcript_path: transcript, hook_event_name: 'UserPromptSubmit', prompt: 'a new request' }) }).stdout;
check('control: a real prompt after everything is pushed lists nothing (a new turn starts)', pushedPrompt === '', pushedPrompt);

check('the Stop gate counts a sha named by its first seven characters', namedInReply([{ sha: a }], `see ${a.slice(0, 7)}`).length === 1 && namedInReply([{ sha: a }], `see ${a.slice(0, 6)}`).length === 0);

console.log(fails ? `\nlanded-notice: ${fails} failed` : '\nlanded-notice: all pass');
process.exit(fails ? 1 : 0);
