// SessionStart orientation for a session with NO store above its cwd (a home directory, a
// scratch dir). Instead of the historical no-op it names the unbounded catch-all, persists
// the harness session id where the CLIs can read it, and asks for a topic (KIT-T189).
//
// Deliberately COMPACT — an unbounded session has no repo, no board and no roadmap to replay,
// so this is a pointer to the store plus the two things a capture needs to be retrievable
// later. FAIL-OPEN: any failure exits 0 and the session proceeds as before.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { payload } from './lib/stdin.mjs';
import { unboundedRoot } from './lib/unbounded.mjs';
import { readIdentity, writeIdentity } from './lib/session-identity.mjs';

const TOPICS_SHOWN = 5;
const SESSION_SHORT = 8;
const RULE_WIDTH = 78;

function openCaptures(aiDir) {
  try {
    return readdirSync(join(aiDir, 'inbox')).filter((n) => n.endsWith('.md') && !/^README/i.test(n)).length;
  } catch {
    return 0;
  }
}

async function topicLine(root) {
  try {
    const { collectItems } = await import('../scripts/db-parse.mjs');
    const { topicIndex } = await import('../scripts/q-topics.mjs');
    const rows = topicIndex(collectItems(root));
    if (!rows.length) return '';
    return `topics: ${rows.slice(0, TOPICS_SHOWN).map((r) => `${r.topic} (${r.items}, ${r.last})`).join(' · ')}   [q topics]`;
  } catch {
    return ''; // a broken scripts/ tree degrades this one line, never orientation
  }
}

export async function orientUnbounded() {
  const root = unboundedRoot();
  if (!root) return 0; // nothing configured — keep the historical no-op
  const aiDir = join(root, '.ai');
  const p = await payload();
  const id = writeIdentity(aiDir, { session: String(p.session_id || readIdentity(aiDir).session || '') });

  const lines = [
    '=== UNBOUNDED SESSION — no .ai above this cwd; the catch-all store is in use ===',
    `store: ${aiDir}${id.session ? `   session: ${id.session.slice(0, SESSION_SHORT)}` : ''}`,
    id.topic
      ? `topic: ${id.topic}   (change it any time: cap topic <slug>)`
      : 'topic: NONE SET — run `cap topic <slug>` before capturing, or items land unlabelled',
    `open captures: ${openCaptures(aiDir)}   [q inbox]`,
  ];
  const topics = await topicLine(root);
  if (topics) lines.push(topics);
  lines.push('capture: cap "…"   ·   promote into a repo: t move <id> <repo-path>');
  lines.push('='.repeat(RULE_WIDTH));
  console.log(lines.join('\n'));
  return 0;
}
