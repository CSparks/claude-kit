// ruled-not-built.mjs — decisions a day old or more that name neither the ticket that builds them nor why they need no work
// (KIT-T1225), listed beside the un-promoted rulings so a ruling never falls out of sight once the session moves on.
// Only decisions written by `t decide` with its `implemented_by:` line count; older decisions carry no such line and are not listed.
//
//   ruledNotBuilt(root, now?) -> [{ id, title, ageDays }]   oldest first
//   ruledNotBuiltLines(items)  -> the orient block, [] when nothing waits
//   ruledNotBuiltSection({ out, root })   pushes the block; best-effort

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathKey, statCached, statMarkdownFiles } from '../stat-cache.mjs';

const MS_PER_DAY = 86_400_000;
const SHOWN = 8;
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const SETTLED = /supersed|reject|retired|withdrawn/i;

export const RULED_HEADER = '--- RULED, NOT BUILT (decisions with no implementing ticket and no "no work" note; build or close each) ---';

const keyOf = (front, key) => (front.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm')) || [])[1];

function readRuledMeta(abs) {
  try {
    const front = (readFileSync(abs, 'utf8').match(FRONT) || [])[1] || '';
    const built = keyOf(front, 'implemented_by');
    const settled = [built, keyOf(front, 'no_work'), keyOf(front, 'promoted')].some((v) => v && v.trim()) || SETTLED.test(keyOf(front, 'status') || '');
    return {
      tracked: built !== undefined,
      settled,
      id: (keyOf(front, 'id') || '').trim(),
      title: (keyOf(front, 'title') || '').trim(),
      date: (keyOf(front, 'date') || '').trim(),
    };
  } catch {
    return { tracked: false, settled: true, id: '', title: '', date: '' };
  }
}

export function ruledNotBuilt(root, now = Date.now()) {
  const dir = join(root, '.ai', 'decisions');
  const files = statMarkdownFiles(dir, (name) => /^(README|_TEMPLATE)/i.test(name));
  return statCached(`ruled-meta-${pathKey(dir)}`, files, readRuledMeta)
    .filter((m) => m.tracked && !m.settled && m.id)
    .map((m) => ({ id: m.id, title: m.title, ageDays: Math.floor((now - Date.parse(`${m.date}T00:00:00Z`)) / MS_PER_DAY) }))
    .filter((m) => Number.isFinite(m.ageDays) && m.ageDays >= 1)
    .sort((a, b) => b.ageDays - a.ageDays);
}

export function ruledNotBuiltLines(items) {
  if (!items.length) return [];
  return [
    RULED_HEADER,
    ...items.slice(0, SHOWN).map((m) => `  ${m.id} (${m.ageDays}d) ${m.title}`),
    ...(items.length > SHOWN ? [`  +${items.length - SHOWN} more`] : []),
    '  Build each: t new <type> "<title>", then t revise <id> --ticket <ticket>. Nothing to build: t revise <id> --no-work "<why>".',
    '',
  ];
}

export function ruledNotBuiltSection({ out, root }) {
  try {
    out.push(...ruledNotBuiltLines(ruledNotBuilt(root)));
  } catch {
    /* orientation proceeds without the block */
  }
}
