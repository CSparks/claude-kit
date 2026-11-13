// TaskStop closes the roster row (KIT-T362): a killed agent fires no SubagentStop, so PostToolUse(TaskStop) marks the row
// whose id is the stopped task_id as killed, and shared-tree-dispatch then lets the next writer in.
// Run: node hooks/task-stop-roster.test.mjs

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, gitTop, inFlightRow, makeRepo, roster, run } from './dispatch-guard-harness.mjs';

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

finish();
