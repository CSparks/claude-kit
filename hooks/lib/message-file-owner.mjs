// message-file-owner.mjs — who last wrote a file outside every adopted repo, so a `git commit -F <file>` never commits
// a message another agent left there (KIT-T1135). The writers of one session share one scratchpad: two agents that both
// wrote `msg.txt` overwrote each other, and a pushed commit carried the other agent's message.
//
// Machine-local turn state (an append-only record slot, so concurrent writers drop nothing); every path fails open: a
// file with no record, or one whose content changed since the tool wrote it (a shell rewrite), has no owner to judge.
//
//   recordFileWrite(file, hash, writer)                      -> note that `writer`'s Write/Edit left `hash` in `file`
//   foreignMessageWriter(file, hash, writer) -> string       the other writer whose tool last left `hash` in `file`, '' when none
//   messageFileProblem(file, writer, footer) -> string       the block message, '' when the committer may use the file

import { resolve } from 'node:path';
import { appendTurnRecord, readTurnRecords } from './turn-state.mjs';
import { contentHashOf } from './shell-snapshot.mjs';

const STATE_ROOT = 'file-writers';
const SLOT = 'files';
const RECORDS_MAX = 5000;
const keyOf = (file) => resolve(String(file)).replace(/\\/g, '/').toLowerCase();

export function recordFileWrite(file, hash, writer) {
  if (file && hash && writer) appendTurnRecord(STATE_ROOT, SLOT, { f: keyOf(file), h: hash, w: writer });
}

export function foreignMessageWriter(file, hash, writer) {
  const key = keyOf(file);
  const last = readTurnRecords(STATE_ROOT, SLOT).slice(-RECORDS_MAX).reverse().find((r) => r && r.f === key);
  return last && last.h === hash && last.w !== writer ? last.w : '';
}

export function messageFileProblem(file, writer, footer) {
  const owner = foreignMessageWriter(file, contentHashOf('', file), writer);
  if (!owner) return '';
  return [
    '',
    `BLOCKED: the commit message file ${file} was last written by another agent (${owner}), not by you (KIT-T1135).`,
    '',
    'The agents of one session share one scratchpad, so a fixed name like msg.txt is overwritten by whoever wrote it last and',
    'the commit would carry their message. Write your message to a name only you use, with the Write tool, then commit with it:',
    '  <scratchpad>/commit-<ticket id>-<six random characters>.txt',
    '',
    footer,
  ].join('\n');
}
