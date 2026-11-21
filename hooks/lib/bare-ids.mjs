// bare-ids — ticket, decision and run ids in a reply to the maintainer (KIT-T1462). He cannot read them: the thing is named
// by what it does, never by its id, not even in brackets after the words. Ids stay in briefs, commit messages, tickets
// and the record. A commit hash may appear only in the landing receipt, after the words.
//
//   bareIdReport(text) -> { ids, pastedList, flagged } over the reply's own voice
//     ids        -> every ticket, decision, lever or run id token (RDG-D146, KIT-T1462, TH-73, run-2026-11-21-a)
//     pastedList -> the first line that is a list of id-like tokens (ids or commit-hash shapes: a hook-relayed roster)
//     flagged    -> ids found, or a pasted list
//
// The reply is read as lib/prose-ask.mjs reads it: fenced and inline code, blockquote lines and double-quoted text never
// count. A landing-receipt commit line (`<sha> <subject> | <ticket ids> | <push state>`) never counts.

import { ownVoice } from './prose-ask.mjs';

export const LIST_RUN = 3;
export const LIST_WORDS_PER_ID = 2;

const TICKET_ID = String.raw`\b(?!(?:UTF|SHA|ISO|MD|AES|RSA|CRC)-\d)[A-Z]{2,5}-[A-Z]?\d{1,5}\b`;
const RUN_ID = String.raw`\brun-\d{4}[\w-]*`;
const SHA = String.raw`\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b`;
const NAMED_ID = new RegExp(`${TICKET_ID}|${RUN_ID}`, 'g');
const ANY_ID = new RegExp(`${TICKET_ID}|${RUN_ID}|${SHA}`, 'g');
const WORD = /[A-Za-z][A-Za-z'’-]*/g;
const COMMIT_LINE = /^\s*[0-9a-f]{7,40}\s.*\|.*\|/i;

const wordsIn = (line) => (line.replace(ANY_ID, ' ').match(WORD) || []).length;

export function bareIdReport(text) {
  const lines = typeof text === 'string' ? ownVoice(text).split('\n').filter((l) => !COMMIT_LINE.test(l)) : [];
  const ids = lines.flatMap((l) => l.match(NAMED_ID) || []);
  const pastedList = lines.find((l) => {
    const found = l.match(ANY_ID) || [];
    return found.length >= LIST_RUN && wordsIn(l) <= found.length * LIST_WORDS_PER_ID;
  })?.trim() || null;
  return { ids, pastedList, flagged: ids.length > 0 || Boolean(pastedList) };
}
