#!/usr/bin/env node
// Gate heartbeats and the missing-gate warning (KIT-T1335): a session whose Stop list was fixed
// before two gates were wired is told once, by name, to restart.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sandbox = mkdtempSync(join(tmpdir(), 'gate-wiring-'));
process.env.CLAUDE_KIT_TURN_STATE = join(sandbox, 'state');
const { recordHeartbeat, heartbeatRan } = await import('./lib/gate-heartbeat.mjs');
const { expectedGates, wiringWarning } = await import('./lib/gate-wiring.mjs');

let pass = 0;
let fail = 0;
function ok(name, condition) {
  if (condition) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
  }
}

const STOP_GATES = Array.from({ length: 14 }, (_, i) => `stop-gate-${String(i + 1).padStart(2, '0')}.mjs`);
const MISSING = STOP_GATES[5];
const command = (script) => ({ type: 'command', command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/compat-run.mjs" ${script}` });

const hooksDir = join(sandbox, 'hooks');
mkdirSync(hooksDir);
for (const script of [...STOP_GATES, 'bash-gate.mjs', 'ask-gate.mjs']) writeFileSync(join(hooksDir, script), '');
const hooksJson = join(hooksDir, 'hooks.json');
const writeWiring = (stopScripts) => writeFileSync(hooksJson, JSON.stringify({
  hooks: {
    Stop: [{ hooks: stopScripts.map(command) }],
    PreToolUse: [
      { matcher: 'Bash|PowerShell', hooks: [command('bash-gate.mjs')] },
      { matcher: 'AskUserQuestion', hooks: [command('ask-gate.mjs')] },
    ],
  },
}));
writeWiring(STOP_GATES);
const wiring = { hooksJson, hooksDir };

const summaryRow = (hookCount) => JSON.stringify({ type: 'system', subtype: 'stop_hook_summary', hookCount, hookInfos: Array.from({ length: hookCount }, (_, i) => ({ command: `command hook ${i + 1}` })) });
const transcript = (rows) => {
  const file = join(sandbox, `transcript-${rows}-${Math.random().toString(36).slice(2, 8)}.jsonl`);
  writeFileSync(file, Array.from({ length: rows }, () => summaryRow(13)).join('\n') + '\n');
  return file;
};

let sessionCounter = 0;
const newSession = (ranScripts) => {
  const session = `session-${++sessionCounter}`;
  for (const script of ranScripts) recordHeartbeat({ session_id: session, hook_event_name: 'Stop' }, script);
  return session;
};
const stop = (session, file, extra = {}) => wiringWarning({ session_id: session, transcript_path: file, ...extra }, wiring);

const thirteen = STOP_GATES.filter((s) => s !== MISSING);
const longTranscript = transcript(5);

const s1 = newSession(thirteen);
ok('fixture lists 14 Stop gates', expectedGates(hooksJson, hooksDir).filter((g) => g.event === 'Stop').length === 14);
ok('first stop is too early to judge', stop(s1, longTranscript) === '');
const line = stop(s1, longTranscript);
ok('a 13-gate session against a 14-gate hooks.json is warned', line.includes(MISSING) && line.includes('restart this session to load them'));
ok('the warning is one line', !line.includes('\n'));
ok('the gates that ran are not named', thirteen.every((s) => !line.includes(s)));
ok('the same missing set is not warned twice', stop(s1, longTranscript) === '');

writeWiring([...STOP_GATES, 'stop-gate-15.mjs']);
writeFileSync(join(hooksDir, 'stop-gate-15.mjs'), '');
const widened = stop(s1, longTranscript);
ok('a changed missing set is warned again', widened.includes(MISSING) && widened.includes('stop-gate-15.mjs'));
writeWiring(STOP_GATES);

const s2 = newSession(STOP_GATES);
stop(s2, longTranscript);
ok('a session that ran every gate stays silent', stop(s2, longTranscript) === '');

const s3 = newSession(thirteen);
const shortTranscript = transcript(2);
stop(s3, shortTranscript);
ok('too few stops in the transcript stays silent', stop(s3, shortTranscript) === '');
ok('and warns once the transcript shows enough stops', stop(s3, longTranscript).includes(MISSING));

const s4 = newSession(thirteen);
ok('a stop_hook_active run never warns', stop(s4, longTranscript, { stop_hook_active: true }) === '');

const s5 = newSession(STOP_GATES);
stop(s5, longTranscript);
ok('a PreToolUse gate whose tool was never used is not named', stop(s5, longTranscript) === '');
recordHeartbeat({ session_id: s5, hook_event_name: 'PostToolUse', tool_name: 'Bash' }, 'other-gate.mjs');
const bashLine = stop(s5, longTranscript);
ok('a PreToolUse gate is named once a tool its matcher covers ran', bashLine.includes('bash-gate.mjs') && !bashLine.includes('ask-gate.mjs'));

// The launcher writes the heartbeat and flush carries the warning end to end.
const repo = mkdtempSync(join(tmpdir(), 'gate-wiring-repo-'));
mkdirSync(join(repo, '.ai'), { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: repo });
const runner = fileURLToPath(new URL('./compat-run.mjs', import.meta.url));
const realHooks = fileURLToPath(new URL('./', import.meta.url));
const realStop = expectedGates(join(realHooks, 'hooks.json'), realHooks).filter((g) => g.event === 'Stop').map((g) => g.script);
const absent = ['prose-ask-gate.mjs', 'process-failure-dispatch.mjs'];
const e2eSession = 'session-e2e';
for (const script of realStop.filter((s) => !absent.includes(s) && s !== 'flush.mjs')) {
  recordHeartbeat({ session_id: e2eSession, hook_event_name: 'Stop' }, script);
}
const e2eTranscript = transcript(5);
const runFlush = () => spawnSync(process.execPath, [runner, 'flush.mjs'], {
  cwd: repo,
  env: { ...process.env, CLAUDE_KIT_LIVE: '1', CLAUDE_KIT_TURN_STATE: process.env.CLAUDE_KIT_TURN_STATE },
  input: JSON.stringify({ cwd: repo, session_id: e2eSession, hook_event_name: 'Stop', transcript_path: e2eTranscript }),
  encoding: 'utf8',
});
const first = runFlush();
ok('the launcher records a heartbeat for the hook it ran', heartbeatRan(e2eSession, 'Stop', 'flush.mjs'));
ok('flush stays quiet on the first stop', first.status === 0 && first.stderr.trim() === '');
const second = runFlush();
ok('flush blocks once, naming both gates that never loaded', second.status === 2
  && absent.every((s) => second.stderr.includes(s)) && second.stderr.includes('restart this session to load them'));
ok('flush does not repeat the warning', runFlush().status === 0);

console.log(`\ngate-wiring: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
