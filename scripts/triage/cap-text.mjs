// triage/cap-text.mjs — parse a cap's body into its (type) tag, human text, and an FTS dedup
// needle. The (type) shape matches cap.mjs writes / db-parse.leadingType reads, so the three agree
// on what counts as an explicit type.

const TYPE_RE = /^\(([a-z][\w-]*)\)/i;
const STRIP_TYPE = /^\([a-z][\w-]*\)\s*/i;
const ALNUM_TERM = /[a-z][a-z\d]*/g;
const MIN_TERM_LEN = 2; // ignore terms this short (a, of, id) when building the OR-needle
const SLUG_MAX = 48;
const NON_SLUG = /[^a-z\d]+/g;
const TRIM_DASH = /^-|-$/g;

const TITLE_MAX = 140;                  // a title is a LABEL for the board, not the capture
const HEADING_MARK = /^#{1,6}[ \t]*/;   // a cap that opens `# Heading` (YAML reads `#` as a comment)
// A cap typed with flags cap.mjs does not take (`… --body <the whole story>`, `… --priority high`)
// captures them as literal text. They are argv debris, never title prose — cut from the first one on.
const FLAG_TAIL = /\s+--(?:body|priority|type|project|title|note|done)\b[\s\S]*$/i;
const META_TAIL = /(?:\s+\b(?:type|priority|status|project)[ \t]*:[ \t]*\S+)+$/i;
const WS = /\s+/g;

export function leadingType(body) {
  const m = String(body || '').trimStart().match(TYPE_RE);
  return m ? m[1] : '';
}

export function capText(body) {
  return String(body || '').trim().replace(STRIP_TYPE, '').trim();
}

// A proposal -> an FTS OR-query so a candidate matches on ANY shared term (a duplicate rarely
// shares every word). Empty in -> a never-matching query, so a blank cap surfaces no candidates.
export function ftsOrQuery(text) {
  const terms = (String(text || '').toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN);
  return terms.length ? terms.join(' OR ') : '""';
}

// A cap's ONE-LINE title (KIT-T126). The cap body is prose of any length and shape; the
// frontmatter `title:` is a single YAML scalar, and writing the whole capture into it broke the
// block outright — 31 items corrupted on 2026-07-14, 8 more on 2026-08-04, every one hand-repaired.
// The full text still goes to the body; this is only the label. A leading `#` is stripped because
// YAML would read the title as a comment and the board would show a blank row.
export function capTitle(text, max = TITLE_MAX) {
  const first = (String(text || '').split('\n').find((l) => l.trim()) || '').trim();
  const line = first.replace(HEADING_MARK, '').replace(FLAG_TAIL, '').replace(META_TAIL, '').replace(WS, ' ').trim();
  if (!line) return 'untitled capture';
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function slugify(text) {
  return String(text).toLowerCase().replace(NON_SLUG, '-').replace(TRIM_DASH, '').slice(0, SLUG_MAX) || 'item';
}

export function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
