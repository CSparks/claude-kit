#!/usr/bin/env node
// review-lapse.mjs — the review-lapse sweep (KIT-D107). Every ticket that has sat in `review` for
// more than 14 days with no maintainer feedback since it entered review is closed through
// `setStatus(..., { lapsed: true })` (label `lapsed`, History line citing the decision). Idempotent:
// a lapsed ticket is `done`, so a second run finds nothing.
//
//   node scripts/review-lapse.mjs [--dry-run] [--store <project-root | .ai dir>] [--json]
//
// sweepLapse(root, { dryRun, now, humans }) -> { reviewing, lapsed: [id], blocked: [id], errors: [id] }
// lapseReceipt(root)                        -> the one SessionStart line, '' when nothing lapsed (fail-open)

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { field, splitFrontmatter } from './frontmatter.mjs';
import { lapseVerdict, LAPSE_DAYS } from './t/lapse-rule.mjs';
import { setStatus } from './t/status.mjs';
import { isMain } from './is-main.mjs';

const SKIP = new Set(['_TEMPLATE.md', 'INDEX.md']);

/** A project root from either a root or its `.ai` dir. */
export const storeRoot = (path) => (basename(resolve(path)) === '.ai' ? dirname(resolve(path)) : resolve(path));

function reviewTickets(root) {
  const dir = join(root, '.ai', 'tickets');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !SKIP.has(f))
    .flatMap((f) => {
      const text = readFileSync(join(dir, f), 'utf8');
      const parts = splitFrontmatter(text);
      return parts && field(parts.fm, 'status') === 'review' ? [{ id: field(parts.fm, 'id'), text }] : [];
    });
}

export async function sweepLapse(root, { dryRun = false, now = Date.now(), humans } = {}) {
  const result = { reviewing: 0, lapsed: [], blocked: [], errors: [] };
  for (const t of reviewTickets(root)) {
    result.reviewing += 1;
    const verdict = lapseVerdict(t.text, { now, humans });
    if (verdict.feedback && verdict.idleDays > LAPSE_DAYS) result.blocked.push(t.id);
    if (!verdict.eligible) continue;
    if (!dryRun) {
      try { setStatus(root, t.id, 'done', { lapsed: true, now }); } catch { result.errors.push(t.id); continue; }
    }
    result.lapsed.push(t.id);
  }
  if (!dryRun && result.lapsed.length) {
    const { refresh } = await import('./t.mjs');
    await refresh(root);
  }
  return result;
}

export async function lapseReceipt(root) {
  try {
    const { lapsed } = await sweepLapse(root);
    return lapsed.length ? `lapsed ${lapsed.length} review tickets (KIT-D107)` : '';
  } catch {
    return '';
  }
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const si = argv.indexOf('--store');
  const root = storeRoot(si >= 0 ? argv[si + 1] : process.cwd());
  const r = await sweepLapse(root, { dryRun });
  if (argv.includes('--json')) { process.stdout.write(`${JSON.stringify(r)}\n`); return; }
  const verb = dryRun ? 'would lapse' : 'lapsed';
  process.stdout.write(`${verb} ${r.lapsed.length} review tickets (KIT-D107); ${r.blocked.length} kept by maintainer feedback; ${r.reviewing} in review${r.errors.length ? `; ${r.errors.length} failed: ${r.errors.join(', ')}` : ''}\n`);
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { process.stderr.write(`review-lapse: ${e?.message || e}\n`); process.exit(1); });
}
