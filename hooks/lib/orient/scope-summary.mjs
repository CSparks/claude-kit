// scope-summary — the "by scope" line of orient's Open work section: open-ticket counts per id scope, capped so the line
// stays one line however many projects the machine registers.
//
//   scopeSummary(scopes, shown = SCOPES_SHOWN) -> 'KIT:837  RDG:12  +3 more scopes (9 open)'
//     scopes: Map<scope, open count>; the `shown` largest scopes (ties by name) are listed, the rest fold into the "+N more" tail.

export const SCOPES_SHOWN = 6;

export function scopeSummary(scopes, shown = SCOPES_SHOWN) {
  const ranked = [...scopes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const listed = ranked.slice(0, shown).map(([scope, count]) => `${scope}:${count}`);
  const folded = ranked.slice(shown);
  if (!folded.length) return listed.join('  ');
  const hidden = folded.reduce((sum, [, count]) => sum + count, 0);
  return [...listed, `+${folded.length} more scopes (${hidden} open)`].join('  ');
}
