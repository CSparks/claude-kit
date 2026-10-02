// Pre-write glue for the comment checks (KIT-T283/KIT-T207): turns comment-scan findings into
// { id, msg } entries for the gate's violation and warning lists.
//   check-ids: comment-length (blocks, then warns), comment-narration (blocks)
//
// `skip(id, line)` is the gate's exclusion test (path glob or in-source marker); line 0 asks
// about the whole file. `wholeFile` is true for a Write — ratio is meaningless on an Edit
// fragment.

import { commentRuns, narrationHits, commentStats, RUN_WARN, RUN_BLOCK, RATIO_WARN, RATIO_MIN_LINES } from './comment-scan.mjs';

const SHOWN = 3;
const pct = (x) => Math.round(x * 100);

export function commentFindings(src, ext, { skip, wholeFile }) {
  const viols = [];
  const warns = [];
  if (!skip('comment-length', 0)) {
    const runs = commentRuns(src, ext).filter((r) => !skip('comment-length', r.start));
    const hard = runs.filter((r) => r.length > RUN_BLOCK).slice(0, SHOWN);
    const soft = runs.filter((r) => r.length > RUN_WARN && r.length <= RUN_BLOCK).slice(0, SHOWN);
    if (hard.length) {
      viols.push({ id: 'comment-length', msg: `Comment block over ${RUN_BLOCK} lines — comments are contracts (what it is, how to use it), not essays:\n` + hard.map((r) => `${r.start}: ${r.length} lines`).join('\n') });
    }
    if (soft.length) {
      warns.push({ id: 'comment-length', msg: `Long comment block (over ${RUN_WARN} lines) — trim to the contract, move the story to the ticket:\n` + soft.map((r) => `${r.start}: ${r.length} lines`).join('\n') });
    }
    if (wholeFile) {
      const s = commentStats(src, ext);
      if (s.comment + s.code >= RATIO_MIN_LINES && s.ratio > RATIO_WARN) {
        warns.push({ id: 'comment-length', msg: `Comments are ${pct(s.ratio)}% of this file (over ${pct(RATIO_WARN)}%) — rename/extract so the code reads without them.` });
      }
    }
  }
  if (!skip('comment-narration', 0)) {
    const talk = narrationHits(src, ext).filter((h) => !skip('comment-narration', h.line)).slice(0, SHOWN);
    if (talk.length) {
      viols.push({ id: 'comment-narration', msg: 'Comments narrate history or conversation (git and the ticket hold that — at most a bare ticket id):\n' + talk.map((h) => `${h.line}: ${h.why} — ${h.text}`).join('\n') });
    }
  }
  return { viols, warns };
}
