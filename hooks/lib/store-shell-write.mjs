// A shell command or node script that WRITES the .ai work store by hand (redirect, mv/rm/cp, sed -i, a
// PowerShell cmdlet, `node -e`, a heredoc or scratch script). The store changes through t, cap and rem;
// this is the shell twin of pre-write's `store-write` check.
//
//   shellStoreWrite(command, { readScript }) -> null | { path, hint }

import { FS_WRITE, readTempScript, scanShellWrites } from './shell-write-scan.mjs';
import { ITEM_VERBS } from './store-write-gate.mjs';

const ITEM_DIRS = 'tickets|decisions|questions|notes|epics|requests|inbox|resolved|reminders';
const STORE_PATH = new RegExp(`(?:\\.ai|projects[\\\\/][^\\\\/\\s"']+)[\\\\/](?:(${ITEM_DIRS})[\\\\/]|SESSION\\.md|agents\\.jsonl|read-receipts\\.json|REGRESSIONS\\.md|SUPERSEDED\\.md)`, 'i');
const BUILT_PATH = new RegExp(`['"]\\.ai['"][\\s\\S]*['"](?:${ITEM_DIRS}|SESSION\\.md)['"]`, 'i');

const HINTS = {
  tickets: `t new | ${ITEM_VERBS.tickets}`,
  decisions: `t decide --file <draft.md> (new) | ${ITEM_VERBS.decisions}`,
  inbox: 'cap [type] "<text>" (capture) | t triage <inbox-file> [--type <t>] (promote and file the capture)',
  questions: `t question | ${ITEM_VERBS.questions}`,
  notes: `t note "<title>" | ${ITEM_VERBS.notes}`,
  epics: `t epic "<title>" | ${ITEM_VERBS.epics}`,
  requests: `t request "<title>" | ${ITEM_VERBS.requests}`,
  resolved: 'cap --done [type] "<text>"',
  reminders: 'rem add "<title>" --every <days>',
  session: 't session "<text>" | --append | --replace --file <draft> | --fix "<old>" "<new>" | --drop "<text>"',
  other: 'the verb that owns this file (t, cap, rem); t move <id> <repo-path> moves an item between repos',
};

function hintFor(path) {
  const m = STORE_PATH.exec(path);
  if (!m) return HINTS.other;
  if (m[1]) return HINTS[m[1].toLowerCase()];
  return /SESSION\.md/i.test(m[0]) ? HINTS.session : HINTS.other;
}

const hit = (path) => (STORE_PATH.test(path) ? { path, hint: hintFor(path) } : null);

function codeWrites(code) {
  if (!FS_WRITE.test(code)) return null;
  const named = STORE_PATH.exec(code);
  if (!named && !BUILT_PATH.test(code)) return null;
  return { path: named ? named[0] : '.ai/…', hint: named ? hintFor(named[0]) : HINTS.other };
}

export function shellStoreWrite(command, { readScript = readTempScript } = {}) {
  return scanShellWrites(command, { hit, codeHit: codeWrites, readScript, ambiguous: () => ({ path: '.ai/…', hint: HINTS.other, ambiguous: true }) });
}
