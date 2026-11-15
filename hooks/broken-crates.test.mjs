#!/usr/bin/env node
// broken-crates.test.mjs — the per-crate broken marker (KIT-T1245, KIT-T1247): a failed check marks the crate with its last
// writer off the accepted-writes ledger, the blocked writer is told whom it waits on, the breaking writer is told once, a passing
// check over the crate clears the marker, `builds` lists it, and a refused edit says when the writer's crate is left half edited.
// Run: node hooks/broken-crates.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop } from './dispatch-guard-harness.mjs';

const slots = mkdtempSync(join(tmpdir(), 'bc-slots-'));
process.env.CLAUDE_KIT_BUILD_SLOT_DIR = slots;
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'bc-state-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'bc-holders-'));
const { firstError, readBroken, brokenLines, blockedText } = await import('./lib/broken-crates.mjs');
const { recordToolWrite } = await import('./lib/tool-writes.mjs');
const { recordCheck } = await import('./lib/crate-checks.mjs');

const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const makeTree = ({ adopt }) => {
  const dir = mkdtempSync(join(tmpdir(), 'bc-tree-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const tree = gitTop(dir);
  if (adopt) mkdirSync(join(tree, '.ai'), { recursive: true });
  const crate = join(tree, 'crates', 'a');
  mkdirSync(join(crate, 'src'), { recursive: true });
  writeFileSync(join(crate, 'Cargo.toml'), '[package]\nname = "a"\nversion = "0.1.0"\nedition = "2021"\n');
  writeFileSync(join(crate, 'src', 'lib.rs'), 'pub fn f() {}\n');
  return { tree, crate };
};
const REL = 'crates/a/src/lib.rs';
const { tree, crate } = makeTree({ adopt: true });
const FAILED = `error[E0425]: cannot find value \`x\` in this scope\n --> ${REL}:1:15\n  |\nerror: could not compile \`a\``;
const PASSED = '    Finished `dev` profile in 2s';

const hook = (script, payload, cwd = tree) => spawnSync(process.execPath, [here(script)], { cwd, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', cwd, ...payload }) });
const check = (agent, output, cwd = tree) => hook('crate-check.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Bash', agent_id: agent, tool_input: { command: 'cargo check -p a' }, tool_response: { stdout: '', stderr: output } }, cwd);
const anyTool = (agent) => hook('broken-crate-notice.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Read', agent_id: agent, tool_input: { file_path: join(tree, REL) } });
const stop = (agent) => hook('crate-check.mjs', { hook_event_name: 'SubagentStop', agent_id: agent });

expect('firstError: the first error line with its site, not the could-not-compile line', firstError(FAILED), `error[E0425]: cannot find value \`x\` in this scope (${REL}:1:15)`);
expect('firstError: output with no error gives nothing', firstError(PASSED), '');

recordToolWrite(tree, REL, 'h1', Date.now() - 60000, 'S1|agentBreaker');
const blocked = check('agentVictim', FAILED);
const marked = readBroken();
expect('a failed check marks the crate with the first error, the ledger writer and the checker', marked.length === 1 && marked[0].writer === 'S1|agentBreaker' && marked[0].checker === 'S1|agentVictim' && /E0425/.test(marked[0].error) ? 1 : 0, 1);
expect('the blocked writer is told whom it waits on, with the error and since when, no claim needed', blocked.status === 2 && /agentBreaker/.test(blocked.stderr) && /has not compiled since/.test(blocked.stderr) && /not your edit/.test(blocked.stderr) ? 1 : 0, 1);
expect('the marker keeps its first since across a second failing check', (() => { const since = readBroken()[0].since; check('agentVictim', FAILED); return readBroken()[0].since === since ? 1 : 0; })(), 1);

const fresh = makeTree({ adopt: true });
recordToolWrite(fresh.tree, REL, 'h9', Date.now() - 1000, 'S1|agentSelf');
check('agentSelf', FAILED, fresh.tree);
expect('control: a writer whose own check fails is not told another writer is to blame', readBroken().some((m) => m.writer === 'S1|agentSelf') ? 1 : 0, 1);
expect('the stop of a subagent that is no marked writer passes', stop('agentNobody').status, 0);

check('agentVictim', FAILED);
const notice = anyTool('agentBreaker');
expect('the breaking writer\'s next tool call of any kind is told its crate does not compile', notice.status === 2 && /crates[\\/]a/.test(notice.stderr) && /E0425/.test(notice.stderr) && /Fix it before any other work/.test(notice.stderr) ? 1 : 0, 1);
expect('the notice comes once per marker', anyTool('agentBreaker').status, 0);
expect('control: another writer\'s tool call is not told', anyTool('agentVictim').status, 0);
expect('control: the breaking writer\'s own failed check names nobody else', check('agentBreaker', FAILED).status, 0);

const listing = brokenLines(readBroken()).join('\n');
expect('`builds` lists the broken crate with its last writer', /broken crates:/.test(listing) && /crates\/a/.test(listing) && /agentBreaker/.test(listing) ? 1 : 0, 1);
const builds = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/broker/build-status.mjs', import.meta.url)), '--broken'], { encoding: 'utf8', env: process.env });
expect('`builds --broken` prints the section alone', /broken crates:/.test(builds.stdout) && /agentBreaker/.test(builds.stdout) && !/build budget/.test(builds.stdout) ? 1 : 0, 1);
expect('blockedText names the writer and the crate', /agentBreaker/.test(blockedText(readBroken())) ? 1 : 0, 1);

check('agentVictim', PASSED);
expect('a passing check that covers the crate clears its marker', readBroken().filter((m) => m.tree === tree).length, 0);

const plain = makeTree({ adopt: false });
recordToolWrite(plain.tree, REL, 'h8', Date.now() - 1000, 'S1|agentBreaker');
const before = readBroken().length;
check('agentVictim', FAILED, plain.tree);
expect('control: an unadopted repo writes no marker', readBroken().length, before);

const half = makeTree({ adopt: true });
const lib = join(half.crate, 'src', 'lib.rs');
const writeHold = () => writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: process.pid, host: hostname(), label: `${half.tree}: cargo test -p a`, cwd: half.tree, jobs: 4, ts: new Date().toISOString(), scope: [half.crate], writer: 'S9|agentBuilder', phase: 'compiling' }));
const refuse = (agent) => hook('holder-beat.mjs', { agent_id: agent, tool_input: { file_path: lib } }, half.tree);
writeHold();
expect('KIT-T1247 control: a refused edit by a writer with no earlier edit of the crate carries no half-edited line', /HALF EDITED/.test(refuse('agentFresh').stderr) ? 1 : 0, 0);
recordToolWrite(half.tree, 'crates/a/src/other.rs', 'h2', Date.now() - 30000, 'S1|agentHalf');
const refused = refuse('agentHalf');
expect('KIT-T1247: a refused edit of a crate the writer edited and did not check says the crate is left half edited', refused.status === 2 && /YOUR CRATE IS LEFT HALF EDITED/.test(refused.stderr) && /builds --wait/.test(refused.stderr) ? 1 : 0, 1);
recordCheck(half.tree, { writer: 'S1|agentHalf', ok: true, scope: [half.crate], ts: Date.now() - 1000 });
expect('KIT-T1247 control: after a passing check that covers the crate the refusal carries no half-edited line', /HALF EDITED/.test(refuse('agentHalf').stderr) ? 1 : 0, 0);

const { crateCheckArgs, errorFiles } = await import('./lib/crate-checks.mjs');
const { shimmedCommand } = await import('./lib/build-wrap.mjs');
const shaped = (name, output, command) => {
  const t = makeTree({ adopt: true });
  recordToolWrite(t.tree, REL, 'hs', Date.now() - 5000, `S1|agent-${name}`);
  hook('crate-check.mjs', { hook_event_name: 'PostToolUse', tool_name: 'PowerShell', cwd: t.crate, agent_id: 'agentVictim', tool_input: { command }, tool_response: { stdout: output, stderr: '' } }, t.tree);
  return readBroken().find((m) => m.tree === t.tree);
};
const COULD_NOT = 'error: could not compile `a` (lib) due to 1 previous error';
const piped = 'cargo check -p a 2>&1 | Select-String -Pattern "error"';
expect('the command the build wrapper rewrites to is still a crate check', ['PowerShell', 'Bash'].every((tool) => crateCheckArgs(shimmedCommand('cargo check -p a', tool, undefined, 'S|a'))?.join(' ') === 'check -p a') ? 1 : 0, 1);
expect('a check piped through a filter keeps its arguments, minus the redirect', crateCheckArgs(piped)?.join(' '), 'check -p a');
expect('errorFiles reads the short message format', errorFiles(`${REL}:1:15: error[E0425]: cannot find value \`x\``, tree).length, 1);
const filtered = shaped('filtered', `error[E0425]: cannot find value \`x\` in this scope\n${COULD_NOT}`, piped);
expect('an output filtered to its error lines still marks the crate, by the package it could not compile', filtered?.writer === 'S1|agent-filtered' && /E0425/.test(filtered.error) ? 1 : 0, 1);
const short = shaped('short', `${REL}:1:15: error[E0425]: cannot find value \`x\` in this scope\n${COULD_NOT}`, 'cargo check -p a --message-format=short');
expect('a check in the short message format marks the crate with the writer', short?.writer === 'S1|agent-short' && /lib\.rs:1:15/.test(short.error) ? 1 : 0, 1);
const refusedWriter = (() => {
  const t = makeTree({ adopt: true });
  const file = join(t.crate, 'src', 'lib.rs');
  recordToolWrite(t.tree, REL, 'landed-by-other', Date.now() - 9000, 'S1|agentLanded');
  writeFileSync(file, 'pub fn f() { x }\n');
  hook('tool-write-record.mjs', { agent_id: 'agentLanded', tool_input: { file_path: file } }, t.tree);
  recordToolWrite(t.tree, REL, 'never-landed-hash', Date.now() - 1000, 'S1|agentRefused');
  hook('crate-check.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Bash', agent_id: 'agentVictim', tool_input: { command: 'cargo check -p a' }, tool_response: { stdout: '', stderr: `error[E0425]: cannot find\n --> ${REL}:1:15\n${COULD_NOT}` } }, t.tree);
  return readBroken().find((m) => m.tree === t.tree)?.writer;
})();
expect('a refused edit\'s predicted ledger entry does not make its writer the last writer: the entry whose content is on disk does', refusedWriter, 'S1|agentLanded');

const crateB = join(half.tree, 'crates', 'b');
mkdirSync(join(crateB, 'src'), { recursive: true });
writeFileSync(join(crateB, 'Cargo.toml'), '[package]\nname = "b"\nversion = "0.1.0"\nedition = "2021"\n');
recordToolWrite(half.tree, 'crates/b/src/lib.rs', 'h3', Date.now() - 30000, 'S1|agentTwoCrates');
const twoCrates = refuse('agentTwoCrates');
expect('KIT-T1247: a refusal mid-change names the other crate the writer left unchecked', /crates[\\/]b/.test(twoCrates.stderr) && /LEFT HALF EDITED/.test(twoCrates.stderr) ? 1 : 0, 1);

recordToolWrite(half.tree, REL, 'h4', Date.now() - 20000, 'S1|agentRepair');
expect('control: before any check failed, the writer of a crate is refused by another writer\'s build', refuse('agentRepair').status, 2);
check('agentVictim', FAILED, half.tree);
expect('the repair edit of the writer whose crate is marked broken passes the build hold', refuse('agentRepair').status, 0);
expect('control: another writer\'s edit of the broken crate is still refused by the build hold', refuse('agentBystander').status, 2);
expect('control: the repairing writer\'s edit outside the broken crate is still refused when a build compiles it', (() => {
  writeFileSync(join(slots, 'slot-1'), JSON.stringify({ pid: process.pid, host: hostname(), label: 'cargo test -p b', cwd: half.tree, jobs: 4, ts: new Date().toISOString(), scope: [crateB], writer: 'S9|agentBuilder', phase: 'compiling' }));
  return hook('holder-beat.mjs', { agent_id: 'agentRepair', tool_input: { file_path: join(crateB, 'src', 'lib.rs') } }, half.tree).status;
})(), 2);

finish();
