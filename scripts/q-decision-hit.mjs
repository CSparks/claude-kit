// q-decision-hit.mjs — what `q fts` shows for a decision hit (KIT-T721). The match window of a decision can sit in its
// Rejected line, which reads as the opposite of what was decided; a decision hit shows its **Decision:** paragraph.
//
//   decisionHit(body)        -> "Decision: <first paragraph of the Decision section>", clipped; '' when the body has none
//   withDecisionHits(rows)   -> rows with each decision's `hit` replaced and the `body` column dropped

const DECISION_PARAGRAPH = /\*\*Decision:\*\*\s*([\s\S]*?)(?:\n\s*\n|$)/;
const DECISION_ID = /-D\d+$/;
const MAX_CHARS = 240;

export function decisionHit(body) {
  const m = DECISION_PARAGRAPH.exec(String(body || ''));
  if (!m) return '';
  const text = m[1].replace(/\s+/g, ' ').trim();
  return `Decision: ${text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text}`;
}

export function withDecisionHits(rows) {
  return rows.map(({ body, ...row }) => (DECISION_ID.test(row.id) ? { ...row, hit: decisionHit(body) || row.hit } : row));
}
