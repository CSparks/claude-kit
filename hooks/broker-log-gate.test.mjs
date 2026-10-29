// broker-log-gate (KIT-T697, KIT-T633): a Bash/PowerShell/Monitor command that follows or searches the
// broker's daemon logs is blocked and pointed at wait.mjs / watch.mjs; one named job log may be read once.
// Run: node hooks/broker-log-gate.test.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, HOOKS, adopted, cleanup, hook, reporter, repo } from './test-harness.mjs';
import { hiddenBehindQuotes } from './hidden-command-cases.mjs';

const { ok, done } = reporter('broker-log-gate');
const LOGS = '/d/dev/dirt-empire/target/broker/logs';

try {
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const entry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('broker-log-gate')));
  ok('wired into hooks.json for Bash, PowerShell and Monitor', !!entry && ['Bash', 'PowerShell', 'Monitor'].every((t) => entry.matcher.includes(t)));

  const d = adopted(false);
  const run = (tool, command, dir = d) => hook('broker-log-gate.mjs', { tool_name: tool, tool_input: { command } }, dir);
  const blocked = (tool, command) => { const r = run(tool, command); return r.code === 2 && /wait\.mjs/.test(r.out) && /watch\.mjs/.test(r.out) && r.out.includes('broker-log'); };

  ok('the Monitor tail -F | grep pipeline of the 2026-10-28 incident is blocked', blocked('Monitor', `tail -n 0 -F ${LOGS}/daemon-2026-10-28T16-54-37-526Z-27728.log | grep -E --line-buffered "suite|→ (failed|landed|stale)|crash"`));
  ok('KIT-T705 negative control: node -e with escaped quotes and no log path passes', run('Bash', 'node -e "console.log(\\"x\\")"').code === 0);
  ok('KIT-T705: a log grep hidden behind an escaped quote or a $\'…\' string is blocked', hiddenBehindQuotes(`grep crash ${LOGS}/daemon-x.log`).every((c) => blocked('Bash', c)));
  ok('tail -f of a lane log is blocked', blocked('Bash', 'tail -f target/broker/lanes/rapid-game/logs/daemon-x.log'));
  ok('grep of a logs glob is blocked', blocked('Bash', `grep -l crash ${LOGS}/*.log`));
  ok('grep of a daemon log is blocked', blocked('Bash', `grep "→ landed" ${LOGS}/daemon-2026-10-28.log`));
  ok('tail of the daemon log without -f is blocked', blocked('Bash', `tail -n 50 ${LOGS}/daemon-2026-10-28.log`));
  ok('PowerShell Get-Content -Wait is blocked', blocked('PowerShell', String.raw`Get-Content target\broker\logs\daemon-a.log -Wait`));
  ok('a chain hiding the follow in a later segment is blocked', blocked('Bash', `echo arming && tail -F ${LOGS}/job-1.log`));

  ok('negative: a one-shot read of ONE job log passes', run('Bash', `tail -n 40 ${LOGS}/j-1abc-2.log`).code === 0);
  ok('negative: grep -F of a named job log is not a follow and passes', run('Bash', `grep -F panicked ${LOGS}/j-1abc-2.log`).code === 0);
  ok('negative: tail -f of an ordinary file passes', run('Bash', 'tail -f /tmp/app.log').code === 0);
  ok('negative: wait.mjs and watch.mjs invocations pass', run('Bash', 'node scripts/broker/wait.mjs j-1-a --root . && node scripts/broker/watch.mjs --for suite').code === 0);
  ok('negative: a filter over command output passes', run('Bash', 'node broker.mjs status | grep -i suite').code === 0);

  const e = adopted(false);
  writeFileSync(join(e, '.claude-kit-ignore.yaml'), 'broker-log:\n  - "**/broker/logs/**"\n');
  ok('.claude-kit-ignore.yaml glob lets a follow through', run('Bash', `tail -F ${LOGS}/daemon-a.log`, e).code === 0);
  ok('in-source marker lets a follow through', run('Bash', `tail -F ${LOGS}/daemon-a.log  # claude-kit-ignore broker-log`).code === 0);
  ok('unadopted repo is never touched', run('Bash', `tail -F ${LOGS}/daemon-a.log`, repo()).code === 0);
  const bad = spawnSync(process.execPath, [join(HOOKS, 'broker-log-gate.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV });
  ok('malformed stdin fails open', bad.status === 0);
} finally {
  cleanup();
}

done();
