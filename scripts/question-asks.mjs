// question-asks.mjs — the question-file lifecycle open -> asked -> resolved (KIT-T448), as pure
// text transforms over a `.ai/questions/<KEY>-Q###.md` file.
//
//   stampAsk(text, session, now?)          append `(asked) <session>` to History
//   askedEntries(text) / askedLabel(text)  the ask lines / `ASKED: <session> <date>` for the latest
//   resolveQuestion(text, who, answer, now?)  Resolution line + status: resolved + `(resolved)` History
//   resolutionText(text) / isOpenQuestion(text) / questionText(text)
//   questionMatches(asked, fileText, id?)  does an asked question restate this file's **Q:**?

import { splitFrontmatter, field } from './frontmatter.mjs';
import { appendUnderSection, stamp } from './md-body.mjs';
import { setField } from './t/ticket-file.mjs';

const ASK_LINE = /^- \[(\d{4}-\d{2}-\d{2})(?: \d{2}:\d{2})?\] \(asked\) (\S.*?)\s*$/gm;
const RESOLUTION_MARK = '**Resolution:**';
const RESOLUTION_LINE = /^\*\*Resolution:\*\*.*$/m;
const Q_MARK = '**Q:**';
const BODY_END = /\n## |<!--/;
const MIN_WORD = 4;
const MIN_SHARED = 3;
const MIN_SHARE = 0.6;
const STOPWORDS = new Set(['this', 'that', 'with', 'from', 'have', 'should', 'would', 'could', 'what', 'when', 'which',
  'there', 'their', 'about', 'into', 'than', 'then', 'does', 'will', 'your', 'they', 'been', 'only', 'more', 'also']);

export const askedEntries = (text) => [...String(text).matchAll(ASK_LINE)].map((m) => ({ date: m[1], session: m[2] }));

export function askedLabel(text) {
  const last = askedEntries(text).pop();
  return last ? `ASKED: ${last.session} ${last.date}` : '';
}

// The template says `open`; `cap`-routed questions carry the board status `todo`.
const OPEN_STATUSES = new Set(['open', 'todo', 'doing']);
export const isOpenQuestion = (text) => OPEN_STATUSES.has(field(splitFrontmatter(text)?.fm || '', 'status'));

const afterMark = (text, mark) => {
  const at = text.indexOf(mark);
  if (at === -1) return null;
  const rest = text.slice(at + mark.length);
  const end = rest.search(BODY_END);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
};

/** The recorded answer, or '' while the file still carries the template placeholder. */
export function resolutionText(text) {
  const body = afterMark(String(text).replace(/\r\n/g, '\n'), RESOLUTION_MARK) ?? '';
  return body.startsWith('<') ? '' : body;
}

export const questionText = (text) => {
  const body = afterMark(String(text).replace(/\r\n/g, '\n'), Q_MARK) ?? '';
  const end = body.indexOf(RESOLUTION_MARK);
  return (end === -1 ? body : body.slice(0, end)).replace(/\s+/g, ' ').trim();
};

export const stampAsk = (text, session, now = stamp()) => appendUnderSection(text, 'History', `- [${now}] (asked) ${session}`);

/** Record the answer: Resolution line, `status: resolved`, `(resolved)` History line. */
export function resolveQuestion(text, who, answer, now = stamp()) {
  const parts = splitFrontmatter(text);
  if (!parts) throw new Error('no frontmatter block to update');
  const line = `${RESOLUTION_MARK} (${now.slice(0, 10)}, ${who}) ${answer}`;
  let rest = parts.rest;
  if (RESOLUTION_LINE.test(rest)) rest = rest.replace(RESOLUTION_LINE, () => line);
  else {
    const end = rest.search(BODY_END);
    rest = end === -1 ? `${rest.trimEnd()}\n\n${line}\n` : `${rest.slice(0, end).trimEnd()}\n\n${line}\n${rest.slice(end)}`;
  }
  rest = appendUnderSection(rest, 'History', `- [${now}] (resolved) ${who}`);
  return `${parts.open}${setField(parts.fm, 'status', 'resolved')}${parts.close}${rest}`;
}

/** The distinctive words of a text: lower-case, at least 4 letters, no stopword. */
export const words = (s) => new Set(String(s).toLowerCase().match(/[a-z][a-z0-9]+/g)?.filter((w) => w.length >= MIN_WORD && !STOPWORDS.has(w)) ?? []);

export const citesId = (text, id) => new RegExp(`\\b${id}\\b`).test(text);

/** True when `asked` cites `id` or shares most of its distinctive words with the file's **Q:**. */
export function questionMatches(asked, fileText, id = '') {
  if (id && citesId(asked, id)) return true;
  const mine = words(asked);
  const theirs = words(questionText(fileText));
  const shared = [...mine].filter((w) => theirs.has(w)).length;
  return shared >= MIN_SHARED && shared / mine.size >= MIN_SHARE;
}
