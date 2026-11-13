// dispatch-shared-tree.mjs — the shared-tree-dispatch check of the dispatch gate (KIT-T176, KIT-D077, KIT-T1114).
// The kit never limits how many writers share a checkout. A writer dispatched while another is in flight there declares
// `[paths: ...]`, and is refused only when those paths overlap an in-flight writer's. What guards the rest is per file
// and per build at write time (holder-beat.mjs): one file, one writer; no write into the files a running build compiles.
//
//   sharedTreeBlock({ agent, tree, source, prompt, writers, now, footer }) -> block message | null
//     writers: the live read/write roster rows of `tree`; a writer alone in the tree needs no paths.

import { workerPaths } from './dispatch-worker.mjs';
import { overlaps } from './lib/path-overlap.mjs';

const MS_PER_MIN = 60 * 1000;
const ROSTER_TASK_CHARS = 80;
const UNKNOWN = '*';

const minutesAgo = (row, now) => {
  const t = Date.parse(row.firstSeen || row.ts || '');
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / MS_PER_MIN)) : 0;
};

const rowLine = (r, now) => `    • ${r.id} (${r.scope || 'general'}, ${minutesAgo(r, now)}m ago${r.paths ? `, paths ${r.paths.join(', ')}` : ''}) — ${String(r.task || '(no description)').slice(0, ROSTER_TASK_CHARS)}`;

export function sharedTreeBlock({ agent, tree, source, prompt, writers, now = Date.now(), footer }) {
  if (!writers.length) return null;
  const mine = workerPaths(prompt, tree);
  const undeclared = !mine || mine.includes(UNKNOWN);
  const clashing = undeclared ? [] : writers.filter((r) => overlaps(mine, r.paths || []));
  if (!undeclared && !clashing.length) return null;

  const cause = undeclared
    ? 'this dispatch declares no [paths: ...] (or [paths: *], which overlaps everyone)'
    : `its [paths: ${mine.join(', ')}] overlap an in-flight writer's`;
  return [
    `BLOCKED: ${writers.length} read/write agent(s) already in flight in this working tree, and ${cause}.`,
    `  agent: ${agent}   tree: ${tree} (from ${source})   roster: .ai/agents.jsonl`,
    ...(undeclared ? writers : clashing).map((r) => rowLine(r, now)),
    '',
    'Several writers share one checkout. Only two things are guarded: no two writers on one file, and no write into',
    "the files a running build compiles. Both are checked at write time, per file and per build; the paths below only",
    'let this dispatch be refused early.',
    '',
    'Fix — pick one (never a worktree or second checkout — KIT-D074):',
    ...(undeclared
      ? ['  • declare what this agent edits: add [paths: <repo-relative files or folders, comma separated>] to the prompt;']
      : ['  • choose [paths:] that avoid the files above, or wait for that agent and hand THAT agent the next ticket (warm build);']),
    '  • research only: a READ-ONLY agent type (claude-kit:researcher, claude-kit:analyst, Explore, Plan), or',
    '    [read-only: <reason>] on a writer-capable type — also for an artifact agent that writes only the scratchpad;',
    '  • writing in a DIFFERENT git checkout: add [tree: <absolute path of its root>] (a path that is not a git root is ignored);',
    '  • overlapping paths on purpose, only on the maintainer words: [maintainer-asked-parallel: <his words>].',
    '',
    footer,
  ].join('\n');
}
