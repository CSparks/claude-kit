// lessons-digest.mjs — the lesson ids a repo's framework ledgers define, as the one line the compaction gate digest
// prints, so the first rendering, performance, asset or streaming dispatch after a compaction can cite them without a
// search (KIT-T1191). Consecutive ids of one letter collapse to a range: `L-R01..14`.
//
//   lessonIdRanges(ids)    -> ['L-R01..14', 'L-A01', ...] sorted by letter then number
//   lessonsDigest(root)    -> [] when the repo has no ledger, else one line naming the ids and the tag form

import { frameworksFor } from './frameworks.mjs';
import { ledgerFiles, lessonIds } from './lessons.mjs';
import { TOKENS } from './gate-tokens.mjs';

const PARTS = /^L-([A-Z])(\d+)$/;
const MIN_RANGE = 3;

export function lessonIdRanges(ids) {
  const byLetter = new Map();
  for (const id of ids) {
    const m = PARTS.exec(id);
    if (m) byLetter.set(m[1], [...(byLetter.get(m[1]) || []), Number(m[2])]);
  }
  const pad = (n) => String(n).padStart(2, '0');
  return [...byLetter].sort(([a], [b]) => a.localeCompare(b)).flatMap(([letter, numbers]) => {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const runs = [];
    for (const n of sorted) {
      const last = runs[runs.length - 1];
      if (last && n === last.end + 1) last.end = n; else runs.push({ start: n, end: n });
    }
    return runs.flatMap(({ start, end }) => {
      if (end - start + 1 < MIN_RANGE) return Array.from({ length: end - start + 1 }, (_, i) => `L-${letter}${pad(start + i)}`);
      return [`L-${letter}${pad(start)}..${pad(end)}`];
    });
  });
}

export function lessonsDigest(root) {
  const ids = ledgerFiles(root, frameworksFor(root)).flatMap((file) => [...lessonIds(file)]);
  if (!ids.length) return [];
  return [`lessons (rendering, perf, asset or streaming work cites ids): ${lessonIdRanges(ids).join(' ')}; tag ${TOKENS.lessonsChecked.form}`];
}
