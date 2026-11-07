// build-note.mjs — the latest checkpoint line of a running broker command (KIT-D137), kept in a file beside its log so
// the heartbeat a waiter sees (heartbeat.mjs) can repeat it.
//
//   writeNote(logPath, line) / readNote(logPath) -> line | '' / clearNote(logPath)

import { readFileSync, rmSync, writeFileSync } from 'node:fs';

const noteFile = (logPath) => `${logPath}.note`;

export const writeNote = (logPath, line) => writeFileSync(noteFile(logPath), line);
export const clearNote = (logPath) => rmSync(noteFile(logPath), { force: true });

export function readNote(logPath) {
  try { return readFileSync(noteFile(logPath), 'utf8').trim(); } catch { return ''; }
}
