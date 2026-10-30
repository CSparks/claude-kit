// broker-wait-gate + broker-agent-tag (KIT-D115): a SUBAGENT makes at most one bounded foreground wait on
// the broker; polling, loops, background waits and re-run jobs are denied; the main thread is never gated.
// Run: node hooks/broker-wait-gate.test.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, HOOKS, adopted, cleanup, hook, reporter, repo, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('broker-wait-gate');
const BROKER = 'D:/kit/scripts/broker';
const turnState = tmpDir('kit-turn-');

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const wired = (name) => wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes(name)));
  ok('both hooks are wired for Bash and PowerShell', ['broker-wait-gate', 'broker-agent-tag'].every((n) => wired(n) && /Bash/.test(wired(n).matcher) && /PowerShell/.test(wired(n).matcher)));

  const d = adopted(false);
  const env = { CLAUDE_KIT_TURN_STATE: turnState };
  const sub = (command, extra = {}, agent = 'a1b2c3d4e5f6a7b8c') => hook('broker-wait-gate.mjs', { tool_name: 'Bash', agent_id: agent, tool_input: { command, ...extra } }, d, env);
  const blocked = (r) => r.code === 2 && r.out.includes('KIT-D115') && r.out.includes('broker-wait');

  ok('negative: the main thread may wait, watch and background anything', ['node ' + BROKER + '/watch.mjs --for any', 'node ' + BROKER + '/wait.mjs j-1-a --timeout 900'].every((c) => hook('broker-wait-gate.mjs', { tool_name: 'Bash', tool_input: { command: c, run_in_background: true, timeout: 900000 } }, d, env).code === 0));
  ok('a subagent transcript path alone marks a subagent', hook('broker-wait-gate.mjs', { tool_name: 'Bash', transcript_path: '/p/s/subagents/agent-abc123.jsonl', tool_input: { command: `node ${BROKER}/watch.mjs` } }, d, env).code === 2);

  ok('negative: ONE foreground wait with a bounded timeout passes', sub(`node ${BROKER}/wait.mjs j-aaa-111 --root D:/x --timeout 280`).code === 0);
  ok('a SECOND wait on the same job is polling and is blocked', blocked(sub(`node ${BROKER}/wait.mjs j-aaa-111 --root D:/x`)));
  ok('negative: a wait on a different job passes', sub(`node ${BROKER}/wait.mjs j-bbb-222 --root D:/x`).code === 0);
  ok('another agent has its own single wait', sub(`node ${BROKER}/wait.mjs j-aaa-111 --root D:/x`, {}, 'fffffffffffffffff').code === 0);
  ok('wait --timeout over 300 s is blocked', blocked(sub(`node ${BROKER}/wait.mjs j-ccc-333 --timeout 540`)));
  ok('negative: wait --timeout 300 passes', sub(`node ${BROKER}/wait.mjs j-ddd-444 --timeout 300`).code === 0);

  ok('a background broker wait is blocked', blocked(sub(`node ${BROKER}/wait.mjs j-eee-555`, { run_in_background: true })));
  ok('a background cargo command is blocked', blocked(sub('cargo test -p x', { run_in_background: true })));
  ok('negative: a background command that is neither broker nor cargo passes', sub('node scripts/build.mjs', { run_in_background: true }).code === 0);
  ok('a Bash timeout over 300000 ms is blocked', blocked(sub('node scripts/x.mjs', { timeout: 600000 })));
  ok('negative: a Bash timeout of 290000 ms passes', sub('node scripts/x.mjs', { timeout: 290000 }).code === 0);

  ok('watch.mjs is blocked', blocked(sub(`node ${BROKER}/watch.mjs --root D:/x --for landing`)));
  ok('broker.mjs watch is blocked', blocked(sub(`node ${BROKER}/broker.mjs watch`)));
  ok('submit.mjs --wait is blocked', blocked(sub(`node ${BROKER}/submit.mjs --root D:/x --ticket T-1 --wait`)));
  ok('the incident shape, a wait piped through grep -v, is blocked on its second wait', blocked(sub(`node ${BROKER}/wait.mjs j-aaa-111 --root D:/x | grep -v "queued at position\\|running"`)));
  ok('a wait hidden in bash -c is blocked when it repeats', blocked(sub(`bash -c "node ${BROKER}/wait.mjs j-aaa-111"`)));

  ok('a sleep loop around the broker is blocked', blocked(sub('while true; do node ' + BROKER + '/broker.mjs status; sleep 20; done')));
  ok('a sleep loop on target/broker is blocked', blocked(sub('until grep -q passed target/broker/results/j-1.json; do sleep 5; done')));
  ok('tail -f on target/broker is blocked', blocked(sub('tail -f target/broker/finished.log')));
  ok('PowerShell Get-Content -Wait on target/broker is blocked', blocked(sub('Get-Content target\\broker\\finished.log -Wait')));
  ok('negative: sleep with no broker in the command passes', sub('sleep 2 && echo hi').code === 0);
  ok('negative: a loop over files with no broker passes', sub('for f in a b; do echo $f; done').code === 0);
  ok('negative: a for loop running q over scripts/broker never calls the broker (KIT-T734)', sub('for a in "x --path scripts/broker" "y --path scripts/broker/q.test.mjs"; do node q.mjs code $a; done').code === 0);
  ok('KIT-T734 control: a for loop that calls the broker client is still blocked', blocked(sub('for i in 1 2 3; do node ' + BROKER + '/broker.mjs status; done')));
  ok('ambiguous quoting (an escaped quote) still blocks a broker watch by its words', blocked(sub(`echo "a\\"b" && node ${BROKER}/watch.mjs --for any`)));

  const submit = `node ${BROKER}/submit.mjs --root D:/x --ticket T-1 --title "t" --test "cargo t -p x" < env.txt`;
  ok('negative: the first submit passes', sub(submit).code === 0);
  ok('the same submit repeated verbatim is blocked', blocked(sub(submit)));
  ok('negative: a repeat with --revises passes', sub(`${submit} --revises j-aaa-111`).code === 0);
  ok('negative: a changed submit passes', sub(submit.replace('T-1', 'T-2')).code === 0);

  ok('negative: q code searching for the script name passes', sub('node q.mjs code "wait.mjs" --path scripts').code === 0);
  ok('negative: git commit mentioning wait.mjs passes', sub('git commit -m "wait.mjs polls watch.mjs"').code === 0);
  ok('negative: prose with for/until/while around a script name is not a loop', sub('git commit -m "fix for wait.mjs until the broker restarts while idle"').code === 0);

  ok('the block message names the single allowed wait and the handoff', /ONCE/.test(sub(`node ${BROKER}/watch.mjs`).out) && /handoff/.test(sub(`node ${BROKER}/watch.mjs`).out));
  ok('in-source marker lets a flagged call through', sub(`node ${BROKER}/watch.mjs  # claude-kit-ignore broker-wait`).code === 0);
  ok('unadopted repo is never touched', hook('broker-wait-gate.mjs', { tool_name: 'Bash', agent_id: 'a1', tool_input: { command: `node ${BROKER}/watch.mjs` } }, repo(), env).code === 0);
  ok('malformed stdin fails open', spawnSync(process.execPath, [join(HOOKS, 'broker-wait-gate.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV }).status === 0);

  // broker-agent-tag
  const tag = (command, extra = {}, payload = { agent_id: 'a1b2c3d4e5f6a7b8c' }) => {
    const r = hook('broker-agent-tag.mjs', { tool_name: 'Bash', ...payload, tool_input: { command, ...extra } }, d, env);
    const out = r.out.trim() ? JSON.parse(r.out).hookSpecificOutput.updatedInput : null;
    return { ...r, input: out };
  };
  const s = tag(`node ${BROKER}/submit.mjs --root D:/x --ticket T-1`);
  ok('a subagent submit gets --agent <id> right after the script', s.input?.command === `node ${BROKER}/submit.mjs --agent a1b2c3d4e5f6a7b8c --root D:/x --ticket T-1`);
  const w = tag(`node ${BROKER}/wait.mjs j-1-a --root D:/x`);
  ok('a subagent wait gets --agent and --timeout 280', /wait\.mjs --agent a1b2c3d4e5f6a7b8c --timeout 280 j-1-a/.test(w.input?.command));
  ok('the wait gets a Bash timeout under 5 minutes that outlasts the wait', w.input?.timeout === 290000);
  ok('negative: a wait that names its --timeout keeps it', /--timeout 120\b/.test(tag(`node ${BROKER}/wait.mjs j-1-a --timeout 120`).input?.command) && !/--timeout 280/.test(tag(`node ${BROKER}/wait.mjs j-1-a --timeout 120`).input?.command));
  ok('negative: the main thread is untouched', tag(`node ${BROKER}/submit.mjs --root D:/x`, {}, {}).input === null);
  ok('negative: a command that is no broker call is untouched', tag('node q.mjs code "wait.mjs"').input === null);
  ok('negative: a submit already carrying --agent is not tagged twice', !/--agent \S+ .*--agent/.test(tag(`node ${BROKER}/submit.mjs --agent z9 --root D:/x`).input?.command || ''));
  ok('PowerShell quoting keeps working', /--agent a1b2c3d4e5f6a7b8c/.test(tag(`node "D:\\kit\\scripts\\broker\\submit.mjs" --root D:\\x`).input?.command));
  ok('tag malformed stdin fails open', spawnSync(process.execPath, [join(HOOKS, 'broker-agent-tag.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV }).status === 0);
} finally {
  cleanup();
}

done();
