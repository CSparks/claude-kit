// timing-dirty.mjs — the top reasons cargo gave for rebuilding a crate nothing needed (KIT-Q005 lever 3, KIT-D121), for
// `broker blockers`. Rows are the profile's 'dirty' rows, keyed '<crate>: <reason>' (timing-waste.mjs).
//
//   dirtyLines(rows, { crates, reasons }) -> text lines: the `crates` costliest crates, each with its `reasons` costliest reasons

export const TOP_CRATES = 5;
export const TOP_REASONS = 3;
const MS_PER_MIN = 60000;
const mins = (ms) => (ms / MS_PER_MIN).toFixed(1);
const SPLIT = ': ';

function grouped(rows) {
  const crates = new Map();
  for (const row of rows) {
    const at = row.key.indexOf(SPLIT);
    const name = `${row.project}/${row.lane} ${row.key.slice(0, at)}`;
    const entry = crates.get(name) || { name, ms: 0, reasons: [] };
    entry.ms += row.ms;
    entry.reasons.push({ reason: row.key.slice(at + SPLIT.length), ms: row.ms });
    crates.set(name, entry);
  }
  return [...crates.values()].sort((a, b) => b.ms - a.ms);
}

export function dirtyLines(rows, { crates = TOP_CRATES, reasons = TOP_REASONS } = {}) {
  if (!rows.length) return [];
  const lines = ['why crates rebuilt without need, cargo\'s dirty reason (top reasons per crate):'];
  for (const entry of grouped(rows).slice(0, crates)) {
    const top = entry.reasons.sort((a, b) => b.ms - a.ms).slice(0, reasons).map((r) => `${r.reason} ${mins(r.ms)} min`);
    lines.push(`  ${entry.name}: ${mins(entry.ms)} min — ${top.join('; ')}`);
  }
  return lines;
}
