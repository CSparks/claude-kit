// broker-wait-release (KIT-T739): a wait whose script never started does not spend the subagent's one wait.
// Run: node hooks/broker-wait-release.test.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, HOOKS, adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('broker-wait-release');
const BROKER = 'D:/kit/scripts/broker';
const AGENT = 'a1b2c3d4e5f6a7b8c';
const turnState = tmpDir('kit-turn-');

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const wired = wiring.hooks.PostToolUseFailure?.find((e) => e.hooks.some((h) => h.command.includes('broker-wait-release')));
  ok('the release is wired on PostToolUseFailure for Bash and PowerShell', wired && /Bash/.test(wired.matcher) && /PowerShell/.test(wired.matcher));

  const d = adopted(false);
  const env = { CLAUDE_KIT_TURN_STATE: turnState };
  const gate = (command, agent = AGENT) => hook('broker-wait-gate.mjs', { tool_name: 'Bash', agent_id: agent, tool_input: { command } }, d, env);
  const fail = (command, error, agent = AGENT) => hook('broker-wait-release.mjs', { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', agent_id: agent, tool_input: { command }, error }, d, env);
  const spaceHome = 'Error: Cannot find module \'C:\\Users\\Chris\'\n  code: \'MODULE_NOT_FOUND\'';

  const wait = (id) => `node $HOME/rt/scripts/broker/wait.mjs ${id} --root D:/x`;
  ok('a wait that never started is released, so the real wait passes', gate(wait('j-aaa-111')).code === 0
    && fail(wait('j-aaa-111'), spaceHome).code === 0
    && gate(`node ${BROKER}/wait.mjs j-aaa-111 --root D:/x`).code === 0);
  ok('control: a wait that started and failed for another reason still counts, a second is polling', gate(`node ${BROKER}/wait.mjs j-bbb-222`).code === 0
    && fail(`node ${BROKER}/wait.mjs j-bbb-222`, 'Exit code 1\nbroker: job j-bbb-222 timed out').code === 0
    && gate(`node ${BROKER}/wait.mjs j-bbb-222`).code === 2);
  ok('control: without the release a never-started wait blocks the next', gate(wait('j-ccc-333')).code === 0 && gate(`node ${BROKER}/wait.mjs j-ccc-333`).code === 2);
  ok('a submit that never started may be re-run verbatim', (() => {
    const submit = `node $HOME/rt/scripts/broker/submit.mjs --root D:/x --ticket T-9 --title "t"`;
    return gate(submit).code === 0 && fail(submit, 'bash: node: command not found').code === 0 && gate(submit).code === 0;
  })());
  ok('another agent\'s failure never releases this agent\'s wait', gate(`node ${BROKER}/wait.mjs j-ddd-444`, 'eeeeeeeeeeeeeeeee').code === 0
    && fail(`node ${BROKER}/wait.mjs j-ddd-444`, spaceHome).code === 0
    && gate(`node ${BROKER}/wait.mjs j-ddd-444`, 'eeeeeeeeeeeeeeeee').code === 2);
  ok('the main thread is ignored', hook('broker-wait-release.mjs', { tool_name: 'Bash', tool_input: { command: wait('j-fff-555') }, error: spaceHome }, d, env).code === 0);
  ok('malformed stdin fails open', spawnSync(process.execPath, [join(HOOKS, 'broker-wait-release.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV }).status === 0);
  ok('unadopted repo is never touched', hook('broker-wait-release.mjs', { tool_name: 'Bash', agent_id: AGENT, tool_input: { command: wait('j-aaa-111') }, error: spaceHome }, repo(), env).code === 0);
} finally {
  cleanup();
}

done();
