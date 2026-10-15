// The `t` verbs that file or write a non-ticket store item (KIT-T509): note, epic, request,
// question, notes, session. t.mjs routes here; each verb validates its args, writes through its
// own module, and refreshes the derived board + cache like every other mutation.
//
//   runVerb(cmd, rest, flags, root, refresh) -> true when `cmd` was one of these verbs

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { createItem, KINDS } from './t-create.mjs';
import { appendNotes } from './t-notes.mjs';
import { writeSession } from './t-session.mjs';

const USAGE = {
  note: 't note "<title>" [--body "<text>" | --file <path>] [--links A,B]',
  epic: 't epic "<title>" [--body "<text>" | --file <path>] [--priority <p>] [--links A,B]',
  request: 't request "<title>" [--body "<text>" | --file <path>] [--priority <p>] [--links A,B]',
  question: 't question "<question>" [--body "<detail>" | --file <path>] [--answerable-by chris|claude]',
  notes: 't notes <id> "<prose>" | --file <path>',
  session: 't session "<text>" | --file <path> [--append]',
};

export const VERBS = Object.keys(USAGE);

const fileOr = (flags, fallback) => (flags.file ? readFileSync(flags.file, 'utf8') : fallback);

function fail(cmd) {
  console.error(`usage: ${USAGE[cmd]}`);
  process.exit(2);
}

export async function runVerb(cmd, rest, flags, root, refresh) {
  if (!VERBS.includes(cmd)) return false;
  if (cmd === 'session') {
    const r = writeSession(root, fileOr(flags, rest.join(' ')), { append: flags.append });
    await refresh(root);
    process.stdout.write(`session: ${relative(root, r.path)} ${flags.append ? 'appended' : 'written'} (${r.lines} lines)\n`);
    return true;
  }
  if (cmd === 'notes') {
    const [id, ...words] = rest;
    if (!id) fail(cmd);
    const r = appendNotes(root, id, fileOr(flags, words.join(' ')));
    await refresh(root);
    process.stdout.write(`notes: ${r.id} + ${relative(root, r.path)}\n`);
    return true;
  }
  const title = rest.join(' ');
  if (!title.trim()) fail(cmd);
  const r = createItem(root, cmd, title, { ...flags, body: fileOr(flags, flags.body) });
  await refresh(root);
  process.stdout.write(`${cmd}: ${r.id} -> ${relative(root, r.path)}\n`);
  return true;
}

export { KINDS };
