#!/usr/bin/env node
// SessionStart — sweep the current store for review tickets that lapsed (KIT-D107) and print the
// one receipt line. Fail-open: any error prints nothing and exits 0.

import { gitRoot, adopted } from './lib.mjs';

try {
  const root = gitRoot();
  if (adopted(root)) {
    const { lapseReceipt } = await import('../scripts/review-lapse.mjs');
    const receipt = await lapseReceipt(root);
    if (receipt) process.stdout.write(`${receipt}\n`);
  }
} catch {
  /* the sweep is best-effort — never break orientation */
}
process.exit(0);
