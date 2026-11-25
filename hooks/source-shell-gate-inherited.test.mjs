#!/usr/bin/env node
// source-shell-gate-inherited.test.mjs — a successor agent may stash the files its brief's paths cover that only ended agents
// wrote (inherited-files.mjs, KIT-T1565); every other holder of the bytes keeps the refusal.
// Run: node hooks/source-shell-gate-inherited.test.mjs

import { recordAgent } from './lib/agent-roster.mjs';
import { discardHarness } from './source-shell-gate-discard-harness.mjs';

const h = discardHarness();
const { check, passes_, stops, toolWrite, finish } = h;
const STASH = 'git stash push -m baseline -- tracked.rs';
let round = 0;

// One scenario: the predecessor wrote tracked.rs, the successor's row declares `paths`; returns the successor's agent id.
function scenario({ predecessorStatus = 'done', paths = ['tracked.rs'], predecessorSession = 'S2', predecessorAgent = true, successorRow = true } = {}) {
  round += 1;
  const predecessor = `old${round}`;
  const successor = `new${round}`;
  recordAgent(h.top, { id: predecessor, status: predecessorStatus });
  if (successorRow) recordAgent(h.top, { id: successor, status: 'in-flight', ...(paths ? { paths } : {}) });
  toolWrite('tracked.rs', `fn tracked() { ${round} }\n`, predecessorSession, predecessorAgent ? predecessor : '');
  return successor;
}

try {
  h.seed();
  h.freshHolders();

  check('a successor whose paths cover the file may stash what an ended agent wrote', passes_(STASH, 'S1', scenario()));
  check('a successor whose paths do not cover the file is refused', stops(STASH, 'S1', scenario({ paths: ['sub/'] })));
  check('a successor with an unknown path list is refused', stops(STASH, 'S1', scenario({ paths: ['*'] })) && stops(STASH, 'S1', scenario({ paths: null })));
  check('a predecessor that is still live keeps the refusal', stops(STASH, 'S1', scenario({ predecessorStatus: 'in-flight' })));
  check('bytes the main thread wrote keep the refusal', stops(STASH, 'S1', scenario({ predecessorAgent: false })));
  check('a caller with no roster row keeps the refusal', stops(STASH, 'S1', scenario({ successorRow: false })));
  check('a main-thread caller never inherits', (() => { scenario(); return stops(STASH, 'S3', ''); })());
  check('a bare stash is a sweep: it passes only while no other writer is live', (() => { const agent = scenario(); return passes_('git stash', 'S1', agent); })());
} finally {
  finish();
}
