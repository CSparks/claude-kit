#!/usr/bin/env node
// SessionStart (matcher: compact) — after a context compaction the session keeps the dispatch tags it used before
// (job, model, maintainer-words) but not the per-type ones ([paths:], [conformance:]), and nothing re-triggers "read
// q gates agent before the first gated call". This prints the gate digest (gate-protocol.mjs gateDigest) on a compact
// start only; a startup, resume or clear prints nothing. Not a gate: always exit 0, fail-open.

import { payload } from './lib.mjs';
import { gateDigest } from './lib/gate-protocol.mjs';

const COMPACT_SOURCE = 'compact';

try {
  const p = await payload();
  if (p && p.source === COMPACT_SOURCE) console.log(gateDigest().join('\n'));
} catch { /* fail-open */ }
process.exit(0);
