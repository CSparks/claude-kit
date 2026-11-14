// gate-digest (KIT-T1053): a compaction start prints a few lines naming the tag each gate check takes, derived from the
// gate definitions; a startup, resume or clear start prints nothing.
// Run: node hooks/gate-digest.test.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ENV, HOOKS, cleanup, hook, reporter, repo } from './test-harness.mjs';
import { GATES, gateDigest } from './lib/gate-protocol.mjs';

const { ok, done } = reporter('gate-digest');
const LINE_BUDGET = 15;
const WIDTH_BUDGET = 130;

try {
  const d = repo();
  const start = (source) => hook('gate-digest.mjs', { hook_event_name: 'SessionStart', source }, d);

  const compact = start('compact');
  const lines = compact.out.trim().split('\n');
  ok('a compact start prints the digest and exits 0', compact.code === 0 && lines[0].startsWith('GATE DIGEST'));
  ok('it names the per-type tags the compaction summary loses', /patch-worker-discipline: \[paths:/.test(compact.out) && /conformance-named: \[conformance:/.test(compact.out) && /dispatch-job: \[job:/.test(compact.out) && /lessons-checked: \[lessons-checked:/.test(compact.out));
  ok('it names the model parameter and the question gate', /model:'sonnet'/.test(compact.out) && /^question:/m.test(compact.out));
  ok(`it stays within ${LINE_BUDGET} lines of ${WIDTH_BUDGET} characters`, lines.length <= LINE_BUDGET && lines.every((l) => l.length <= WIDTH_BUDGET), `${lines.length} lines`);

  ok('control: a startup, resume and clear start print nothing', ['startup', 'resume', 'clear'].every((s) => start(s).code === 0 && start(s).out.trim() === ''));
  ok('control: an empty payload prints nothing and malformed stdin fails open', hook('gate-digest.mjs', {}, d).out.trim() === ''
    && spawnSync(process.execPath, [join(HOOKS, 'gate-digest.mjs')], { input: '{not json', cwd: d, encoding: 'utf8', env: ENV }).status === 0);

  const changed = structuredClone(GATES);
  changed.agent.checks.find((c) => c.check === 'patch-worker-discipline').tokens = [{ form: '[roots: <dirs>]', meaning: 'x' }];
  changed.agent.checks.push({ check: 'new-check', wants: ['x'], tokens: [{ form: '[new-tag: <x>]', meaning: 'y' }] });
  const text = gateDigest(changed).join('\n');
  ok('the digest follows the gate definitions: a changed or added check changes it', text.includes('patch-worker-discipline: [roots: <dirs>]') && text.includes('new-check: [new-tag: <x>]') && !text.includes('patch-worker-discipline: [paths:'));
  ok('control: a gate with no tagged check adds no line', gateDigest({ plain: { checks: [{ check: 'c', wants: ['x'], tokens: [] }] } }).length === 1);

  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const wired = wiring.hooks.SessionStart.find((e) => e.hooks.some((h) => h.command.includes('gate-digest.mjs')));
  ok('it is wired on SessionStart with the compact matcher only', wired && wired.matcher === 'compact');
} finally {
  cleanup();
}

done();
