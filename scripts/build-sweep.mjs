#!/usr/bin/env node
// build-sweep.mjs — nightly, age-based sweep of cargo build dirs (KIT-T636).
//
//   node scripts/build-sweep.mjs [root] [--dry-run] [--json]
//   node scripts/build-sweep.mjs --install | --uninstall      register / remove the 03:30 nightly job
//
// root defaults to the parent directory most registered projects share (the dev root).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRegistry } from '../hooks/lib/registry.mjs';
import { isMain } from './is-main.mjs';
import { appendReceipt, formatReceipt } from './build-sweep/receipt.mjs';
import { installSchedule, uninstallSchedule } from './build-sweep/schedule.mjs';
import { sweep } from './build-sweep/sweep.mjs';

const SELF = fileURLToPath(import.meta.url);

export function devRoot() {
  const counts = new Map();
  for (const path of Object.values(readRegistry().projects)) {
    const parent = dirname(resolve(path));
    counts.set(parent, (counts.get(parent) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function main(argv) {
  const flag = (name) => argv.includes(name);
  if (flag('--install')) {
    const { name, next } = installSchedule(SELF);
    console.log(`installed scheduled task "${name}"; next run ${next}`);
    return 0;
  }
  if (flag('--uninstall')) {
    console.log(uninstallSchedule() ? 'scheduled task removed' : 'no scheduled task to remove');
    return 0;
  }
  const root = argv.find((a) => !a.startsWith('--')) || devRoot();
  if (!root) {
    console.error('build-sweep: no root given and the registry has no projects');
    return 1;
  }
  const receipt = sweep(resolve(root), { dryRun: flag('--dry-run') });
  if (!receipt.dryRun) appendReceipt(receipt);
  console.log(flag('--json') ? JSON.stringify(receipt) : formatReceipt(receipt).join('\n'));
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
