// An agent's own guard waits never hold its own build, and an edit batch lands whole or not at all (KIT-T1281).
// (a) `builds --wait` without --writer is run with the agent's writer (build-wrap.mjs), so its windows are its own and its own
//     queued build ignores them; (b) once the write guard refused an edit of a crate for a running build, the writer's later edits
//     of that crate are refused too until its wait returns free or the marker lapses. Run: node hooks/write-batch.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const slots = mkdtempSync(join(tmpdir(), 'wb-slots-'));
process.env.CLAUDE_KIT_BUILD_SLOT_DIR = slots;
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'wb-holders-'));
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'wb-state-'));
const { shimmedCommand } = await import('./lib/build-wrap.mjs');
const { blockingWindows, windowFor } = await import('../scripts/broker/write-window.mjs');
const { BATCH_REFUSAL_S, closeBatchRefusals, noteBatchRefusal, refusedEarlierInBatch } = await import('../scripts/broker/batch-refusal.mjs');
const { runWait } = await import('../scripts/broker/build-wait.mjs');

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const WRITER = 'S1|agentX';

// (a) the writer rides along with `builds --wait`
const wait = 'builds --wait "D:/dev/x/crates/a/src/one.rs" --timeout 170 --tool-timeout 180';
check('a builds --wait is run with the writer in bash and PowerShell', shimmedCommand(wait, 'Bash', undefined, WRITER) === `export CLAUDE_KIT_BUILD_WRITER='${WRITER}'; ${wait}`
  && shimmedCommand(wait, 'PowerShell', undefined, WRITER) === `$env:CLAUDE_KIT_BUILD_WRITER = '${WRITER}'; ${wait}`);
check('control: no writer, no wait, or a writer already set leaves the command alone', shimmedCommand(wait, 'Bash') === null && shimmedCommand('builds', 'Bash', undefined, WRITER) === null
  && shimmedCommand('builds --audit', 'Bash', undefined, WRITER) === null && shimmedCommand(`export CLAUDE_KIT_BUILD_WRITER=Z; ${wait}`, 'Bash', undefined, WRITER) === null);
check('control: a cargo command still gets the shims and the writer', /build-shims/.test(shimmedCommand('cargo test -p a', 'Bash', undefined, WRITER)));

const file = join(tmpdir(), 'wb-crate', 'src', 'one.rs');
const scope = [join(tmpdir(), 'wb-crate')];
process.env.CLAUDE_KIT_BUILD_WRITER = WRITER;
const quiet = console.log;
console.log = () => {};
const code = await runWait(['--wait', file, '--timeout', '5', '--poll', '50']);
console.log = quiet;
delete process.env.CLAUDE_KIT_BUILD_WRITER;
check('a wait without --writer takes the writer from the environment and ends free', code === 0 && windowFor({ file })?.writer === WRITER);
check('the agent\'s own queued build is not held by its own window', blockingWindows({ scope, writer: WRITER }).length === 0);
check('control: another writer\'s build is held by it', blockingWindows({ scope, writer: 'S2|agentY' }).length === 1);

// (b) a batch lands whole or not at all
const tree = mkdtempSync(join(tmpdir(), 'wb-tree-'));
execFileSync('git', ['init', '-q'], { cwd: tree });
for (const crate of ['a', 'b']) {
  mkdirSync(join(tree, 'crates', crate, 'src'), { recursive: true });
  writeFileSync(join(tree, 'crates', crate, 'Cargo.toml'), `[package]\nname = "${crate}"\nversion = "0.1.0"\nedition = "2021"\n`);
}
const crateA = join(tree, 'crates', 'a');
writeFileSync(join(crateA, 'src', 'lib.rs'), 'pub mod one;\npub mod two;\npub mod three;\n');
for (const name of ['one', 'two', 'three']) writeFileSync(join(crateA, 'src', `${name}.rs`), 'pub fn f() {}\n');
const hold = () => writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: process.pid, host: hostname(), label: `${tree}: cargo test -p a`, cwd: tree, jobs: 4, ts: new Date().toISOString(), scope: [crateA], writer: 'S9|agentBuilder', phase: 'compiling' }));
const edit = (agent, ...segments) => spawnSync(process.execPath, [fileURLToPath(new URL('./holder-beat.mjs', import.meta.url))], { cwd: tree, encoding: 'utf8', env: process.env, input: JSON.stringify({ session_id: 'S1', agent_id: agent, tool_input: { file_path: join(tree, ...segments) } }) });
const one = ['crates', 'a', 'src', 'one.rs'];
const two = ['crates', 'a', 'src', 'two.rs'];

hold();
check('the first edit of the batch is refused by the running build', edit('agentX', ...one).status === 2);
rmSync(join(slots, 'slot-1'), { force: true });
const second = edit('agentX', ...two);
check('the build ended, yet a later edit of the batch to the same crate is refused too, and the refusal says why', second.status === 2 && /earlier edit of this batch/.test(second.stderr) && /whole or not at all/.test(second.stderr), second.stderr);
check('the refusal names the one wait that clears it', /builds --wait ".*one\.rs"/.test(second.stderr));
check('a file of the crate no build reads (a README) passes beside the marker: only edits the hold would have refused are held', edit('agentX', 'crates', 'a', 'README.md').status === 0);
check('an edit of another crate of the same batch passes',edit('agentX', 'crates', 'b', 'src', 'lib.rs').status === 0);
check('another writer\'s edit of that crate passes: the marker is the refused writer\'s alone', edit('agentY', 'crates', 'a', 'src', 'three.rs').status === 0);

process.env.CLAUDE_KIT_BUILD_WRITER = 'S1|agentX';
console.log = () => {};
await runWait(['--wait', join(tree, ...one), '--timeout', '5', '--poll', '50']);
console.log = quiet;
delete process.env.CLAUDE_KIT_BUILD_WRITER;
check('the writer\'s wait returning free ends the batch refusal: the whole batch can be sent again', edit('agentX', ...one).status === 0 && edit('agentX', ...two).status === 0);

hold();
check('a new running build refuses the next batch again', edit('agentX', ...one).status === 2);
rmSync(join(slots, 'slot-1'), { force: true });
const lapse = Date.now() - (BATCH_REFUSAL_S + 5) * 1000;
noteBatchRefusal({ file: join(tree, ...one), writer: 'S1|agentX', scope: [crateA], now: lapse });
check('a marker older than BATCH_REFUSAL_S has lapsed: the edit passes', refusedEarlierInBatch({ file: join(tree, ...two), writer: 'S1|agentX' }) === null);
closeBatchRefusals({ writer: 'S1|agentX' });
check('control: a fresh marker is seen only for the writer and a file in its scope', (() => {
  noteBatchRefusal({ file: join(tree, ...one), writer: 'S1|agentX', scope: [crateA] });
  return Boolean(refusedEarlierInBatch({ file: join(tree, ...two), writer: 'S1|agentX' })) && refusedEarlierInBatch({ file: join(tree, ...two), writer: 'S1|agentY' }) === null
    && refusedEarlierInBatch({ file: join(tree, 'crates', 'b', 'src', 'lib.rs'), writer: 'S1|agentX' }) === null;
})());

console.log(fails ? `\nwrite-batch: ${fails} failed` : '\nwrite-batch: all pass');
process.exit(fails ? 1 : 0);
