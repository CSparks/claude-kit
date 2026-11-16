// stuck-hooks (KIT-T1289): the housekeeping line lists kit hook processes older than five minutes with
// pid, age and cpu time. Run: node hooks/stuck-hooks.test.mjs

import { reporter } from './test-harness.mjs';
import { stuckHooks, stuckHooksLine } from './lib/stuck-hooks.mjs';

const { ok, done } = reporter('stuck-hooks');
const NOW = 10_000_000_000;
const MIN = 60000;
const HOOK_CMD = 'bash.exe -c "node compat-run.mjs dispatch-label.mjs"';
const proc = (pid, ppid, name, command, ageMin, cpuS = 0) => ({ pid, ppid, name, command, startedMs: NOW - ageMin * MIN, cpuMs: cpuS * 1000 });

const table = [
  proc(1, 0, 'claude.exe', 'claude compat-run.mjs', 900),
  proc(23084, 999, 'bash.exe', HOOK_CMD, 2664, 247713),
  proc(20, 1, 'bash.exe', HOOK_CMD, 6, 1),
  proc(21, 1, 'bash.exe', HOOK_CMD, 4, 1),
  proc(22, 1, 'bash.exe', 'bash -c unrelated', 900),
];

const stuck = stuckHooks(table, { now: NOW });
ok('hook processes over five minutes are stuck: the 44-hour orphan and the 6-minute one', stuck.map((s) => s.proc.pid).join() === '23084,20');
ok('a hook process under five minutes is not listed', !stuck.some((s) => s.proc.pid === 21));
ok('a process that is not a hook is not listed', !stuck.some((s) => s.proc.pid === 22));
ok('claude is never listed, even with the launcher in its arguments', !stuck.some((s) => s.proc.pid === 1));
ok('a missing parent marks the process orphaned; a live one does not', stuck[0].orphaned && !stuck[1].orphaned);

const line = stuckHooksLine(table, { now: NOW });
ok('the line names pid, age and cpu time', /pid 23084 bash 2664 min old, 247713 s cpu, parent gone/.test(line), line);
ok('a healthy table gives no line', stuckHooksLine(table.slice(3), { now: NOW }) === null);

done();
