// A ticket draft handed to `t new --file`/`--description` may be a whole ticket body with its own
// `## Description`, `## Acceptance Criteria`, `## Plan` and `## Notes` headings. splitDraft returns
// those parts so scaffoldNew fills the template's sections instead of nesting a second set of
// headings inside the Description.
//
//   splitDraft(text) -> { description, criteria, plan, notes }   (strings, '' when absent)

const SECTION_RE = /^##[ \t]+(Description|Acceptance Criteria|Plan|Notes)[ \t]*$/im;
const HEADING_LINE = /^##[ \t]+(.+?)[ \t]*$/;

const KEYS = { description: 'description', 'acceptance criteria': 'criteria', plan: 'plan', notes: 'notes' };

export function splitDraft(text) {
  const out = { description: '', criteria: '', plan: '', notes: '' };
  const source = String(text ?? '');
  if (!SECTION_RE.test(source)) return { ...out, description: source.trim() };
  let current = 'description';
  const buckets = { description: [], criteria: [], plan: [], notes: [] };
  for (const line of source.split(/\r?\n/)) {
    const h = line.match(HEADING_LINE);
    const key = h && KEYS[h[1].toLowerCase()];
    if (key) { current = key; continue; }
    if (h && h[1].toLowerCase() === 'history') { current = null; continue; }
    if (current) buckets[current].push(line);
  }
  for (const k of Object.keys(buckets)) out[k] = buckets[k].join('\n').trim();
  return out;
}
