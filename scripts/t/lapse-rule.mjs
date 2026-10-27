// t/lapse-rule.mjs — the review-lapse rule (KIT-D107): a ticket in `review` for more than
// LAPSE_DAYS with no explicit maintainer feedback since it entered review is lapsed (closed,
// labelled, findable). Pure: ticket text in, verdict out; the sweep (review-lapse.mjs) and the
// guarded transition (t status <id> done --lapsed) both decide through lapseVerdict.
//
// Feedback = a History event after the entry line that a human authored: a `@name:` / `Name:`
// lead on any event whose name is a human alias, a `(human)` status stamp (t status --human), or
// an event of a maintainer-only kind (asked again, capture, inbox).

import { splitFrontmatter, field } from '../frontmatter.mjs';
import { sectionRange } from '../md-body.mjs';
import { resolveUser, DEFAULT_USER } from '../identity.mjs';

export const LAPSE_DAYS = 14;
export const LAPSE_LABEL = 'lapsed';
export const HUMAN_MARK = '(human)';
export const lapseNote = `lapsed: ${LAPSE_DAYS}d in review, no maintainer feedback (KIT-D107)`;

const MS_PER_DAY = 86_400_000;
const HUMAN_KINDS = new Set(['asked again', 'capture', 'inbox']);
const STATIC_HUMANS = [DEFAULT_USER, 'maintainer'];
const EVENT_LINE = /^[-*]\s*\[(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?\]\s*(?:\(([^)]+)\)\s*)?(.*)$/;
const AUTHOR_LEAD = /^@?([\w-]+):/;
const ENTERS_REVIEW = /→\s*review\b/;

/** Lower-cased aliases that count as the maintainer: the resolved user, `user`, `maintainer`. */
export function humanAliases(extra = []) {
  return new Set([resolveUser(), ...STATIC_HUMANS, ...extra].map((s) => String(s).toLowerCase()));
}

const toMs = (date, time) => Date.parse(`${date}T${time || '00:00'}:00Z`);

function historyEvents(rest) {
  const lines = rest.split(/\r?\n/);
  const range = sectionRange(lines, 'History');
  if (!range) return [];
  return lines.slice(range.start, range.end).flatMap((l) => {
    const m = l.match(EVENT_LINE);
    return m ? [{ ms: toMs(m[1], m[2]), kind: (m[3] || 'note').toLowerCase(), detail: m[4].trim() }] : [];
  });
}

function isHumanEvent(e, humans) {
  if (HUMAN_KINDS.has(e.kind)) return true;
  if (e.kind === 'status' && e.detail.endsWith(HUMAN_MARK)) return true;
  const lead = e.detail.match(AUTHOR_LEAD);
  return Boolean(lead) && humans.has(lead[1].toLowerCase());
}

/** The ms timestamp the ticket last entered review, or null when it never did. */
export function reviewEntryMs(rest) {
  const entries = historyEvents(rest).filter((e) => e.kind === 'status' && ENTERS_REVIEW.test(e.detail));
  return entries.length ? entries[entries.length - 1].ms : null;
}

/** { status, eligible, idleDays, feedback, reason } for a ticket file's text at `now` (ms). */
export function lapseVerdict(text, { now = Date.now(), humans = humanAliases() } = {}) {
  const parts = splitFrontmatter(text);
  if (!parts) return { status: '', eligible: false, idleDays: 0, feedback: false, reason: 'no frontmatter' };
  const status = field(parts.fm, 'status');
  if (status !== 'review') return { status, eligible: false, idleDays: 0, feedback: false, reason: `status is '${status}', not review` };
  const events = historyEvents(parts.rest);
  const entryIdx = events.map((e) => e.kind === 'status' && ENTERS_REVIEW.test(e.detail)).lastIndexOf(true);
  const updated = field(parts.fm, 'updated');
  const entry = entryIdx >= 0 ? events[entryIdx].ms : Date.parse(updated);
  if (!Number.isFinite(entry)) return { status, eligible: false, idleDays: 0, feedback: false, reason: 'no review entry time' };
  const feedback = events.slice(entryIdx + 1).some((e) => isHumanEvent(e, humans));
  const idleDays = (now - entry) / MS_PER_DAY;
  const eligible = idleDays > LAPSE_DAYS && !feedback;
  const reason = feedback ? 'maintainer feedback since entering review' : idleDays > LAPSE_DAYS ? '' : `${Math.floor(idleDays)}d in review (needs more than ${LAPSE_DAYS}d)`;
  return { status, eligible, idleDays, feedback, reason };
}
