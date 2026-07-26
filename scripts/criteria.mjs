// The acceptance-criteria concern: read, check, uncheck and append criterion lines. Pure
// body→body transforms — no fs, no id lookup — so the invariants (which line a selector means,
// that EVERY mutation stamps History) live in one place and both callers inherit them: the `t`
// CLI and the web API's write layer (KIT-T153). A client addresses a criterion by its INDEX
// among the section's criterion lines — the order it renders — while the CLI keeps its
// ordinal-among-matching / substring selector.
//
// Scoped to the `## Acceptance Criteria` section on purpose: a `- [ ]` under Plan or Notes is not
// a criterion, and the pre-KIT-T153 whole-body scan would happily tick one.

import { appendUnderSection, sectionRange, stamp } from './md-body.mjs';

const HEADING = 'Acceptance Criteria';
const BOX = /^(?<open>\s*-\s*\[)(?<box>[ xX])(?<close>\]\s*)(?<text>.*)$/;

// Each item keeps the line's own bracket/indent fragments, so rewriting a box reassembles the
// original line instead of running a regex replace over text that may contain `$` specials.
function scan(body) {
  const lines = String(body ?? '').split('\n');
  const range = sectionRange(lines, HEADING);
  const items = [];
  if (range) {
    for (let i = range.start; i < range.end; i++) {
      const m = lines[i].match(BOX);
      if (!m) continue;
      const { open, box, close, text } = m.groups;
      items.push({ index: items.length, line: i, open, close, text: text.trim(), checked: box.toLowerCase() === 'x' });
    }
  }
  return { lines, items };
}

// Exactly one space between `]` and the text (none when the line has no text) — `t new`'s bare
// `- [ ]` placeholder carries no trailing space, so filling it would otherwise glue the words on.
const render = (item, box) => `${item.open}${box}${item.close.replace(/\s*$/, item.text ? ' ' : '')}${item.text}`;

// The rendered criterion list — the SAME indexing the mutators address, so a client's row number
// and the markdown line can never drift apart.
export function listCriteria(body) {
  return scan(body).items.map(({ index, text, checked }) => ({ index, text, checked }));
}

// Flip one criterion's box and stamp the audit line. The event names the act in History so an
// untick is as visible as a tick — an undone criterion that left no trace would be the one
// mutation the store forgets.
function apply(lines, item, checked, note) {
  lines[item.line] = render(item, checked ? 'x' : ' ');
  const event = checked ? 'ticked' : 'unticked';
  return {
    body: appendUnderSection(lines.join('\n'), 'History', `- [${stamp()}] (comment) ${event}: ${note || item.text}`),
    criterion: item.text,
  };
}

// Resolve the CLI's selector among the criteria eligible for the act: a 1-based ordinal scoped to
// that subset (what `t tick 2` has always meant), or a substring that must hit exactly one.
function resolveSelector(items, selector, wantChecked, id) {
  const pool = items.filter((c) => c.checked === wantChecked);
  const what = wantChecked ? 'checked' : 'open';
  if (!pool.length) throw new Error(`${id}: no ${what} acceptance criteria`);
  if (/^\d+$/.test(String(selector))) {
    const n = parseInt(selector, 10);
    if (n < 1 || n > pool.length) throw new Error(`${id}: ordinal ${n} out of range (1..${pool.length} ${what} criteria)`);
    return pool[n - 1];
  }
  const needle = String(selector).toLowerCase();
  const hits = pool.filter((c) => c.text.toLowerCase().includes(needle));
  if (!hits.length) throw new Error(`${id}: no ${what} criterion matches "${selector}"`);
  if (hits.length > 1) throw new Error(`${id}: "${selector}" matches ${hits.length} criteria — use an ordinal`);
  return hits[0];
}

function bySelector(body, selector, checked, opts) {
  const id = opts.id || 'ticket';
  const { lines, items } = scan(body);
  if (!items.length) throw new Error(`${id}: no acceptance criteria to ${checked ? 'tick' : 'untick'}`);
  return apply(lines, resolveSelector(items, selector, !checked, id), checked, opts.note);
}

export const tickCriterion = (body, selector, opts = {}) => bySelector(body, selector, true, opts);
export const untickCriterion = (body, selector, opts = {}) => bySelector(body, selector, false, opts);

// Index-addressed toggle — the API path. Refuses a no-op flip so a stale client (a second tab, a
// double-click) is told its view is behind instead of silently rewriting an identical line.
export function setCriterionAt(body, index, checked, opts = {}) {
  const id = opts.id || 'ticket';
  const { lines, items } = scan(body);
  const item = items[Number(index)];
  if (!item) throw new Error(`${id}: no criterion at index ${index} (the section has ${items.length})`);
  if (item.checked === checked) throw new Error(`${id}: criterion "${item.text}" is already ${checked ? 'checked' : 'open'}`);
  return apply(lines, item, checked, opts.note);
}

// Append a criterion. `t new`'s skeleton seeds ONE empty `- [ ]` placeholder, so the first added
// criterion fills that line rather than leaving a blank row above itself.
export function addCriterion(body, text, opts = {}) {
  const id = opts.id || 'ticket';
  const criterion = String(text ?? '').trim();
  if (!criterion) throw new Error(`${id}: a criterion needs non-empty text`);
  if (/[\r\n]/.test(criterion)) throw new Error(`${id}: a criterion is a single line — no newlines`);
  const { lines, items } = scan(body);
  const placeholder = items.find((c) => !c.checked && !c.text);
  if (placeholder) lines[placeholder.line] = render({ ...placeholder, text: criterion }, ' ');
  const withCriterion = placeholder
    ? lines.join('\n')
    : appendUnderSection(lines.join('\n'), HEADING, `- [ ] ${criterion}`);
  return {
    body: appendUnderSection(withCriterion, 'History', `- [${stamp()}] (comment) criterion added: ${criterion}`),
    criterion,
  };
}
