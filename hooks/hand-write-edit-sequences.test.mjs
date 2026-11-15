// An Edit or Write the tracker saw is never held against a shell call or a commit as a hand write (KIT-T1257): an Edit refused
// by the write guard and then accepted, two writers landing on one file, an Edit and a shell call of one agent issued in one
// batch, and a confirmation that lags past the settle wait. Run: node hooks/hand-write-edit-sequences.test.mjs

import { utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, reporter } from './test-harness.mjs';
import { SETTLE_MS, handWriteHarness } from './hand-write-harness.mjs';

const { ok, done } = reporter('hand-write-edit-sequences');

try {
  const { spawnHook, spawnHookAsync, fresh, commit } = handWriteHarness();
  const CHECKER = 'rapid-game/tools/meshkit-check.exe script.txt';
  const SESSION = 'ORCH';
  const LAG_MS = 400;
  const PAST_SETTLE_MS = SETTLE_MS + 1000;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const A9 = 'export const a = 9;\n';
  let id = 0;

  const setup = () => {
    const d = fresh();
    const file = join(d, 'src', 'a.mjs');
    const editBy = (agent, input) => ({ session_id: SESSION, agent_id: agent, tool_input: { file_path: file, ...input } });
    const shell = (agent) => ({ session_id: SESSION, agent_id: agent, tool_use_id: `seq${++id}`, tool_name: 'Bash', tool_input: { command: CHECKER } });
    const preWrite = (payload) => spawnHook('pre-write.mjs', payload, d);
    const confirm = (payload) => spawnHook('tool-write-record.mjs', { ...payload, hook_event_name: 'PostToolUse', tool_response: {} }, d);
    const shellPre = (base) => spawnHook('hand-write-detect.mjs', { ...base, hook_event_name: 'PreToolUse' }, d);
    const shellPost = (base) => spawnHookAsync('hand-write-detect.mjs', { ...base, hook_event_name: 'PostToolUse', tool_response: {} }, d);
    const refused = () => commit(d, SESSION, ['src/a.mjs']).out.includes('KIT-T706');
    return { d, file, editBy, shell, preWrite, confirm, shellPre, shellPost, refused };
  };
  const blamed = (r) => r.status === 2 && r.stderr.includes('src/a.mjs');
  const spared = (r) => r.status === 0 && !r.stderr.includes('HAND WRITE');

  const retried = setup();
  const retryEdit = retried.editBy('laneY', { old_string: 'a = 1', new_string: 'a = 9' });
  retried.preWrite(retryEdit);
  const retryShell = retried.shell('laneX');
  retried.shellPre(retryShell);
  retried.preWrite(retryEdit);
  writeFileSync(retried.file, A9);
  retried.confirm(retryEdit);
  const retriedPost = await retried.shellPost(retryShell);
  ok('an Edit refused by the write guard and then accepted is not blamed on a shell call that ran meanwhile', spared(retriedPost), retriedPost.stderr);
  ok('the commit holding that file is not refused', !retried.refused());

  const twoWriters = setup();
  const yEdit = twoWriters.editBy('laneY', { old_string: 'a = 1', new_string: 'a = 9' });
  const zWrite = twoWriters.editBy('laneZ', { content: 'export const a = 1;\nexport const z = 3;\n' });
  twoWriters.preWrite(yEdit);
  twoWriters.preWrite(zWrite);
  const twoShell = twoWriters.shell('laneX');
  twoWriters.shellPre(twoShell);
  writeFileSync(twoWriters.file, 'export const a = 1;\nexport const z = 3;\n');
  twoWriters.confirm(zWrite);
  writeFileSync(twoWriters.file, 'export const a = 9;\nexport const z = 3;\n');
  twoWriters.confirm(yEdit);
  const twoPost = await twoWriters.shellPost(twoShell);
  ok('two writers landing on one file (one prediction made before the other landed) are not blamed on a shell call', spared(twoPost), twoPost.stderr);
  ok('the commit holding that file is not refused', !twoWriters.refused());

  const batch = setup();
  const ownEdit = batch.editBy('laneX', { old_string: 'a = 1', new_string: 'a = 9' });
  const ownShell = batch.shell('laneX');
  batch.preWrite(ownEdit);
  batch.shellPre(ownShell);
  writeFileSync(batch.file, A9);
  const ownPost = batch.shellPost(ownShell);
  await sleep(LAG_MS);
  batch.confirm(ownEdit);
  const ownResult = await ownPost;
  ok('an Edit and a shell call of ONE agent issued in one batch, the confirmation lagging, is not blamed on the call', spared(ownResult), ownResult.stderr);
  ok('the commit holding that file is not refused', !batch.refused());

  const late = setup();
  const lateEdit = late.editBy('laneY', { old_string: 'a = 1', new_string: 'a = 9' });
  const lateShell = late.shell('laneX');
  late.preWrite(lateEdit);
  late.shellPre(lateShell);
  writeFileSync(late.file, A9);
  const latePost = late.shellPost(lateShell);
  await sleep(PAST_SETTLE_MS);
  late.confirm(lateEdit);
  const lateResult = await latePost;
  ok('control: a confirmation arriving after the settle wait leaves the shell call blamed at that moment', blamed(lateResult), lateResult.stderr);
  ok('the confirmed Edit content is no longer held against the commit once the confirmation lands', !late.refused());

  const never = setup();
  const neverEdit = never.editBy('laneY', { old_string: 'a = 1', new_string: 'a = 9' });
  const neverShell = never.shell('laneX');
  never.preWrite(neverEdit);
  never.shellPre(neverShell);
  writeFileSync(never.file, A9);
  const neverResult = await never.shellPost(neverShell);
  ok('control: an Edit nothing ever confirms is still blamed', blamed(neverResult), neverResult.stderr);
  ok('control: and the commit holding it is refused', never.refused());

  const touched = setup();
  writeFileSync(touched.file, 'export const a = 3;\n');
  const touchShell = touched.shell('laneX');
  touched.shellPre(touchShell);
  const LATER = new Date(Date.now() + 60000);
  utimesSync(touched.file, LATER, LATER);
  const touchResult = await touched.shellPost(touchShell);
  ok('KIT-T1255: a dirty source file another process only touched or restored byte for byte is not a change of the call', spared(touchResult), touchResult.stderr);

  const landedDuring = setup();
  const duringShell = landedDuring.shell('laneX');
  const duringEdit = landedDuring.editBy('laneY', { old_string: 'a = 1', new_string: 'a = 9' });
  landedDuring.shellPre(duringShell);
  landedDuring.preWrite(duringEdit);
  writeFileSync(landedDuring.file, A9);
  landedDuring.confirm(duringEdit);
  const duringResult = await landedDuring.shellPost(duringShell);
  ok('KIT-T1255: another agent\'s accepted Edit of a source file during a long shell call is not a shell write', spared(duringResult), duringResult.stderr);
  ok('the commit holding that file is not refused', !landedDuring.refused());

  const handWritten = setup();
  const handShell = handWritten.shell('laneX');
  handWritten.shellPre(handShell);
  writeFileSync(handWritten.file, 'export const a = 5;\n');
  const handResult = await handWritten.shellPost(handShell);
  ok('control: a file only a shell call wrote is blamed and its commit refused', blamed(handResult) && handWritten.refused(), handResult.stderr);
} finally {
  cleanup();
  done();
}
