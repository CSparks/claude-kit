// A staged deletion is its deleter's (KIT-T1401): the removal a shell call makes is claimed for the agent that ran it
// (shell-writes.mjs), so another agent's commit of the whole index (which would sweep the deletion) is refused by name, while
// commits by explicit path, and the deleter's own commit, pass.
// Run: node hooks/commit-staged-delete.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let fails = 0;
const check = (name, cond, detail = '') => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : `  ${String(detail).slice(0, 400)}`}`); if (!cond) fails++; };
const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const env = { ...process.env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'csd-state-')), CLAUDE_KIT_HOLDERS_DIR: mkdtempSync(join(tmpdir(), 'csd-holders-')) };

const repo = mkdtempSync(join(tmpdir(), 'csd-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
git('init', '-q');
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
mkdirSync(join(repo, '.ai'));
mkdirSync(join(repo, 'src'));
writeFileSync(join(repo, '.ai', 'config.yml'), 'uat:\n  default: none\n');
writeFileSync(join(repo, 'src', 'documents.rs'), 'pub fn documents() -> u32 { 1 }\n');
writeFileSync(join(repo, 'src', 'replay.rs'), 'pub fn replay() -> u32 { 1 }\n');
git('add', '.');
git('commit', '-q', '-m', 'seed');

const run = (name, agent, command, extra = {}) => spawnSync(process.execPath, [hook(name)], { cwd: repo, env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', agent_id: agent, agent_type: agent, tool_name: 'Bash', tool_input: { command }, ...extra }) });
const MSG = 'implements KIT-T1401';

const RM = 'git rm -- src/documents.rs';
const removal = run('source-shell-gate.mjs', 'aDeleter', RM);
check('the deleter\'s git rm of a clean tracked file passes the gate', removal.status === 0, removal.stderr);
run('shell-writes.mjs', 'aDeleter', RM, { hook_event_name: 'PreToolUse', tool_use_id: 'rm1' });
git('rm', '-q', '--', 'src/documents.rs');
run('shell-writes.mjs', 'aDeleter', RM, { hook_event_name: 'PostToolUse', tool_use_id: 'rm1', tool_response: {} });

const replayEdit = { session_id: 'S1', agent_id: 'aReplay', tool_input: { file_path: join(repo, 'src', 'replay.rs'), content: 'pub fn replay() -> u32 { 2 }\n' } };
spawnSync(process.execPath, [hook('pre-write.mjs')], { cwd: repo, env, input: JSON.stringify(replayEdit) });
writeFileSync(join(repo, 'src', 'replay.rs'), 'pub fn replay() -> u32 { 2 }\n');
spawnSync(process.execPath, [hook('tool-write-record.mjs')], { cwd: repo, env, input: JSON.stringify({ ...replayEdit, hook_event_name: 'PostToolUse', tool_response: {} }) });

const sweep = run('commit-gate.mjs', 'aReplay', `git add src/replay.rs && git commit -m "${MSG}"`);
check('another agent\'s commit of the whole index, which would sweep the staged deletion, is refused naming it and its deleter',
  sweep.status === 2 && /src\/documents\.rs: agent aDeleter/.test(sweep.stderr), sweep.stderr);
check('the refusal offers the explicit-path commit of the agent\'s own file', /git commit -m "<message>" -- src\/replay\.rs/.test(sweep.stderr), sweep.stderr);
const scoped = run('commit-gate.mjs', 'aReplay', `git add src/replay.rs && git commit -m "${MSG}" -- src/replay.rs`);
check('the explicit-path commit of the agent\'s own file passes', scoped.status === 0, scoped.stderr);
const own = run('commit-gate.mjs', 'aDeleter', `git commit -m "${MSG}" -- src/documents.rs`);
check('the deleter commits its own deletion', own.status === 0, own.stderr);
const { deleteGuidance } = await import('./lib/delete-guidance.mjs');
const { DELETE_REFUSALS } = await import('./lib/owns-untracked-file.mjs');
const guidance = deleteGuidance(DELETE_REFUSALS.tracked, { path: 'src/documents.rs', cwd: repo });
check('the guidance for a tracked file says to commit the git rm at once by explicit path', /git rm -- src\/documents\.rs/.test(guidance) && /commit it at once by explicit path \(`git commit -F <message file> -- src\/documents\.rs`\)/.test(guidance), guidance);

console.log(fails ? `\ncommit-staged-delete: ${fails} failed` : '\ncommit-staged-delete: all pass');
process.exit(fails ? 1 : 0);
