#!/usr/bin/env node
// crate-check.test.mjs — the crate-check watch (KIT-T1211): a failed cargo check names the live writer whose uncommitted edit
// holds the failing file; a subagent that ends with an edited crate its last check did not cover, or covered and failed, is
// blocked once. Run: node hooks/crate-check.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'cc-state-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'cc-holders-'));
const { cargoCompile, crateCheckArgs, outcomeOf, errorFiles } = await import('./lib/crate-checks.mjs');
const { claimFile } = await import('./lib/checkout-holder.mjs');
const { recordToolWrite } = await import('./lib/tool-writes.mjs');

const made = mkdtempSync(join(tmpdir(), 'cc-tree-'));
execFileSync('git', ['init', '-q'], { cwd: made });
const tree = gitTop(made);
mkdirSync(join(tree, '.ai'), { recursive: true });
const crate = join(tree, 'crates', 'a');
mkdirSync(join(crate, 'src'), { recursive: true });
writeFileSync(join(crate, 'Cargo.toml'), '[package]\nname = "a"\nversion = "0.1.0"\nedition = "2021"\n');
writeFileSync(join(crate, 'src', 'lib.rs'), 'pub fn f() {}\n');
const REL = 'crates/a/src/lib.rs';

const run = (payload) => spawnSync(process.execPath, [fileURLToPath(new URL('./crate-check.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', cwd: crate, ...payload }) });
const check = (agent, output, command = 'cargo check -p a') => run({ hook_event_name: 'PostToolUse', tool_name: 'Bash', ...(agent ? { agent_id: agent } : {}), tool_input: { command }, tool_response: { stdout: '', stderr: output } });
const stop = (agent, extra = {}) => run({ hook_event_name: 'SubagentStop', ...(agent ? { agent_id: agent } : {}), ...extra });
const FAILED_OUTPUT = `error[E0425]: cannot find value \`x\`\n --> ${REL}:1:15\n  |\nerror: could not compile \`a\``;

expect('crateCheckArgs: cargo check, with flags and an env prefix', crateCheckArgs('RUSTFLAGS=-Awarnings cargo check -q -p a')?.join(' ') === 'check -q -p a' ? 1 : 0, 1);
expect('crateCheckArgs: cargo build, clippy and the c alias', ['cargo build', 'cargo clippy -p a', 'cargo c', 'cd x && cargo.exe check'].every((c) => crateCheckArgs(c)) ? 1 : 0, 1);
expect('crateCheckArgs: cargo run and a non-cargo line are no check', ['cargo run', 'echo cargo check', 'git status'].some((c) => crateCheckArgs(c)) ? 1 : 0, 0);
expect('cargoCompile: a test run is a check of its packages without the test arguments or --no-run', cargoCompile('cargo test -p a --no-run -- --nocapture x')?.args.join(' ') === 'check -p a' && cargoCompile('cargo t -p a')?.compileOnly ? 1 : 0, 1);
expect('cargoCompile: check, build and clippy fail on any error', ['cargo check -p a', 'cargo build', 'cargo clippy'].every((c) => cargoCompile(c)?.compileOnly === false) ? 1 : 0, 1);
expect('outcomeOf: an error line or could not compile is a failure; a finished line is not', outcomeOf(FAILED_OUTPUT).failed && !outcomeOf('    Finished `dev` profile in 2s').failed ? 1 : 0, 1);
const TEST_FAILED = 'running 1 test\ntest t ... FAILED\nerror: test failed, to rerun pass `-p a --lib`';
expect('outcomeOf: a failing test of a compiled crate is no compile failure; a compile error in a test run is', !outcomeOf(TEST_FAILED, { compileOnly: true }).failed && outcomeOf(FAILED_OUTPUT, { compileOnly: true }).failed && outcomeOf(TEST_FAILED).failed ? 1 : 0, 1);
expect('errorFiles resolves a --> path against the working directory or an ancestor', errorFiles(FAILED_OUTPUT, crate).map((f) => f.replace(/\\/g, '/')).join() === `${tree.replace(/\\/g, '/')}/${REL}` ? 1 : 0, 1);

claimFile({ tree, session: 'S1', agent: 'agentCulprit', label: 'roads agent', rel: REL, head: 'h' });
const blamed = check('agentVictim', FAILED_OUTPUT);
expect('a failed check in a file another live writer claims names that writer and the file', blamed.status === 2 && /agentCulprit/.test(blamed.stderr) && /lib\.rs/.test(blamed.stderr) && /crate-check/.test(blamed.stderr) ? 1 : 0, 1);
expect('control: the claimant\'s own failed check is not blamed on another writer', check('agentCulprit', FAILED_OUTPUT).status, 0);
expect('control: a passing check names nobody', check('agentVictim', '    Finished `dev` profile in 2s').status, 0);
expect('control: a failure in a file no one claims names nobody', check('agentVictim', FAILED_OUTPUT.replace(REL, 'crates/a/Cargo.toml')).status, 0);
expect('control: a command that is no cargo check records and names nothing', check('agentVictim', FAILED_OUTPUT, 'cargo run -p a').status, 0);

const at = (offsetMs) => Date.now() + offsetMs;
recordToolWrite(tree, REL, 'hash-1', at(-5000), 'S1|agentEditor');
const nudged = stop('agentEditor');
expect('a subagent that edited a crate and ran no check is blocked at stop, naming the crate', nudged.status === 2 && /crates\/a/.test(nudged.stderr) && /no cargo check after your last edit/.test(nudged.stderr) ? 1 : 0, 1);
expect('control: the nudge is once: a stop already continued passes', stop('agentEditor', { stop_hook_active: true }).status, 0);
expect('control: the main thread is never nudged', stop('').status, 0);
expect('control: an agent that edited nothing passes', stop('agentIdle').status, 0);

check('agentEditor', '    Finished `dev` profile in 2s');
expect('after a passing check of the crate it edited, the stop passes', stop('agentEditor').status, 0);

recordToolWrite(tree, REL, 'hash-2', at(2000), 'S1|agentEditor');
expect('an edit after the passing check is unverified again', stop('agentEditor').status, 2);

recordToolWrite(tree, REL, 'hash-3', at(-4000), 'S1|agentFails');
check('agentFails', FAILED_OUTPUT);
const afterFail = stop('agentFails');
expect('an agent whose last covering check failed is blocked and told it failed', afterFail.status === 2 && /FAILED/.test(afterFail.stderr) ? 1 : 0, 1);

recordToolWrite(tree, REL, 'hash-4', at(-3000), 'S1|agentTester');
expect('control: an edit of an uncommitted file no check covers is unverified', stop('agentTester').status, 2);
check('agentTester', 'test result: ok. 1 passed', 'cargo test -p a');
expect('a passing cargo test of the crate covers the edit', stop('agentTester').status, 0);
recordToolWrite(tree, REL, 'hash-5', at(-1000), 'S1|agentTester');
check('agentTester', TEST_FAILED, 'cargo test -p a');
expect('a test run whose tests failed but compiled covers the edit', stop('agentTester').status, 0);

recordToolWrite(tree, REL, 'hash-6', at(-2000), 'S1|agentCommitter');
expect('control: the edit is unverified while its file is uncommitted', stop('agentCommitter').status, 2);
execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '--', REL], { cwd: tree });
execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'land the edit', '--', REL], { cwd: tree });
expect('an edit a commit landed is no longer unverified', stop('agentCommitter').status, 0);

const wiring = JSON.parse(readFileSync(fileURLToPath(new URL('./hooks.json', import.meta.url)), 'utf8'));
const wiredIn = (event, matcher) => (wiring.hooks[event] || []).filter((e) => e.matcher === matcher).some((e) => e.hooks.some((h) => h.command.includes('crate-check.mjs')));
expect('crate-check is wired on PostToolUse for Bash and PowerShell and on SubagentStop', wiredIn('PostToolUse', 'Bash|PowerShell') && wiredIn('SubagentStop', undefined) ? 1 : 0, 1);

finish();
