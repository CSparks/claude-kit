// coordination-model.mjs — the main thread coordinates, it does not plan (KIT-D098). The capability
// table's `coordination` row names the family that runs the main thread (sonnet); plans are dispatched
// to the `plan` job (opus, fable as fallback). SessionStart orient asks `mainThreadNotice` about the
// model the harness reports, and prints the notice (naming the exact `/model` switch) when it is
// another family.
//
//   familyOf(model)                      -> 'fable' | 'opus' | 'sonnet' | 'haiku' | null, from an id or alias
//   mainThreadNotice(model, kitRoot?)    -> the one-line notice, or null (right family, unknown model, no row)

import { readLadder, ladderRoot } from './dispatch-ladder.mjs';

const FAMILIES = ['fable', 'opus', 'sonnet', 'haiku'];

export const familyOf = (model) => {
  const m = String(model || '').toLowerCase();
  return FAMILIES.find((f) => m.includes(f)) || null;
};

export function mainThreadNotice(model, kitRoot = ladderRoot()) {
  const family = familyOf(model);
  if (!family) return null;
  let row;
  let plan;
  try {
    const ladder = readLadder(kitRoot);
    row = ladder.jobs.coordination;
    plan = ladder.jobs.plan;
  } catch { return null; }
  if (!row || row.family === family) return null;
  const planners = [plan && plan.family, plan && plan.fallback].filter(Boolean).join(', fallback ');
  return `!! main thread runs ${family} (${model}); coordination runs on ${row.family} (KIT-D098): switch with \`/model ${row.family}\`. Planning is a dispatch to the plan job (${planners || 'opus'}), never this thread's work.`;
}
