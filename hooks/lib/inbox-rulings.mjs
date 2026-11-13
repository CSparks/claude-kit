// inbox-rulings — maintainer rulings resting in the inbox (KIT-T938); cap, flush, orient and the dispatch gate share it.
// Promoted = the note left .ai/inbox/ (t decide --from, t triage or triage --apply moves it to inbox/triaged/).
//   isRuling(text, user?)                  the capture quotes the maintainer: verbatim, ruling, directive, user said, a quoted sentence
//   unpromotedRulings(root, { now, user }) -> [{ id, file, days, age, title, capturedMs, writtenMs }] oldest first; top-level inbox only
//                                            (days: age in days, null when unknown)
//   pendingNotes(root)                     -> every un-triaged note file name in the inbox
//   resolveInboxNotes(root, refs)         -> file names for ids, stems or unique prefixes; throws on an unknown or ambiguous ref
//   rulingLines(rulings, { limit })        -> one line per ruling, then +N more

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ageDays } from '../../scripts/q-inbox.mjs';
import { resolveUser } from '../../scripts/identity.mjs';

export const PROMOTE_COMMAND = 't decide --file <draft.md> --from <inbox id>';

const EXPLICIT = /\b(?:verbatim|rulings?|ruled|directives?|standing (?:rule|instruction|order))\b/i;
const MAINTAINER = /\bmaintainer\b/i;
const SAID = /\b(?:said|says|stated|wants|wanted|asked|told|ruled|rules|insists|directed|wrote)\b/i;
const DATE_AFTER = /^\W*\d{4}-\d{2}-\d{2}/;
const SPEECH_REACH = 80;
const DATE_REACH = 12;
const MIN_QUOTE_WORDS = 5;
const QUOTED = /(?:^|[\s(:[])(?:"([^"]+)"|“([^”]+)”|'([^']+)'(?=[\s.,;:)\]]|$)|‘([^’]+)’)/g;
const TYPE_TAG = /^\(([a-z][\w-]*)\)\s*/i;
const TICKET_TYPES = new Set(['bug', 'feature', 'task', 'process-failure']);
const VERBATIM_MARK = /\*\*Maintainer:\*\*|\bverbatim\b/i;
const WORDS = /\S+/g;
const HOURS_PER_DAY = 24;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordCount = (s) => (String(s).match(WORDS) || []).length;
const speechNear = (text, at) => SAID.test(text.slice(Math.max(0, at - SPEECH_REACH), at + SPEECH_REACH));

function namesSpeaker(text, user) {
  if (MAINTAINER.test(text) && speechNear(text, text.search(MAINTAINER))) return true;
  if (!user || user.toLowerCase() === 'user') return false;
  const re = new RegExp(`\\b${escapeRe(user)}\\b`, 'ig');
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length;
    if (speechNear(text, m.index) || DATE_AFTER.test(text.slice(end, end + DATE_REACH))) return true;
  }
  return false;
}

const quotesASentence = (text) => [...text.matchAll(QUOTED)].some((m) => wordCount(m[1] || m[2] || m[3] || m[4]) >= MIN_QUOTE_WORDS);

// A bug, feature, task or process-failure capture is the assistant's report: it quotes error text, labels and its own
// words, so only the maintainer's verbatim words (a **Maintainer:** paragraph or the word verbatim) make it a ruling.
export function isRuling(text, user = resolveUser()) {
  const body = String(text || '').trim();
  const type = (TYPE_TAG.exec(body) || [])[1];
  const prose = body.replace(TYPE_TAG, '');
  if (type && TICKET_TYPES.has(type.toLowerCase())) return VERBATIM_MARK.test(prose);
  return EXPLICIT.test(prose) || namesSpeaker(prose, user) || quotesASentence(prose);
}

const inboxDir = (root) => join(root, '.ai', 'inbox');
const isNote = (f) => f.endsWith('.md') && !/^README/i.test(f);

function captureStamp(file) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/.exec(file);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
}

function ageLabel(days) {
  if (days === null) return '?';
  return days < 1 ? `${Math.floor(days * HOURS_PER_DAY)}h` : `${Math.floor(days)}d`;
}

const firstLine = (text) => (String(text).split(/\r?\n/).find((l) => l.trim()) || '').trim();

export const pendingNotes = (root) => (existsSync(inboxDir(root)) ? readdirSync(inboxDir(root)).filter(isNote) : []);

export function unpromotedRulings(root, { now = Date.now(), user = resolveUser() } = {}) {
  const dir = inboxDir(root);
  const out = [];
  for (const file of pendingNotes(root)) {
    try {
      const text = readFileSync(join(dir, file), 'utf8');
      if (!isRuling(text, user)) continue;
      const writtenMs = statSync(join(dir, file)).mtimeMs;
      const days = ageDays(file, writtenMs, now);
      out.push({ id: file.replace(/\.md$/, ''), file, days, age: ageLabel(days), title: firstLine(text).replace(TYPE_TAG, ''), capturedMs: captureStamp(file), writtenMs });
    } catch { /* an unreadable note is no finding */ }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

export function resolveInboxNotes(root, refs) {
  const dir = inboxDir(root);
  const files = pendingNotes(root);
  return refs.map((ref) => {
    const want = String(ref).trim().replace(/\.md$/, '');
    if (files.includes(`${want}.md`)) return `${want}.md`;
    const prefixed = files.filter((f) => f.startsWith(want));
    if (prefixed.length === 1) return prefixed[0];
    throw new Error(prefixed.length ? `inbox note '${want}' is ambiguous: ${prefixed.join(', ')}` : `no inbox note '${want}' in ${dir}`);
  });
}

export function rulingLines(rulings, { limit = rulings.length, lineMax = 100 } = {}) {
  const lines = rulings.slice(0, limit).map((r) => `  ${r.id}  ${r.age}  ${r.title.slice(0, lineMax)}`);
  if (rulings.length > limit) lines.push(`  +${rulings.length - limit} more: q inbox`);
  return lines;
}
