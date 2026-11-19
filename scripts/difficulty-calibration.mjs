#!/usr/bin/env node
// difficulty-calibration.mjs — how the dispatch difficulty assessments (KIT-T1414, KIT-D170) held up, read from the outcome
// ledger (.ai/dispatch-outcomes.jsonl). Per predicted tier: dispatches, landings, the share finished by another family, retries
// and escalations on the same ticket, handoffs written, tokens per landing. It also feeds the weekly reassessment: the job
// rows whose landed dispatches ran on the row's own family are re-date candidates, the rows mostly assessed onto another
// family are named for review.
//
//   calibrate({ outcomes, ladderJobs, handoffIds, since }) -> { tiers: [...], redate: [job], review: [{ job, row, assessed, of }] }
//   calibrationLines(result)                              -> printable lines
//   CLI: node scripts/difficulty-calibration.mjs [--root <repo>] [--since YYYY-MM-DD]

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseFlags } from './broker/cli.mjs';
import { isMain } from './is-main.mjs';
import { readLadder } from './dispatch-ladder.mjs';
import { readOutcomes } from '../hooks/lib/dispatch-ledger.mjs';
import { TIERS } from '../hooks/lib/difficulty.mjs';

const RANK = { haiku: 0, sonnet: 1, opus: 2, fable: 3 };
const REDATE_MIN_LANDINGS = 3;
const PERCENT = 100;
const share = (n, of) => (of ? `${Math.round((PERCENT * n) / of)}%` : '-');

function ticketEvents(rows) {
  const byTicket = new Map();
  for (const r of rows) for (const t of r.tickets || []) byTicket.set(t, [...(byTicket.get(t) || []), r]);
  let retries = 0;
  let escalations = 0;
  const marked = new Map();
  for (const list of byTicket.values()) {
    const ordered = [...list].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    ordered.slice(1).forEach((r, i) => {
      const before = ordered[i];
      if ((RANK[r.model] ?? -1) > (RANK[before.model] ?? -1)) { escalations++; marked.set(before.id, 'escalated'); } else { retries++; marked.set(before.id, marked.get(before.id) || 'retried'); }
    });
  }
  return { retries, escalations, marked };
}

export function calibrate({ outcomes, ladderJobs = {}, handoffIds = new Set(), since = '' }) {
  const rows = outcomes.filter((r) => r && r.predicted && (!since || String(r.ts) >= since));
  const { marked } = ticketEvents(rows);
  const tiers = TIERS.map((tier) => {
    const mine = rows.filter((r) => r.predicted.tier === tier);
    const landed = mine.filter((r) => r.outcome === 'completed' && !marked.has(r.id));
    const tokens = landed.reduce((a, r) => a + (Number(r.tokens) || 0), 0);
    return {
      tier,
      dispatches: mine.length,
      landings: landed.length,
      otherFamily: mine.filter((r) => r.model && r.model !== r.predicted.family).length,
      retried: mine.filter((r) => marked.get(r.id) === 'retried').length,
      escalated: mine.filter((r) => marked.get(r.id) === 'escalated').length,
      handoffs: mine.filter((r) => handoffIds.has(r.id)).length,
      tokensPerLanding: landed.length ? Math.round(tokens / landed.length) : 0,
    };
  });
  const redate = [];
  const review = [];
  for (const [job, row] of Object.entries(ladderJobs)) {
    const mine = rows.filter((r) => r.job === job);
    if (!mine.length) continue;
    const onRow = mine.filter((r) => r.predicted.family === row.family);
    if (onRow.filter((r) => r.outcome === 'completed' && !marked.has(r.id)).length >= REDATE_MIN_LANDINGS) redate.push(job);
    const counts = mine.reduce((m, r) => m.set(r.predicted.family, (m.get(r.predicted.family) || 0) + 1), new Map());
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top !== row.family && n * 2 > mine.length) review.push({ job, row: row.family, assessed: top, of: `${n} of ${mine.length}` });
  }
  return { tiers, redate, review, assessed: rows.length };
}

export function calibrationLines(result) {
  const lines = [`difficulty calibration: ${result.assessed} assessed dispatch(es)`];
  for (const t of result.tiers) {
    if (!t.dispatches) continue;
    lines.push(`  ${t.tier}: ${t.dispatches} dispatched, ${t.landings} landed, ${share(t.otherFamily, t.dispatches)} finished by another family, ${t.retried} retried, ${t.escalated} escalated, ${t.handoffs} handoff(s), ${t.tokensPerLanding} tokens per landing`);
  }
  lines.push(`  re-date candidates for the weekly reassessment (${REDATE_MIN_LANDINGS}+ landings on the row's own family): ${result.redate.join(', ') || 'none'}`);
  for (const r of result.review) lines.push(`  review row ${r.job}: table ${r.row}, assessed ${r.assessed} on ${r.of} dispatches`);
  return lines;
}

// Agent ids named in a `Handoff <agent id>` block of any ticket's Notes.
function handoffIdsOf(root) {
  const ids = new Set();
  for (const dir of ['tickets', join('tickets', 'archive')].map((d) => join(root, '.ai', d))) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      try { for (const m of readFileSync(join(dir, name), 'utf8').matchAll(/Handoff\s+(a[0-9a-f]{8,})/g)) ids.add(m[1]); } catch { /* unreadable ticket */ }
    }
  }
  return ids;
}

export function calibrationFor(root, since = '') {
  return calibrate({ outcomes: readOutcomes(root), ladderJobs: readLadder().jobs, handoffIds: handoffIdsOf(root), since });
}

if (isMain(import.meta.url)) {
  const flags = parseFlags(process.argv.slice(2));
  const root = typeof flags.root === 'string' ? flags.root : process.cwd();
  console.log(calibrationLines(calibrationFor(root, typeof flags.since === 'string' ? flags.since : '')).join('\n'));
}
