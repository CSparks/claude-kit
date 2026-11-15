#!/usr/bin/env node
// source-shell-gate-discard-sweeps-live.test.mjs — the SWEEPS of source-shell-gate-discard-sweeps.test.mjs are refused once
// another writer is live in the checkout, and the block names the verb and the way out (KIT-T1163, KIT-T1266). The discard
// suites are split so that each finishes inside one foreground call (KIT-T1246).
// Run: node hooks/source-shell-gate-discard-sweeps-live.test.mjs

import { claimFile } from './lib/checkout-holder.mjs';
import { discardHarness } from './source-shell-gate-discard-harness.mjs';
import { SWEEPS } from './source-shell-gate-discard-sweeps.mjs';

const h = discardHarness();
const { check, run, passes_, stops, freshHolders, finish } = h;

try {
  h.seed({ aliases: true });
  freshHolders();
  claimFile({ tree: h.top, session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });
  for (const [command, name] of SWEEPS) check(`${name}: blocked while another writer is live`, stops(command));
  const said = run('git clean -fd', 'S1').stderr;
  check('the block names the verb, the live writer and the way out', /git clean here may take files it does not name[^]*another writer is live[^]*raise it to the main thread/.test(said), said);
  check('a named file of the caller still passes beside a live writer', passes_('git clean -f -- mine.rs'));
  check('control: git rm --pathspec-from-file without -f passes beside a live writer', passes_('git rm --pathspec-from-file=list.txt'));
  check('KIT-T1266: git stash push --pathspec-from-file without -u is a sweep beside a live writer', stops('git stash push --pathspec-from-file=list.txt'));
  check('an alias is refused even when it is harmless: the allow-list names built-ins only', stops('git st') && stops("git -c alias.z='log -1' z"));
} finally {
  finish();
}
