#!/usr/bin/env node
// source-shell-gate-discard-sweeps.test.mjs — a git call that may take files it does not name (SWEEPS: a bare clean, a
// directory, a glob, an alias, an option or environment off the allow-list, a forcing form) passes while the caller is the only
// writer (KIT-T1163, KIT-T1266). The same calls beside a live writer are source-shell-gate-discard-sweeps-live.test.mjs; the
// discard suites are split so that each finishes inside one foreground call (KIT-T1246).
// Run: node hooks/source-shell-gate-discard-sweeps.test.mjs

import { discardHarness } from './source-shell-gate-discard-harness.mjs';
import { SWEEPS } from './source-shell-gate-discard-sweeps.mjs';

const { check, passes_, seed, finish } = discardHarness();

try {
  seed({ aliases: true });
  for (const [command, name] of SWEEPS) check(`${name}: passes while no other writer is live`, passes_(command));
} finally {
  finish();
}
