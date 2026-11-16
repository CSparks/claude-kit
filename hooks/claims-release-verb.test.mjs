// `claims --release <agent id> --reason "<why>"` (KIT-T1287): the main thread frees the file claims and holds of an agent killed
// by an API error (no stop event); a subagent cannot, and an agent that wrote in the last few minutes is not released.
// Run: node hooks/claims-release-verb.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const holders = mkdtempSync(join(tmpdir(), 'cr-holders-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'cr-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');
const { recordToolWrite } = await import('./lib/tool-writes.mjs');
const { contentHashOf } = await import('./lib/shell-snapshot.mjs');

const repo = mkdtempSync(join(tmpdir(), 'cr-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
mkdirSync(join(repo, '.ai'));
mkdirSync(join(repo, 'src'));
const NAMES = ['a.rs', 'b.rs', 'c.rs', 'd.rs'];
for (const name of NAMES) writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 1 }\n`);
git('add', '.');
git('commit', '-q', '-m', 'seed');
const top = git('rev-parse', '--show-toplevel');
const head = git('rev-parse', 'HEAD');

const MINUTE = 60000;
const DEAD = 'a37b9acc2334bdbcb';
const BUSY = 'a37b9acc99999bbbb';
for (const name of NAMES) {
  writeFileSync(join(repo, 'src', name), `pub fn ${name[0]}() -> u32 { 2 }\n`);
  recordToolWrite(top, `src/${name}`, contentHashOf(top, `src/${name}`), Date.now() - 20 * MINUTE, `S2|${name === 'd.rs' ? BUSY : DEAD}`);
}
for (const name of ['a.rs', 'b.rs', 'c.rs']) claimFile({ tree: top, session: 'S2', agent: DEAD, label: 'streets agent', rel: `src/${name}`, head, now: Date.now() - 20 * MINUTE });
claimFile({ tree: top, session: 'S2', agent: BUSY, label: 'busy agent', rel: 'src/d.rs', head, now: Date.now() - MINUTE });

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const sourceGate = (command, agent = '') => spawnSync(process.execPath, [here('source-shell-gate.mjs')], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }) });
const releaseGate = (command, agent = '') => spawnSync(process.execPath, [here('claims-release-gate.mjs')], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_name: 'Bash', tool_input: { command } }) });
const claims = (...args) => spawnSync(process.execPath, [here('../scripts/claims.mjs'), ...args], { cwd: repo, env: process.env, encoding: 'utf8' });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

const before = sourceGate('git restore -- src/a.rs src/b.rs src/c.rs');
check('a dead agent that sent no stop event still holds its files: the main thread\'s restore is refused and the refusal names the verb', blocked(before) && /streets agent/.test(before.stderr) && /claims --release <agent id> --reason "<why>"/.test(before.stderr), before.stderr);

const busy = claims('--release', BUSY, '--reason', 'test');
check('an agent that wrote in the last few minutes is refused, and its claims stay', busy.status === 2 && /wrote 1 min ago/.test(busy.stderr) && blocked(sourceGate('git restore -- src/d.rs')));
check('no reason or no id is a usage error', claims('--release', DEAD).status === 64 && claims('--release').status === 64 && claims('--reason', 'x').status === 64);
check('an id with fewer than 8 characters names nothing', /nothing to release/.test(claims('--release', 'a37b', '--reason', 'x').stdout) && blocked(sourceGate('git restore -- src/a.rs')));

const released = claims('--release', DEAD.slice(0, 10), '--reason', 'killed by a usage limit, diff saved');
check('the main thread releases a dead agent by an id prefix', released.status === 0 && /released 1 claim\(s\)/.test(released.stdout), released.stdout + released.stderr);
const row = readFileSync(join(repo, '.ai', 'agents.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === DEAD);
check('the release is recorded in the roster as killed, with the reason', row && row.status === 'killed' && /killed by a usage limit, diff saved/.test(row.summary));
check('the restore then passes for the main thread', !blocked(sourceGate('git restore -- src/a.rs src/b.rs src/c.rs')));
check('a second release finds nothing to release', /nothing to release/.test(claims('--release', DEAD, '--reason', 'again').stdout));

claimFile({ tree: top, session: 'S3', agent: 'a37b9acc2334bdbcb', label: 'twin', rel: 'src/a.rs', head, now: Date.now() - 20 * MINUTE });
claimFile({ tree: top, session: 'S3', agent: 'a37b9accffffffff', label: 'twin two', rel: 'src/b.rs', head, now: Date.now() - 20 * MINUTE });
check('a prefix that names two agents is refused: give the full id', /names \d+ agents/.test(claims('--release', 'a37b9acc', '--reason', 'x').stderr) && claims('--release', 'a37b9acc', '--reason', 'x').status === 2);

check('a subagent that runs the verb is refused by the gate', releaseGate('claims --release a37b9acc2334bdbcb --reason "x"', 'subAgent1').status === 2 && releaseGate('node scripts/claims.mjs --release abc --reason x', 'subAgent1').status === 2);
check('the main thread and other commands pass the gate', releaseGate('claims --release a37b9acc2334bdbcb --reason "x"').status === 0 && releaseGate('echo claims', 'subAgent1').status === 0 && releaseGate('git status', 'subAgent1').status === 0);

console.log(fails ? `\nclaims-release-verb: ${fails} failed` : '\nclaims-release-verb: all pass');
process.exit(fails ? 1 : 0);
