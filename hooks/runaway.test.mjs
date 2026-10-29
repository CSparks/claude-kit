// runaway (KIT-T699): a stdin python or a CPU-spinning interpreter under a Bash-tool shell, older than five
// minutes, has its tree ended and a kit bug filed; younger, idle, broker-owned, excluded and claude
// processes are never touched. Run: node hooks/runaway.test.mjs

import { reporter } from './test-harness.mjs';
import { reapRunaways, runawayRoots } from './lib/runaway.mjs';

const { ok, done } = reporter('runaway');
const NOW = 10_000_000_000;
const MIN = 60000;
const SNAP = '/c/Users/u/.claude/shell-snapshots/snapshot-bash-1.sh';
const proc = (pid, ppid, name, command, ageMin = 0, cpuRatio = 0) => ({ pid, ppid, name, command, startedMs: NOW - ageMin * MIN, cpuMs: ageMin * MIN * cpuRatio });
const base = [
  proc(1, 0, 'claude.exe', 'claude', 600, 0.1),
  proc(10, 1, 'bash.exe', `bash -c source ${SNAP}`, 30),
];

const table = [
  ...base,
  proc(11, 10, 'python.exe', '"C:\\Python314\\python.exe" -', 6, 1),
  proc(12, 11, 'conhost.exe', 'conhost', 6),
  proc(20, 10, 'python.exe', 'python -', 4, 1),
  proc(30, 10, 'python.exe', 'python tool.py', 60, 0.02),
  proc(40, 10, 'bash.exe', 'bash -c while-true-loop', 10, 0.9),
  proc(50, 10, 'cargo.exe', 'cargo build --release', 60, 3),
];

const roots = runawayRoots(table, { now: NOW });
ok('a 6-minute stdin python is a runaway root', roots.some((r) => r.pid === 11 && r.reason === 'stdin-python'));
ok('a 4-minute stdin python is not', !roots.some((r) => r.pid === 20));
ok('a long-lived idle python script is not', !roots.some((r) => r.pid === 30));
ok('a CPU-spinning bash descendant is', roots.some((r) => r.pid === 40 && r.reason === 'cpu'));
ok('a CPU-heavy cargo build is not an interpreter and is left alone', !roots.some((r) => r.pid === 50));
ok('only top-most roots: the conhost under the python is not listed', !roots.some((r) => r.pid === 12));
ok('the Bash-tool shell itself is never a root', !roots.some((r) => r.pid === 10));

const mislabelled = [...base, proc(60, 10, 'claude.exe', `claude ${SNAP}`, 500, 0.9), proc(61, 60, 'python.exe', 'python -', 30, 1)];
ok('negative: a claude.exe carrying the snapshot path is never a root and is never entered', runawayRoots(mislabelled, { now: NOW }).length === 0);

const broker = [...base, proc(70, 10, 'node.exe', 'node D:/dev/claude-kit/scripts/broker/broker.mjs --root x', 60, 0.1), proc(71, 70, 'python.exe', 'python -', 30, 1)];
ok('negative: a runaway under a broker daemon is broker-owned and left alone', runawayRoots(broker, { now: NOW }).length === 0);
ok('an excluded process is skipped', runawayRoots(table, { now: NOW, skip: (p) => p.pid === 11 }).every((r) => r.pid !== 11));

const ended = [];
const filed = [];
const result = await reapRunaways({ table, now: NOW, kill: (pid) => ended.push(pid), fileBug: (b) => filed.push(b) });
ok('reapRunaways ends each runaway tree, leaves first', ended.join() === '12,11,40');
ok('it files one kit bug per tree and prints one line with the count', filed.length === 2 && filed.every((b) => b.project === 'claude-kit' && b.shape.startsWith('runaway-process:')) && /ended 2 runaway process tree\(s\)/.test(result.line));
ok('negative: claude.exe (1) and the tool shell (10) are never killed', !ended.includes(1) && !ended.includes(10));

const secret = proc(80, 10, 'python.exe', 'python - --token=xyz -H "Authorization: Bearer abc123" https://user:pw0rd@host.example/x', 30, 1);
const filedSecret = [];
await reapRunaways({ table: [...base, secret], now: NOW, kill: () => {}, fileBug: (b) => filedSecret.push(b) });
const written = JSON.stringify(filedSecret);
ok('a runaway with secrets in its command line files a bug', filedSecret.length === 1);
ok('the filed bug carries neither the bearer token, the --token value nor URL credentials', !/abc123|xyz|pw0rd|Authorization|token|user:/.test(written));
ok('the shape is built only from fixed tokens: reason and a lowercased executable name', /^runaway-process:stdin-python:[a-z0-9._-]+$/.test(filedSecret[0].shape));

done();
