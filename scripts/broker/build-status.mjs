#!/usr/bin/env node
// build-status.mjs — who is building on this machine (KIT-D135). Plain text: the budget, each build holding cores
// with its project directory and command, each build waiting. Run it as `builds` (bin/builds).
//
//   formatSnapshot(snapshot) -> text        node build-status.mjs [--audit]
//   describeHolder(hold, budget?) -> one line: pid, cores, age, root (cwd) and job of a hold
// `--audit` also lists project settings that ask for more cores than the budget (read only; build-audit.mjs).

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from './build-slot-store.mjs';
import { auditProjects, formatAudit } from './build-audit.mjs';

const MS_PER_SECOND = 1000;
const age = (ts) => `${Math.max(0, Math.round((Date.now() - Date.parse(ts)) / MS_PER_SECOND))}s`;
const cores = (n) => `${String(n).padStart(2)} cores`;

/** One line a coordinator can relay: who holds cores, from which root, for how long. */
export function describeHolder(hold, budget = 0) {
  const job = String(hold.label).startsWith(`${hold.cwd}: `) ? String(hold.label).slice(String(hold.cwd).length + 2) : hold.label;
  return `held by pid ${hold.pid} on ${hold.jobs ?? budget} cores for ${age(hold.ts)}, root ${hold.cwd}, job ${job}`;
}

export function formatSnapshot({ physical, reserve, full, budget, game, holds, waiting }) {
  const held = holds.reduce((n, h) => n + (Number(h.jobs) || budget), 0);
  const lines = [`build budget: ${budget} of ${physical} cores (${reserve} always free)${game ? `; a game is running, builds yield ${full - budget} of ${full}` : ''}`];
  lines.push(holds.length ? `building ${held}/${budget} cores:` : 'building: nobody');
  for (const h of holds) lines.push(`  ${cores(h.jobs ?? budget)}  pid ${h.pid}  ${age(h.ts)}  ${h.label}`);
  lines.push(waiting.length ? `waiting ${waiting.length}:` : 'waiting: nobody');
  for (const w of waiting) lines.push(`  want ${w.jobs}  pid ${w.pid}  ${age(w.ts)}  ${w.label}`);
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snap = snapshot();
  console.log(formatSnapshot(snap));
  if (process.argv.includes('--audit')) console.log(`\n${formatAudit(auditProjects(snap.budget))}`);
}
