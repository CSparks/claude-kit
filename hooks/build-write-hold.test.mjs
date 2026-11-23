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
import { closeBatchRefusals } from '../scripts/broker/batch-refusal.mjs';
import { EDIT_GAP_S, FREE_WINDOW_S, KIND, blockingWindows, closeWindow, openWindow, waitOutWindows, windowFor } from '../scripts/broker/write-window.mjs';

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
// Each case judges the build hold alone: the batch refusal a case's earlier refusal left (write-batch.test.mjs, KIT-T1281) is cleared first.
// The edit landed: the PostToolUse hook that shortens the writer's windows to the edit gap (KIT-T1404).
const land = (session, agent, ...segments) => spawnSync(process.execPath, [fileURLToPath(new URL('./tool-write-record.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', env: process.env, input: JSON.stringify({ session_id: session, agent_id: agent, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: join(tree, ...segments) }, tool_response: {} }) });
const guard = (session, agent, file) => {
  closeBatchRefusals({ writer: `${session}|${agent || ''}` });
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

hold({ scope: [crate], writer: 'S1|', phase: 'compiling' });
expect('KIT-T1210: a build whose writer names the session but no agent never refuses an agent of that session', edit('S1', 'agentOther', 'crates', 'a', 'src', 'main.rs').status, 0);
expect('KIT-T1210 control: the same build still refuses an agent of another session', edit('S2', 'agentOther', 'crates', 'a', 'src', 'main.rs').status, 2);
expect('KIT-T1210 control: and the main thread of another session', edit('S2', '', 'crates', 'a', 'src', 'main.rs').status, 2);
hold({ scope: [crate], writer: 'S1|agentBuilder', phase: 'compiling' });
expect('KIT-T1210 control: a build that names its agent still refuses another agent of the same session', edit('S1', 'agentOther', 'crates', 'a', 'src', 'main.rs').status, 2);
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });

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
expect('KIT-T1190: an Edit of an existing file no module chain reaches passes', edit('S1', 'agentOther', 'crates', 'a', 'src', 'model', 'window.rs').status, 0);
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

// KIT-T1189, KIT-T1190: reachability follows the module chain, not a module's bare name.
const groundDir = join(crate, 'src', 'ground');
mkdirSync(join(crate, 'src', 'other'), { recursive: true });
mkdirSync(groundDir, { recursive: true });
writeFileSync(join(crate, 'src', 'lib.rs'), 'pub mod wired;\nmod model;\nmod ground;\nmod other;\nmod orphan_parent_not_declared_here;\n');
writeFileSync(join(groundDir, 'mod.rs'), 'mod declared_child;\n');
writeFileSync(join(crate, 'src', 'other', 'mod.rs'), 'mod surface;\n');
writeFileSync(join(crate, 'src', 'other', 'surface.rs'), 'x\n');
expect('KIT-T1189: a new file whose bare module name is declared elsewhere in the crate passes (ground/surface.rs, other/mod.rs declares surface)', create('agentOther', 'crates', 'a', 'src', 'ground', 'surface.rs').status, 0);
expect('KIT-T1189 control: the file its own parent declares stays refused', create('agentOther', 'crates', 'a', 'src', 'ground', 'declared_child.rs').status, 2);
expect('KIT-T1189 control: the file the other module declares stays refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'other', 'surface.rs').status, 2);
mkdirSync(join(crate, 'src', 'orphan'), { recursive: true });
writeFileSync(join(crate, 'src', 'orphan', 'mod.rs'), 'mod leaf;\n');
expect('KIT-T1190: a module file nothing declares passes', edit('S1', 'agentOther', 'crates', 'a', 'src', 'orphan', 'mod.rs').status, 0);
expect('KIT-T1190: a file only an undeclared module declares passes', edit('S1', 'agentOther', 'crates', 'a', 'src', 'orphan', 'leaf.rs').status, 0);
writeFileSync(join(crate, 'src', 'ground.rs'), 'mod nested_child;\n');
writeFileSync(join(crate, 'src', 'lib.rs'), 'mod ground_file;\n');
writeFileSync(join(crate, 'src', 'ground_file.rs'), 'mod inner;\n');
mkdirSync(join(crate, 'src', 'ground_file'), { recursive: true });
expect('KIT-T1190 control: a file declared by a non-mod.rs parent (ground_file.rs declares inner) stays refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'ground_file', 'inner.rs').status, 2);
expect('KIT-T1190 control: a file declared by a non-mod.rs parent that nothing declares passes (ground.rs declares nested_child)', edit('S1', 'agentOther', 'crates', 'a', 'src', 'ground', 'nested_child.rs').status, 0);
mkdirSync(join(crate, 'src', 'outer'), { recursive: true });
writeFileSync(join(crate, 'src', 'lib.rs'), 'mod outer { mod inner; }\n');
expect('KIT-T1190 control: a mod declared inside an inline block is not walked, so its file stays refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'outer', 'inner.rs').status, 2);
writeFileSync(join(crate, 'src', 'lib.rs'), '#[path = "elsewhere.rs"]\nmod renamed;\n');
expect('KIT-T1190 control: a crate using #[path] is not walked, a file it names stays refused', edit('S1', 'agentOther', 'crates', 'a', 'src', 'elsewhere.rs').status, 2);
expect('KIT-T1190 control: in a #[path] crate a file no file of the crate names passes', edit('S1', 'agentOther', 'crates', 'a', 'src', 'stranger.rs').status, 0);
writeFileSync(join(crate, 'src', 'lib.rs'), 'mod two;\nmod three;\nmod four;\nmod race;\n// mod "fake;" { }\nconst S: &str = "mod inside_a_string;";\n');

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
const MS_PER_SECOND = 1000;
const FIVE_SECONDS_MS = 5 * MS_PER_SECOND;
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
const inFlight = windowFor({ file: raceFile });
expect('KIT-T1404: while the passed edit has not landed, the writer\'s window stays open past the free window', inFlight && inFlight.until - Date.now() > FREE_WINDOW_S * MS_PER_SECOND ? 1 : 0, 1);
land('S1', 'agentRacer', 'crates', 'a', 'src', 'race.rs');
const landed = windowFor({ file: raceFile });
expect('KIT-T1219: the passing edit keeps the writer\'s window, shortened to the edit gap', landed?.kind === KIND.FREE && landed.until - Date.now() <= EDIT_GAP_S * MS_PER_SECOND ? 1 : 0, 1);
const heldBy = (writer, builder) => blockingWindows({ scope: [crate], writer: builder }).filter((w) => w.writer === writer).length;
const batchFile = join(crate, 'src', 'batch.rs');
expect('KIT-T1219: another writer\'s build start on the crate is still held after the first edit of a batch', heldBy(RACER, OWNER), 1);
expect('KIT-T1219 control: the writer\'s own build start is not held by its window', heldBy(RACER, RACER), 0);
expect('KIT-T1219: the next edit of the batch, in another file of the crate, passes', edit('S1', 'agentRacer', 'crates', 'a', 'src', 'batch.rs').status, 0);
land('S1', 'agentRacer', 'crates', 'a', 'src', 'batch.rs');
expect('KIT-T1219: the second file joins the writer\'s windows', windowFor({ file: batchFile })?.writer === RACER ? 1 : 0, 1);
let fakeNow = Date.now();
const buildStart = waitOutWindows({ scope: [crate], writer: OWNER, sleep: (ms) => { fakeNow += ms; }, now: () => fakeNow });
expect('KIT-T1219: a build start inside the window waits for the edit gap before it takes its hold', buildStart.waitedMs >= (EDIT_GAP_S - 1) * MS_PER_SECOND ? 1 : 0, 1);
closeWindow({ file: raceFile, writer: RACER });
closeWindow({ file: batchFile, writer: RACER });
expect('KIT-T1219 control: an edit by a writer with no window opens none', edit('S1', 'agentRacer', 'crates', 'a', 'src', 'solo.rs').status === 0 && heldBy(RACER, OWNER) === 0 ? 1 : 0, 1);
expect('KIT-T1175 control: a refusal with no free wait before it carries no wait note', /builds --wait returned free/.test(guardAfterNoWindow()) ? 1 : 0, 0);

const failFile = join(crate, 'src', 'fail.rs');
const failed = (session, agent, ...segments) => spawnSync(process.execPath, [fileURLToPath(new URL('./tool-write-record.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', env: process.env, input: JSON.stringify({ session_id: session, agent_id: agent, hook_event_name: 'PostToolUseFailure', tool_name: 'Edit', tool_input: { file_path: join(tree, ...segments) }, error: 'String to replace not found in file.' }) });
hold({ scope: [crate], writer: OWNER, phase: 'running' });
openWindow({ file: failFile, writer: RACER, seconds: FREE_WINDOW_S, kind: KIND.FREE });
edit('S1', 'agentRacer', 'crates', 'a', 'src', 'fail.rs');
const failedInFlight = windowFor({ file: failFile });
failed('S1', 'agentRacer', 'crates', 'a', 'src', 'fail.rs');
const afterFailure = windowFor({ file: failFile });
expect('KIT-T1425: a failed edit ends its in-flight hold at the edit gap instead of holding IN_FLIGHT_S', failedInFlight.until - Date.now() > FREE_WINDOW_S * MS_PER_SECOND && afterFailure.until - Date.now() <= EDIT_GAP_S * MS_PER_SECOND ? 1 : 0, 1);

function guardAfterNoWindow() {
  hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
  return edit('S1', 'agentNoWindow', 'crates', 'a', 'src', 'race.rs').stderr;
}

// KIT-T1510: a build that starts between two edits of a batch must not strand the rest of it.
const BATCHER = 'S1|agentBatcher';
const { recordToolWrite } = await import('./lib/tool-writes.mjs');
const { contentHashOf } = await import('./lib/shell-snapshot.mjs');
const relOf = (...segments) => segments.join('/');
writeFileSync(join(crate, 'src', 'lib.rs'), 'mod b1;\nmod b2;\nmod b3;\nmod b4;\n');
hold({ scope: [crate], writer: OWNER, phase: 'running' });
expect('KIT-T1510 setup: the first edit of the batch passes while no build compiles the crate', edit('S1', 'agentBatcher', 'crates', 'a', 'src', 'b1.rs').status, 0);
land('S1', 'agentBatcher', 'crates', 'a', 'src', 'b1.rs');
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
expect('KIT-T1510: a build that started after the batch\'s landed edit does not refuse the next edit of the batch', edit('S1', 'agentBatcher', 'crates', 'a', 'src', 'b2.rs').status, 0);
expect('KIT-T1510 control: another agent\'s edit of the same crate is still refused', edit('S1', 'agentStranger', 'crates', 'a', 'src', 'b3.rs').status, 2);
const refusedText = edit('S2', '', 'crates', 'a', 'src', 'b3.rs').stderr;
expect('KIT-T1510: a refusal says the edits of the batch that landed stand and this edit is retried first', /Edits of this batch that already landed stand/.test(refusedText) ? 1 : 0, 1);
hold({ scope: [crate], writer: OWNER, phase: 'compiling', ts: new Date(Date.now() - 60 * MS_PER_SECOND).toISOString() });
expect('KIT-T1510 control: a build that started before the landed edit is not a mid-batch build', edit('S1', 'agentBatcher', 'crates', 'a', 'src', 'b3.rs').status, 2);
writeFileSync(join(crate, 'src', 'b4.rs'), 'old\n');
const staleRel = relOf('crates', 'a', 'src', 'b4.rs');
recordToolWrite(tree, staleRel, contentHashOf(tree, staleRel), Date.now() - 600 * MS_PER_SECOND, 'S1|agentStale');
hold({ scope: [crate], writer: OWNER, phase: 'compiling' });
expect('KIT-T1510 control: a writer whose last landed edit is older than the batch idle window starts a new batch and is refused', edit('S1', 'agentStale', 'crates', 'a', 'src', 'b3.rs').status, 2);
void BATCHER;

finish();
