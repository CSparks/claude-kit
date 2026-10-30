// baseline-budget.test.mjs — the attribution baseline re-runs a failed command on the pre-patch tree, which
// roughly doubles a red job; past half the 5-minute ceiling (KIT-D104) it is skipped and the failure stays
// unattributed. A baseline that does run is its own phase, not time charged to `run`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBaseline, BASELINE_BUDGET_MS } from './baseline.mjs';
import { CEILING_MS } from './overrun.mjs';
import { fixture } from './patchkit.mjs';
import { ensureDirs } from './result.mjs';
import { runTrainCommands } from './train-run.mjs';
import { commandSummary } from './command-summary.mjs';

const RED = `node -e "console.log('test a_red ... FAILED');console.log('---- a_red stdout ----');console.log('boom');process.exit(1)"`;
const ECHO = 'node -e "console.log(1)"';
const pre = { tree: 'tree-state', dirty: [], head: 'abc' };

function harness({ clock }) {
  const s = fixture();
  ensureDirs(s.cfg);
  const calls = { enter: 0, leave: 0, phases: [] };
  const baseline = makeBaseline({
    cfg: s.cfg, job: { id: 'j-budget', repo: 'app' }, cwd: s.root, pre, held: [], clock, since: 0,
    enter: () => { calls.enter++; }, leave: () => { calls.leave++; }, onPhase: (p) => calls.phases.push(p),
  });
  return { s, calls, baseline };
}

test('the budget is half the broker ceiling', () => {
  assert.equal(BASELINE_BUDGET_MS, CEILING_MS / 2);
});

test('a job past the budget skips the baseline: no tree restore, no run, a stated reason', () => {
  const h = harness({ clock: () => BASELINE_BUDGET_MS + 1 });
  try {
    const out = h.baseline((run) => ({ log: run(ECHO, '0-base') }));
    assert.match(out.skipped, /past half the 5-minute ceiling/);
    assert.equal(h.calls.enter, 0);
    assert.deepEqual(h.calls.phases, []);
  } finally { h.s.done(); }
});

test('a job inside the budget runs the baseline as its own phase and returns to run', () => {
  const h = harness({ clock: () => BASELINE_BUDGET_MS - 1 });
  try {
    const out = h.baseline((run) => ({ log: run(ECHO, '0-base') }));
    assert.ok(out.log, 'the base log path comes back');
    assert.equal(h.calls.enter, 1);
    assert.equal(h.calls.leave, 1);
    assert.deepEqual(h.calls.phases, ['baseline', 'run']);
  } finally { h.s.done(); }
});

test('a skipped baseline leaves the red command unattributed and the summary says why', () => {
  const s = fixture();
  ensureDirs(s.cfg);
  try {
    let n = 0;
    const baseline = () => ({ skipped: 'attribution skipped: test reason' });
    const out = runTrainCommands(s.cfg, { id: 'j-skip', repo: 'app', cwd: s.root, commands: [{ cmd: RED, owners: ['j-skip'] }], nextLog: () => n++, baseline });
    assert.equal(out.failing.unattributed, 'attribution skipped: test reason');
    assert.equal(out.failing.foreign, undefined);
    assert.ok(commandSummary(out.failing, { readLog: () => '' }).some((l) => l.includes('attribution skipped: test reason')));
  } finally { s.done(); }
});
