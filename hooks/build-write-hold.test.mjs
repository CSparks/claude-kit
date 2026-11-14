// No write lands in the files a running build compiles (KIT-T1114): the write guard (holder-beat.mjs) refuses another
// writer's edit to a build input inside a live build hold's recorded scope, and passes the build's own writer, every other
// file, a hold in its test phase and a hold with no recorded scope.
// Run: node hooks/build-write-hold.test.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, makeRepo } from './dispatch-guard-harness.mjs';
import { buildWaitCommand } from './lib/build-write-hold.mjs';
import { FREE_WINDOW_S, KIND, openWindow, windowFor } from '../scripts/broker/write-window.mjs';

const kitRoot = fileURLToPath(new URL('..', import.meta.url));

const slots = mkdtempSync(join(tmpdir(), 'bw-slots-'));
process.env.CLAUDE_KIT_BUILD_SLOT_DIR = slots;
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'bw-holders-'));
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'bw-state-'));

const tree = makeRepo();
const crate = join(tree, 'crates', 'a');
const other = join(tree, 'crates', 'b');
for (const dir of [join(crate, 'src'), join(other, 'src'), join(tree, 'docs')]) mkdirSync(dir, { recursive: true });
const OWNER = 'S1|agentBuilder';

const hold = (extra) => writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: process.pid, host: hostname(), label: `${tree}: cargo test -p a`, cwd: tree, jobs: 4, ts: new Date().toISOString(), ...extra }));
const edit = (session, agent, ...segments) => {
  const file = join(tree, ...segments);
  writeFileSync(file, 'x\n');
  return guard(session, agent, file);
};
const create = (agent, ...segments) => {
  const file = join(tree, ...segments);
  mkdirSync(join(file, '..'), { recursive: true });
  rmSync(file, { force: true });
  return guard('S1', agent, file);
};
const guard = (session, agent, file) => {
  return spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify({ session_id: session, ...(agent ? { agent_id: agent } : {}), tool_input: { file_path: file } }) });
};

hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
const refused = edit('S1', 'agentOther', 'crates', 'a', 'src', 'lib.rs');
expect('another agent\'s edit of a source file in the building crate is refused', refused.status, 2);
expect('the refusal names the build and its starter', /cargo test -p a/.test(refused.stderr) && /S1\|agentBuilder/.test(refused.stderr) ? 1 : 0, 1);
const abs = join(crate, 'src', 'lib.rs').replace(/\\/g, '/');
const named = refused.stderr.split('\n').find((l) => l.trim().startsWith('builds --wait')) || '';
expect('KIT-T1142: the refusal names the one-call wait for the refused file, its cap and its Bash timeout', named.trim() === buildWaitCommand(join(crate, 'src', 'lib.rs'), 'S1|agentOther') && named.includes(`"${abs}"`) && /--timeout 170 --tool-timeout 180/.test(named) && /Bash timeout 180000/.test(refused.stderr) ? 1 : 0, 1);
const subagentGate = (command) => spawnSync(process.execPath, [fileURLToPath(new URL('./broker-wait-gate.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Bash', session_id: 'S1', agent_id: 'a1b2c3d4e5f6a7b8c', tool_input: { command, timeout: 180000 } }) });
expect('KIT-T1142: the wait the refusal names passes the subagent broker-wait gate', subagentGate(named.trim()).status, 0);
expect('KIT-T1142 control: the same gate refuses a sleep wait, so the pass above is not vacuous', subagentGate('sleep 60').status, 2);
expect('KIT-T1142: the wait script the shim runs is where the hook looks for it', existsSync(join(kitRoot, 'scripts', 'broker', 'build-status.mjs')) && readFileSync(join(kitRoot, 'bin', 'builds'), 'utf8').includes('scripts/broker/build-status.mjs') ? 1 : 0, 1);
expect('another session\'s edit is refused too', edit('S2', '', 'crates', 'a', 'src', 'lib.rs').status, 2);
expect('negative control: the build\'s own writer edits freely', edit('S1', 'agentBuilder', 'crates', 'a', 'src', 'lib.rs').status, 0);
expect('negative control: an edit in a crate the build does not compile passes', edit('S1', 'agentOther', 'crates', 'b', 'src', 'lib.rs').status, 0);
expect('negative control: a doc in the repo passes', edit('S1', 'agentOther', 'docs', 'x.md').status, 0);
expect('a file in the building crate that no compile reads (not a build input) passes', edit('S1', 'agentOther', 'crates', 'a', 'README.md').status, 0);

mkdirSync(join(crate, 'tests'), { recursive: true });
hold({ scope: [crate, `!${join(crate, 'tests')}`], writer: OWNER, phase: 'compiling' });
expect('KIT-T1143: an edit of a test file the build does not compile passes', edit('S1', 'agentOther', 'crates', 'a', 'tests', 'it.rs').status, 0);
expect('KIT-T1143 control: an edit of the same crate\'s source is still refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'lib.rs').status, 2);
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
expect('KIT-T1143 control: with no excluded directory the test file is held', edit('S1', 'agentOther', 'crates', 'a', 'tests', 'it.rs').status, 2);

hold({ scope: [crate], scopeVia: { [crate]: 'a -> core -> engine' }, writer: OWNER, phase: 'compiling' });
const chained = edit('S1', 'agentOther', 'crates', 'a', 'src', 'chain.rs');
expect('KIT-T1147: the refusal is the build hold\'s, not a claim', chained.status, 2);
expect('KIT-T1147: the refusal names the dependency chain that puts the file in the build\'s scope', /why this file: it is reached through a -> core -> engine/.test(chained.stderr) ? 1 : 0, 1);
expect('KIT-T1147 control: a precise hold prints no wide-scope line', /wider than the build's dependency closure/.test(chained.stderr) ? 1 : 0, 0);
hold({ scope: [tree], scopeVia: { [tree]: 'the whole workspace directory' }, scopeReason: 'cargo metadata failed in /w: error: failed to download js-sys', writer: OWNER, phase: 'compiling' });
const wide = edit('S1', 'agentOther', 'crates', 'a', 'src', 'wide.rs');
expect('KIT-T1147: a wide hold names why the scope is wide in the refusal', /wider than the build's dependency closure because cargo metadata failed in \/w: error: failed to download js-sys/.test(wide.stderr) && /through the whole workspace directory/.test(wide.stderr) ? 1 : 0, 1);
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });

// KIT-T1123: the creation of a Rust file no module names cannot change the running build.
writeFileSync(join(crate, 'Cargo.toml'), '[package]\nname = "a"\n');
writeFileSync(join(crate, 'src', 'lib.rs'), 'pub mod wired;\nmod model;\n');
mkdirSync(join(crate, 'src', 'model'), { recursive: true });
writeFileSync(join(crate, 'src', 'model', 'mod.rs'), 'mod known_child;\n');
expect('KIT-T1123: creating a new .rs file no module names passes', create('agentOther', 'crates', 'a', 'src', 'model', 'window.rs').status, 0);
expect('KIT-T1123: creating a new top-level .rs file no module names passes', create('agentOther', 'crates', 'a', 'src', 'fresh.rs').status, 0);
expect('KIT-T1123 control: an Edit to an existing referenced source file stays refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'lib.rs').status, 2);
expect('KIT-T1123 control: overwriting an existing unreferenced file stays refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'model', 'window.rs').status, 2);
rmSync(join(crate, 'src', 'model', 'window.rs'), { force: true });
writeFileSync(join(crate, 'src', 'lib.rs'), 'pub mod wired;\nmod model;\n');
expect('KIT-T1123 control: creating the file a mod declaration names stays refused', create('agentOther', 'crates', 'a', 'src', 'wired.rs').status, 2);
expect('KIT-T1123 control: creating the file a nested mod.rs declares stays refused', create('agentOther', 'crates', 'a', 'src', 'model', 'known_child.rs').status, 2);
expect('KIT-T1123 control: a name that only starts like a declared module is unreferenced', create('agentOther', 'crates', 'a', 'src', 'wire.rs').status, 0);
expect('KIT-T1123 control: a new src/bin target is discovered by cargo and stays refused', create('agentOther', 'crates', 'a', 'src', 'bin', 'tool.rs').status, 2);
expect('KIT-T1123 control: a new integration test is discovered by cargo and stays refused', create('agentOther', 'crates', 'a', 'tests', 'it.rs').status, 2);
expect('KIT-T1123 control: a new build.rs stays refused', create('agentOther', 'crates', 'a', 'build.rs').status, 2);
expect('KIT-T1123 control: a new Cargo.toml stays refused', create('agentOther', 'crates', 'a', 'Cargo.toml').status, 2);
writeFileSync(join(crate, 'Cargo.toml'), '[package]\nname = "a"\n');

hold({ scope: [crate], writer: OWNER, phase: 'running' });
expect('a hold in its test phase no longer compiles: the edit passes', edit('S1', 'agentOther', 'crates', 'a', 'src', 'two.rs').status, 0);

hold({ writer: OWNER, phase: 'compiling' });
expect('a hold with no recorded scope never refuses', edit('S1', 'agentOther', 'crates', 'a', 'src', 'three.rs').status, 0);

hold({ scope: [crate], phase: 'compiling' });
expect('a build with no recorded writer (a terminal) is foreign to every agent', edit('S1', 'agentOther', 'crates', 'a', 'src', 'four.rs').status, 2);

writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: 2 ** 22 + 12345, host: hostname(), cwd: tree, label: 'dead', scope: [crate], ts: new Date().toISOString() }));
expect('a dead build\'s hold refuses nothing', edit('S1', 'agentOther', 'crates', 'a', 'src', 'four.rs').status, 0);

// KIT-T1175: the wait and the hold judge the same file at different moments; a free answer binds for a window.
const RACER = 'S1|agentRacer';
const raceFile = join(crate, 'src', 'race.rs');
const raceNote = () => edit('S1', 'agentRacer', 'crates', 'a', 'src', 'race.rs').stderr;
const FIVE_SECONDS_MS = 5000;
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
const raced = edit('S1', 'agentRacer', 'crates', 'a', 'src', 'race.rs');
expect('KIT-T1175: a refused edit opens the writer\'s pending-edit window on the file', raced.status === 2 && windowFor({ file: raceFile })?.kind === KIND.REFUSED && windowFor({ file: raceFile })?.writer === RACER ? 1 : 0, 1);
expect('KIT-T1175: the refusal\'s wait command names the writer so its free answer opens that writer\'s window', raced.stderr.split('\n').some((l) => l.trim() === buildWaitCommand(raceFile, RACER)) ? 1 : 0, 1);
openWindow({ file: raceFile, writer: RACER, seconds: FREE_WINDOW_S, kind: KIND.FREE, now: Date.now() - FIVE_SECONDS_MS });
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
expect('KIT-T1175: a build that started after the free wait is named NEW in the refusal', /this build is NEW: it started at \S+, after builds --wait returned free at \S+/.test(raceNote()) ? 1 : 0, 1);
openWindow({ file: raceFile, writer: RACER, seconds: FREE_WINDOW_S, kind: KIND.FREE });
hold({ scope: [crate], writer: OWNER, phase: 'compiling', ts: new Date(Date.now() - FIVE_SECONDS_MS).toISOString() });
const resumed = raceNote();
expect('KIT-T1175: a build already running at the free wait is said to have compiled again', /already running when builds --wait returned free/.test(resumed) && !/this build is NEW/.test(resumed) ? 1 : 0, 1);
openWindow({ file: raceFile, writer: RACER, seconds: FREE_WINDOW_S, kind: KIND.FREE });
hold({ scope: [crate], writer: OWNER, phase: 'running' });
expect('KIT-T1175: the edit after a free wait passes', edit('S1', 'agentRacer', 'crates', 'a', 'src', 'race.rs').status, 0);
expect('KIT-T1175: the passing edit closes the writer\'s window', windowFor({ file: raceFile }) === null ? 1 : 0, 1);
expect('KIT-T1175 control: a refusal with no free wait before it carries no wait note', /builds --wait returned free/.test(guardAfterNoWindow()) ? 1 : 0, 0);

function guardAfterNoWindow() {
  hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
  return edit('S1', 'agentRacer', 'crates', 'a', 'src', 'race.rs').stderr;
}

finish();
