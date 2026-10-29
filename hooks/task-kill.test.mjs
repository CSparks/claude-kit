// task-kill (KIT-T699): SubagentStop ends the Bash-tool shell tree of a task whose owner is gone; a claude
// process, a broker command, a shell outside a claude session and a too-short command are never killed.
// Run: node hooks/task-kill.test.mjs

import { reporter } from './test-harness.mjs';
import { descendantsOf, hasClaudeAncestor, killTree, toolShells } from './lib/process-tree.mjs';
import { killOrphanTasks } from './lib/task-kill.mjs';

const { ok, done } = reporter('task-kill');
const SNAP = 'C:\\Users\\u\\.claude\\shell-snapshots\\snapshot-bash-1.sh';
const proc = (pid, ppid, name, command = '') => ({ pid, ppid, name, startedMs: 0, cpuMs: 0, command });
const shell = (pid, ppid, inner) => proc(pid, ppid, 'bash.exe', `C:\\Git\\bash.exe -c -l source '${SNAP}' && eval 'python3 - <<EOF ${inner} EOF'`);

const table = [
  proc(1, 0, 'claude.exe', `claude --resume source ${SNAP}`),
  shell(10, 1, 'import-time-sleep-forever-loop'),
  proc(11, 10, 'python.exe', 'python -'),
  proc(12, 11, 'conhost.exe'),
  shell(20, 1, 'broker-daemon-stuff-long-enough'),
  proc(30, 0, 'bash.exe', `bash -c source ${SNAP} && eval 'python3 - import-time-sleep-forever-loop'`),
  shell(40, 1, 'ls'),
  shell(50, 1, 'node D:/kit/scripts/broker/wait.mjs j-aaa-111 --root D:/x'),
  proc(51, 50, 'node.exe', 'node wait.mjs j-aaa-111'),
];
const kills = () => { const ended = []; return { ended, kill: (pid) => ended.push(pid) }; };
const orphan = (id, command) => ({ id, command });

ok('toolShells finds snapshot-sourcing bashes and never claude.exe', toolShells(table).map((p) => p.pid).join() === '10,20,30,40,50');
ok('descendantsOf never enters a claude process', descendantsOf(table, 0).every((p) => p.name !== 'claude.exe') && descendantsOf(table, 10).map((p) => p.pid).join() === '11,12');
ok('hasClaudeAncestor: true under claude, false for an unparented shell', hasClaudeAncestor(table, 11) && !hasClaudeAncestor(table, 30));

const a = kills();
ok('killTree ends the leaves first, then the root', killTree(table, 10, a.kill).join() === '12,11,10' && a.ended.join() === '12,11,10');
const b = kills();
ok('killTree refuses a claude.exe root', killTree(table, 1, b.kill).length === 0 && b.ended.length === 0);

const c = kills();
const done1 = killOrphanTasks([orphan('bihj2rbyh', "python3 - <<EOF import-time-sleep-forever-loop EOF")], { table, kill: c.kill });
ok('a task is found by its command text in the shell command line and its tree is ended', done1.length === 1 && done1[0].id === 'bihj2rbyh' && c.ended.join() === '12,11,10');
ok('negative: the claude.exe session and the unparented shell survive', !c.ended.includes(1) && !c.ended.includes(30));

const d = kills();
ok('negative: a broker command is reported, not killed', killOrphanTasks([orphan('bbrk', 'node scripts/broker/broker.mjs --root x broker-daemon-stuff-long-enough')], { table, kill: d.kill }).length === 0 && d.ended.length === 0);
const w = kills();
const waitKill = killOrphanTasks([orphan('bwait', 'node D:/kit/scripts/broker/wait.mjs j-aaa-111 --root D:/x')], { table, kill: w.kill });
ok('a background broker wait is ended with its tree (KIT-D115)', waitKill.length === 1 && w.ended.join() === '51,50');
ok('negative: the daemon (broker.mjs) next to it is still not killed', !w.ended.includes(20));
ok('negative: a command too short to match safely is skipped', killOrphanTasks([orphan('bshort', 'ls')], { table, kill: d.kill }).length === 0 && d.ended.length === 0);
ok('negative: a command in no shell kills nothing', killOrphanTasks([orphan('bnone', 'some-other-long-command-here')], { table, kill: d.kill }).length === 0);
ok('no orphans, no process-table read', killOrphanTasks([]).length === 0);

done();
