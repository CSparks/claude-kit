// Per-ITEM identity for captures: which Claude Code session produced an item, and under
// which topic. A store that is not bounded by a repo holds several unrelated threads at
// once, so the item — not the store — carries the label (KIT-T189).
//
//   session : the harness session id. Hooks receive it on their stdin payload; the CLIs do
//             not, so SessionStart persists it to `<aiDir>/.session` for them to read.
//   topic   : a slug set EXPLICITLY with `cap topic <slug>` and stamped on every later
//             capture in that session. Never derived from a prompt — a guessed label is
//             worse than none. Changing the session id clears it: a topic is per session.
//
// Everything here is best-effort; a missing or malformed pointer reads as no identity.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const SESSION_FILE = '.session';

const EMPTY = { session: '', topic: '', updated: '' };

export function sessionFile(aiDir) {
  return join(aiDir, SESSION_FILE);
}

export function readIdentity(aiDir) {
  try {
    const r = JSON.parse(readFileSync(sessionFile(aiDir), 'utf8'));
    return {
      session: String(r.session || ''),
      topic: String(r.topic || ''),
      updated: String(r.updated || ''),
    };
  } catch {
    return { ...EMPTY };
  }
}

// Merge `patch` over the stored identity and write it back. Returns the stored result.
// A `session` that differs from the stored one RESETS the topic unless the same call sets
// one, so a new session never inherits the last one's label.
export function writeIdentity(aiDir, patch = {}) {
  const cur = readIdentity(aiDir);
  const next = { ...cur, ...patch, updated: new Date().toISOString() };
  if (patch.session && patch.session !== cur.session && patch.topic === undefined) next.topic = '';
  try {
    mkdirSync(aiDir, { recursive: true });
    writeFileSync(sessionFile(aiDir), JSON.stringify(next, null, 2) + '\n');
  } catch {
    /* identity is a convenience, never a blocker */
  }
  return next;
}

// A slug is lowercase alphanumerics and dashes — the same shape cap gives a filename, so a
// topic reads identically in a filename, an index and a query.
export function normalizeTopic(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// The trailing `key: value` block an item carries. Mirrors cap --done's `resolved:` line, so
// the first line stays the item's title for every existing reader (triage, q inbox).
export function identityBlock({ topic, session } = {}) {
  const lines = [];
  if (topic) lines.push(`topic: ${topic}`);
  if (session) lines.push(`session: ${session}`);
  return lines.length ? `\n${lines.join('\n')}\n` : '';
}
