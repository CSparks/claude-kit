// commit-gate refuses `git commit -F <file>` when another agent of the session last wrote that file (KIT-T1135): the
// agents of one session share one scratchpad, and a fixed file name collided so a commit carried another agent's message.
// Run: node hooks/commit-message-owner.test.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('commit-message-owner');

try {
  const env = { CLAUDE_KIT_TURN_STATE: tmpDir('commit-owner-state-') };
  const target = adopted(true);
  const scratch = tmpDir('commit-owner-scratch-');
  const path = (name) => join(scratch, name).replace(/\\/g, '/');
  const MINE = 'fix the rings (implements KIT-T1135)\n';
  const THEIRS = 'shader kit pass (implements KIT-T1135)\n';

  const toolWrite = (file, text, agent) => {
    writeFileSync(file, text);
    hook('tool-write-record.mjs', { session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_input: { file_path: file } }, target, env);
  };
  const commit = (file, agent) => hook('commit-gate.mjs', { session_id: 'S1', ...(agent ? { agent_id: agent } : {}), tool_input: { command: `cd ${target} && git commit -q -F ${file}` } }, target, env);

  const shared = path('msg1.txt');
  toolWrite(shared, MINE, 'agentA');
  toolWrite(shared, THEIRS, 'agentB');
  const stale = commit(shared, 'agentA');
  ok('agent A is refused a message file agent B overwrote', stale.code === 2 && /last written by another agent/.test(stale.out) && stale.out.includes('agentB'), stale.out.trim());
  ok('the refusal names the unique-name convention', /commit-<ticket id>-/.test(stale.out));
  ok('agent B, the last writer, commits with it', commit(shared, 'agentB').code === 0);

  const own = path('commit-KIT-T1135-a1b2c3.txt');
  toolWrite(own, MINE, 'agentA');
  toolWrite(path('commit-KIT-T1135-d4e5f6.txt'), THEIRS, 'agentB');
  ok('negative control: a file only this agent wrote passes', commit(own, 'agentA').code === 0);

  const heredoc = path('by-shell.txt');
  writeFileSync(heredoc, MINE);
  ok('negative control: a file no tool recorded (a shell write) has no owner to judge', commit(heredoc, 'agentA').code === 0);

  const rewritten = path('rewritten.txt');
  toolWrite(rewritten, THEIRS, 'agentB');
  writeFileSync(rewritten, MINE);
  ok('negative control: a file rewritten by a shell since the tool wrote it is not judged', commit(rewritten, 'agentA').code === 0);

  const main = path('main-thread.txt');
  toolWrite(main, MINE, '');
  ok('the main thread owns the file it wrote, and an agent is refused it', commit(main, '').code === 0 && commit(main, 'agentA').code === 2);

  ok('negative control: a plain -m commit is not judged', hook('commit-gate.mjs', { session_id: 'S1', agent_id: 'agentA', tool_input: { command: `cd ${target} && git commit -q -m "x (implements KIT-T1135)"` } }, target, env).code === 0);
} finally {
  cleanup();
}

done();
