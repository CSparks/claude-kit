// TaskStop closes the roster row (KIT-T362): a killed agent fires no SubagentStop, so PostToolUse(TaskStop) marks the row
// whose id is the stopped task_id as killed, and shared-tree-dispatch then lets the next writer in.
// Run: node hooks/task-stop-roster.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, inFlightRow, makeRepo, roster, run } from './dispatch-guard-harness.mjs';

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'ts-holders-'));
const CLAUDE_HOME = mkdtempSync(join(tmpdir(), 'ts-home-'));
process.env.CLAUDE_HOME = CLAUDE_HOME;
const { agentEntries, claimFile } = await import('./lib/checkout-holder.mjs');

const ROSTER_HOOK = fileURLToPath(new URL('./agent-roster.mjs', import.meta.url));
const writer = { subagent_type: 'general-purpose', model: 'opus', prompt: 'implement the next ticket (KIT-T362)' };

function taskStop(dir, payload) {
  return spawnSync(process.execPath, [ROSTER_HOOK], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: '' },
    input: typeof payload === 'string' ? payload : JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'TaskStop', ...payload }),
  }).status;
}

const rows = (dir) => readFileSync(join(dir, '.ai', 'agents.jsonl'), 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
const busy = (extra = {}) => roster(makeRepo({ cargo: true }), [inFlightRow(0, extra)]);

{
  const dir = busy();
  expect('control: a live writer blocks the next writer', run(dir, writer).code, 2);
  expect('TaskStop hook exits 0', taskStop(dir, { tool_input: { task_id: 'agent-live' }, tool_response: { task_id: 'agent-live' } }), 0);
  expect('after TaskStop of its id the next writer is allowed', run(dir, writer).code, 0);
  const closing = rows(dir).at(-1);
  expect('the appended row is a terminal killed row from taskstop', closing.id === 'agent-live' && closing.status === 'killed' && closing.source === 'taskstop' && Boolean(closing.ts) ? 1 : 0, 1);
}

{
  const dir = busy();
  taskStop(dir, { tool_input: { task_id: 'agent-other' }, tool_response: { task_id: 'agent-other' } });
  expect('negative control: TaskStop of a different id leaves the block in place', run(dir, writer).code, 2);
  expect('and appends no row', rows(dir).length, 1);
}

{
  const dir = busy();
  taskStop(dir, { tool_input: { shell_id: 'agent-live' } });
  expect('the legacy shell_id key closes the row too', run(dir, writer).code, 0);
}

{
  const dir = busy();
  taskStop(dir, { tool_input: {}, tool_response: { task_id: 'agent-live' } });
  expect('the id in the tool response alone closes the row', run(dir, writer).code, 0);
}

{
  const dir = busy();
  expect('malformed payload exits 0', taskStop(dir, '{ not json'), 0);
  expect('payload with no ids exits 0', taskStop(dir, { tool_input: null, tool_response: 'ok' }), 0);
  expect('fail-open leaves the roster as it was', rows(dir).length, 1);
}

{
  const dir = roster(makeRepo({ cargo: true }), [inFlightRow(), { ts: new Date().toISOString(), id: 'agent-live', status: 'done' }]);
  taskStop(dir, { tool_input: { task_id: 'agent-live' } });
  expect('an already finished agent gets no killed row', rows(dir).length, 2);
}

{
  const dir = makeRepo({ cargo: true });
  expect('no roster at all: exits 0 and writes none', taskStop(dir, { tool_input: { task_id: 'agent-live' } }), 0);
  expect('a writer row aimed at another checkout closes by id and frees that checkout', (() => {
    const other = gitTop(makeRepo());
    const d = roster(makeRepo({ cargo: true }), [inFlightRow(0, { targetRoot: other })]);
    taskStop(d, { tool_input: { task_id: 'agent-live' } });
    return run(d, { ...writer, prompt: `${writer.prompt} [tree: ${other}]` }).code;
  })(), 0);
}

{
  const tree = gitTop(makeRepo());
  const mine = 'agentclaims000001';
  const other = 'agentclaims000002';
  for (const agent of [mine, other]) claimFile({ tree, session: 'S1', agent, rel: 'src/a.rs', head: 'h' });
  const dir = roster(makeRepo({ cargo: true }), [inFlightRow(0, { id: mine })]);
  taskStop(dir, { tool_input: { task_id: mine } });
  expect('TaskStop releases the stopped agent\'s file claims', agentEntries(mine).length, 0);
  expect('negative control: another agent\'s claims stay', agentEntries(other).length, 1);
  taskStop(makeRepo(), { tool_input: { task_id: other } });
  expect('claims go even when this checkout\'s roster holds no row for the agent', agentEntries(other).length, 0);
}

// KIT-T1356: the PostToolUse(TaskStop) hook did not fire in one session, so the gate reads the harness's own record: a
// subagent transcript whose last entry is the interruption turn is a stopped agent, decided at read time.
const turn = (type, content) => JSON.stringify({ parentUuid: 'p', isSidechain: true, agentId: 'a', type, message: { role: type, content }, timestamp: new Date().toISOString() });
const REJECTED = turn('user', [{ type: 'tool_result', content: "The user doesn't want to proceed with this tool use.", is_error: true, tool_use_id: 'toolu_x' }]);
const INTERRUPTED = turn('user', [{ type: 'text', text: '[Request interrupted by user for tool use]' }]);
const WORKING = turn('assistant', [{ type: 'tool_use', id: 'toolu_y', name: 'Write', input: {} }]);
let sessionNo = 0;
function agentTranscript(id, lines) {
  const dir = join(CLAUDE_HOME, 'projects', 'D--dev-fixture', `session-${sessionNo++}`, 'subagents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `agent-${id}.jsonl`), lines.join('\n') + '\n');
}
const stopped = 'a6eb8222d80ef0001';
agentTranscript(stopped, [WORKING, REJECTED, INTERRUPTED]);
const stoppedRepo = busy({ id: stopped });
expect('a writer whose transcript ends on the interruption turn no longer blocks', run(stoppedRepo, writer).code, 0);
expect('and the gate writes no terminal row for it (a resume must count again)', rows(stoppedRepo).length, 1);
const working = 'a6eb8222d80ef0002';
agentTranscript(working, [WORKING]);
expect('negative control: a writer whose transcript ends mid-work still blocks', run(busy({ id: working }), writer).code, 2);
const resumed = 'a6eb8222d80ef0003';
agentTranscript(resumed, [WORKING, INTERRUPTED, turn('user', 'carry on'), WORKING]);
expect('a stopped writer resumed by SendMessage blocks again', run(busy({ id: resumed }), writer).code, 2);
expect('a writer with no transcript at all still blocks', run(busy({ id: 'a6eb8222d80ef0004' }), writer).code, 2);
const refusal = run(busy({ id: working }), writer).err;
expect('the refusal names the main thread\'s clear command', /claims --release <agent id> --reason "<why>"/.test(refusal) ? 1 : 0, 1);

finish();
