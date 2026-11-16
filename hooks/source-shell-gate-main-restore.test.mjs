// The main thread may put back tracked files a dead or ended writer left changed (KIT-T1286): `git restore -- <path> ...` naming
// each tracked file passes when the changes are another writer's recorded bytes and no live writer holds any of them. A live
// writer's file, a subagent, a directory, a glob, `.`, an option, and changes no tool recorded (the maintainer's own) stay refused.
// Run: node hooks/source-shell-gate-main-restore.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'mr-holders-'));
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'mr-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');
const { recordToolWrite } = await import('./lib/tool-writes.mjs');
const { contentHashOf } = await import('./lib/shell-snapshot.mjs');

const repo = mkdtempSync(join(tmpdir(), 'mr-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
mkdirSync(join(repo, '.ai'));
mkdirSync(join(repo, 'src'));
const FILES = ['a.rs', 'b.rs', 'c.rs', 'd.rs', 'e.rs'];
for (const name of FILES) writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 1 }\n`);
git('add', '.');
git('commit', '-q', '-m', 'seed');
const top = git('rev-parse', '--show-toplevel');

const DEAD = 'S2|deadAgent';
const changed = (name, writer) => {
  writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 2 }\n`);
  if (writer) recordToolWrite(top, `src/${name}`, contentHashOf(top, `src/${name}`), Date.now() - 600000, writer);
};
changed('a.rs', DEAD);
changed('b.rs', DEAD);
changed('c.rs', DEAD);
changed('d.rs', '');
changed('e.rs', 'S1|');
claimFile({ tree: top, session: 'S9', agent: 'liveAgent', label: 'roads agent', rel: 'src/c.rs', head: git('rev-parse', 'HEAD') });

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const run = (command, { agent = '' } = {}) => spawnSync(process.execPath, [gate], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }) });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

check('the main thread restores two files a dead writer left changed, naming each', !blocked(run('git restore -- src/a.rs src/b.rs')) && !blocked(run('git restore src/a.rs')) && !blocked(run('git -C . restore -- src/b.rs')));
check('the main thread restores a file it wrote itself', !blocked(run('git restore -- src/e.rs')));
const live = run('git restore -- src/a.rs src/c.rs');
check('a file a live writer holds is refused, naming the writer and the form', blocked(live) && /roads agent/.test(live.stderr) && /git restore -- <path> <path> \.\.\./.test(live.stderr), live.stderr);
const sub = run('git restore -- src/a.rs', { agent: 'subAgent123' });
check('a subagent is refused, and told to raise it to the main thread with the exact form', blocked(sub) && /Raise it to the main thread/.test(sub.stderr) && /git restore -- <path> <path> \.\.\./.test(sub.stderr), sub.stderr);
check('changes no tool recorded (the maintainer\'s own edit) are refused for the main thread too', blocked(run('git restore -- src/d.rs')));
check('a directory, a glob and `.` are refused while a live writer is in the checkout', ['git restore -- src/', 'git restore -- "src/*.rs"', 'git restore .', 'git restore -- .', 'git restore -- src'].every((c) => blocked(run(c))));
check('an option makes it another verb: --source, -S -W, --staged --worktree are refused', ['git restore --source=HEAD~1 -- src/a.rs', 'git restore -S -W src/a.rs', 'git restore --worktree src/a.rs', 'git restore --source HEAD src/b.rs'].every((c) => blocked(run(c))));
check('control: other discard verbs of the main thread are unchanged: checkout and reset --hard of a dead writer\'s file are still refused', blocked(run('git checkout -- src/a.rs')) && blocked(run('git reset --hard')));
check('a refused unrecorded change tells the main thread to ask the maintainer, not to restore', /maintainer's own uncommitted edit/.test(run('git restore -- src/d.rs').stderr));
check('a dead writer\'s file refused to a subagent names the form the main thread may use', /may put these files back|puts them back with `git restore/.test(sub.stderr));

console.log(fails ? `\nsource-shell-gate-main-restore: ${fails} failed` : '\nsource-shell-gate-main-restore: all pass');
process.exit(fails ? 1 : 0);
