#!/usr/bin/env node
// build-status.mjs — who is building on this machine (KIT-D135). Plain text: the budget, each build holding cores
// with its project directory and command, each build waiting. Run it as `builds` (bin/builds).
//
//   formatSnapshot(snapshot) -> text        node build-status.mjs [--audit]
//     each holder gets a detail line: phase (compiling / running tests), live rustc count, CPU used against cores charged,
//     who started it, its root, minutes held, and a mark when it is past the 5-minute ceiling (KIT-T1056)
//   describeHolder(hold, budget?) -> one line: pid, cores, age, root (cwd), job and phase of a hold
//   phaseText(hold) -> "running tests, 0 rustc (charged 2 of 14, using 1.9 now, live cpu 1351s)", '' without a phase
// `--audit` also lists project settings that ask for more cores than the budget (read only; build-audit.mjs).
// `--wait <file>` blocks once until no build compiles that file (build-wait.mjs, KIT-T1142): the wait a refused edit names.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from './build-slot-store.mjs';
import { auditProjects, formatAudit } from './build-audit.mjs';
import { isLongHold } from './build-grant.mjs';

const MS_PER_SECOND = 1000;
const age = (ts) => `${Math.max(0, Math.round((Date.now() - Date.parse(ts)) / MS_PER_SECOND))}s`;
const cores = (n) => `${String(n).padStart(2)} cores`;

const PHASE_NAME = { compiling: 'compiling', running: 'running tests', starting: 'starting' };
const MS_PER_MINUTE = 60000;
const minutesHeld = (ts) => Math.floor((Date.now() - Date.parse(ts)) / MS_PER_MINUTE);
const cpuSeconds = (ms) => `${Math.round(ms / MS_PER_SECOND)}s`;

/** Phase, live rustc count, CPU used against cores charged: what a holder is doing with its cores. */
export function phaseText(hold) {
  if (!hold.phase) return '';
  const charged = `charged ${hold.jobs} of ${hold.full ?? hold.jobs}`;
  const using = hold.cores === undefined ? '' : `, using ${hold.cores.toFixed(1)} now`;
  const cpu = hold.cpuMs === undefined ? '' : `, live cpu ${cpuSeconds(hold.cpuMs)}`;
  return `${PHASE_NAME[hold.phase] || hold.phase}, ${hold.rustc ?? 0} rustc (${charged}${using}${cpu})`;
}

/** One line a coordinator can relay: who holds cores, from which root, for how long. */
export function describeHolder(hold, budget = 0) {
  const job = String(hold.label).startsWith(`${hold.cwd}: `) ? String(hold.label).slice(String(hold.cwd).length + 2) : hold.label;
  const doing = phaseText(hold);
  return `held by pid ${hold.pid} on ${hold.jobs ?? budget} cores for ${age(hold.ts)}, root ${hold.cwd}, job ${job}${doing ? `, ${doing}` : ''}`;
}

function detailLine(hold) {
  const parts = [phaseText(hold), hold.by && `started by ${hold.by}`, hold.cwd && `root ${hold.cwd}`, `held ${minutesHeld(hold.ts)} min`, isLongHold(hold) && 'PAST THE 5-MINUTE CEILING'];
  return `    ${parts.filter(Boolean).join('; ')}`;
}

export function formatSnapshot({ physical, reserve, full, budget, game, holds, waiting }) {
  const held = holds.reduce((n, h) => n + (Number(h.jobs) || budget), 0);
  const lines = [`build budget: ${budget} of ${physical} cores (${reserve} always free)${game ? `; a game is running, builds yield ${full - budget} of ${full}` : ''}`];
  lines.push(holds.length ? `building ${held}/${budget} cores:` : 'building: nobody');
  for (const h of holds) lines.push(`  ${cores(h.jobs ?? budget)}  pid ${h.pid}  ${age(h.ts)}  ${h.label}`, detailLine(h));
  lines.push(waiting.length ? `waiting ${waiting.length}:` : 'waiting: nobody');
  for (const w of waiting) lines.push(`  want ${w.jobs}  pid ${w.pid}  ${age(w.ts)}  ${w.label}`);
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--wait')) {
    const { runWait } = await import('./build-wait.mjs');
    process.exit(await runWait(process.argv.slice(2)));
  }
  const snap = snapshot();
  console.log(formatSnapshot(snap));
  if (process.argv.includes('--audit')) console.log(`\n${formatAudit(auditProjects(snap.budget))}`);
}
