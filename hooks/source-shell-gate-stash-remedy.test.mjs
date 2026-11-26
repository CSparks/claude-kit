// A refused named-path stash prints a stash remedy, the same for a subagent and the main thread (KIT-T1593): what the gate
// passes today (a stash of the caller's own files by name; the pathless stash while no other writer is live), never an `rm`
// form or a revision-leftover hint. The verdicts are unchanged: a named stash of another writer's tracked change, an ended
// writer's included, is refused to every caller (RDG-D191 holds the lift), and the pathless one passes only with no writer live.
// Run: node hooks/source-shell-gate-stash-remedy.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIVE_HOLDERS = mkdtempSync(join(tmpdir(), 'sr-holders-'));
const QUIET_HOLDERS = mkdtempSync(join(tmpdir(), 'sr-quiet-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = LIVE_HOLDERS;
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'sr-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');
const { recordToolWrite } = await import('./lib/tool-writes.mjs');
const { contentHashOf } = await import('./lib/shell-snapshot.mjs');

const repo = mkdtempSync(join(tmpdir(), 'sr-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
mkdirSync(join(repo, '.ai'));
mkdirSync(join(repo, 'src'));
for (const name of ['a.rs', 'c.rs', 'd.rs', 'e.rs']) writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 1 }\n`);
git('add', '.');
git('commit', '-q', '-m', 'seed');
const top = git('rev-parse', '--show-toplevel');

const ENDED = 'S2|endedAgent';
const changed = (name, writer) => {
  writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 2 }\n`);
  if (writer) recordToolWrite(top, `src/${name}`, contentHashOf(top, `src/${name}`), Date.now() - 600000, writer);
};
changed('a.rs', ENDED);
changed('c.rs', ENDED);
changed('d.rs', '');
writeFileSync(join(repo, 'src', 'u.rs'), 'pub fn u() {}\n');
recordToolWrite(top, 'src/u.rs', contentHashOf(top, 'src/u.rs'), Date.now() - 600000, ENDED);
changed('e.rs', 'S1|');
claimFile({ tree: top, session: 'S9', agent: 'liveAgent', label: 'roads agent', rel: 'src/c.rs', head: git('rev-parse', 'HEAD') });

let fails = 0;
const check = (name, cond, detail = '') => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : ` ${detail}`}`); if (!cond) fails++; };
const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const run = (command, { agent = '', holders = LIVE_HOLDERS } = {}) => spawnSync(process.execPath, [gate], { cwd: repo, env: { ...process.env, CLAUDE_KIT_HOLDERS_DIR: holders }, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }) });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);
// The way-out line: the one after the delete rule.
const wayOut = (r) => { const lines = r.stderr.split('\n'); const at = lines.findIndex((l) => l.startsWith('  Delete rule:')); return at < 0 ? '' : lines[at + 1] || ''; };
const RM_FORM = /`rm |Remove-Item|removes an untracked file|older revision/;
const PATHLESS = /`git stash push -m <note>`/;

const NAMED = 'git stash push -m wip -- src/a.rs';
const main = run(NAMED);
const sub = run(NAMED, { agent: 'subAgent123' });
check('verdict unchanged: the main thread\'s named stash of an ended writer\'s tracked change is refused', blocked(main), main.stderr);
check('verdict unchanged: a subagent\'s is refused', blocked(sub), sub.stderr);
check('the main thread\'s remedy names no rm form and no revision leftover', wayOut(main) && !RM_FORM.test(wayOut(main)), wayOut(main));
check('the subagent\'s remedy names no rm form and no revision leftover', wayOut(sub) && !RM_FORM.test(wayOut(sub)), wayOut(sub));
check('both remedies name the pathless stash and that it needs no other writer live', PATHLESS.test(wayOut(main)) && /no other writer is live/.test(wayOut(main)), wayOut(main));
check('the subagent is told what the main thread may do, in the same words', wayOut(main) === wayOut(sub), `${wayOut(main)}\n    vs ${wayOut(sub)}`);
check('the headline names the stash, not a hand delete', /git stash/.test(main.stderr.split('\n').find((l) => l.startsWith('BLOCKED:')) || ''), main.stderr);
const unrecorded = run('git stash push -m wip -- src/d.rs');
const remedy = (r) => wayOut(r).slice(wayOut(r).indexOf('A stash naming files'));
check('changes no tool recorded get the same stash remedy after their own reason', blocked(unrecorded) && /^\s*No Edit or Write/.test(wayOut(unrecorded)) && remedy(unrecorded) === remedy(main), wayOut(unrecorded));
const untracked = run('git stash push -u -m wip -- src/a.rs', { agent: 'subAgent123' });
check('a named -u stash gets the stash remedy too', blocked(untracked) && PATHLESS.test(wayOut(untracked)) && !RM_FORM.test(wayOut(untracked)), wayOut(untracked));

check('verdict unchanged: the pathless stash is refused while another writer is live', blocked(run('git stash push -m wip')));
check('verdict unchanged: the pathless stash passes with no other writer live', !blocked(run('git stash push -m wip', { holders: QUIET_HOLDERS })));
check('verdict unchanged: the caller\'s own file passes by name', !blocked(run('git stash push -m wip -- src/e.rs')));
check('control: a git restore refusal keeps its restore remedy', /git restore -- <path> <path> \.\.\./.test(wayOut(run('git restore -- src/c.rs'))));
check('control: a plain rm of another writer\'s file keeps its rm remedy', /Raise it to the main thread/.test(run('rm src/u.rs', { agent: 'subAgent123' }).stderr));

console.log(fails ? `\nsource-shell-gate-stash-remedy: ${fails} failed` : '\nsource-shell-gate-stash-remedy: all pass');
process.exit(fails ? 1 : 0);
