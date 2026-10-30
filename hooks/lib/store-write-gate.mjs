// The "every store write goes through a kit command" convention (KIT-T509), as a pure decision
// for the pre-write hook (check-id `store-write`). Hand Writes/Edits are refused for:
//   - CREATING a file in a typed store folder (the verb mints the id and builds the file),
//   - CHANGING an existing item there (KIT-D120: t and cap keep History and the cache true),
//   - any write to SESSION.md, the generated views and the hook-owned logs.
// Templates and READMEs are not items. Every refusal names the verb that makes the change.
//
//   storeWriteViolation(file, { exists }) -> null | { rel, command, why }
//   ITEM_VERBS                  the verbs that change an existing item, by store folder

import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const PROSE = 't notes <id> "<prose>" (append) | t edit <id> --section Description|Plan|Notes --file <path> (replace)';

export const ITEM_VERBS = {
  tickets: `t status <id> <state> | t tick | t criterion | t link / t unlink | t comment <id> "<text>" --author <who> | ${PROSE}`,
  decisions: 't revise <id> [--status-to <s>] [--summary "<text>"] [--file <draft.md>] | t notes <id> "<prose>"',
  questions: 't ask <id> | t resolve <id> "<answer>" | t notes <id> "<prose>"',
  notes: PROSE,
  epics: `t status <id> <state> | ${PROSE}`,
  requests: `t status <id> <state> | ${PROSE}`,
};

const CREATE = {
  tickets: ['t new <type> "<title>" [--description "<text>" | --file <path>]', 'a ticket'],
  decisions: ['t decide --file <draft.md>', 'a decision'],
  questions: ['t question "<question>" [--answerable-by chris|claude]', 'a question'],
  notes: ['t note "<title>" [--body "<text>" | --file <path>]', 'a note'],
  epics: ['t epic "<title>" [--body "<text>" | --file <path>]', 'an epic'],
  requests: ['t request "<title>" [--body "<text>" | --file <path>]', 'a request'],
  inbox: ['cap [type] "<text>"  (then triage promotes it)', 'an inbox capture'],
  resolved: ['cap --done [type] "<text>"', 'a resolved event'],
  reminders: ['rem add "<title>" --every <days>', 'a reminder'],
};

const FIXED = {
  'SESSION.md': ['t session "<text>" | --file <path> [--append] | --fix "<old>" "<new>" | --drop "<text>"', 'the resume anchor'],
  'agents.jsonl': ['(written by the Task hooks; no hand edit)', 'the agent roster'],
  'agents-progress.jsonl': ['(written by the progress hook; no hand edit)', 'the agent progress log'],
  'read-receipts.json': ['t ack <id>#<n> --agent <name>', 'the read receipts'],
  'model-lineup.json': ['node scripts/model-refresh.mjs', 'the model lineup'],
  'REGRESSIONS.md': ['node scripts/index-tickets.mjs', 'a generated view'],
  'SUPERSEDED.md': ['node scripts/index-tickets.mjs', 'a generated view'],
  'tickets/INDEX.md': ['node scripts/index-tickets.mjs', 'a generated view'],
};

const NON_ITEMS = new Set(['_TEMPLATE.md', 'README.md']);

// The store directory a path sits in: `<x>/.ai/` (a repo, or a junction to the central copy) or a
// central `<x>/projects/<name>/`. Only a directory carrying config.yml is a store.
function splitStore(norm) {
  const cands = [];
  const i = norm.lastIndexOf('/.ai/');
  if (i >= 0) cands.push([norm.slice(0, i + 4), norm.slice(i + 5)]);
  const m = norm.match(/^(.*\/projects\/[^/]+)\/(.+)$/);
  if (m) cands.push([m[1], m[2]]);
  return cands.find(([base]) => existsSync(`${base}/config.yml`)) || null;
}

function roadmapGenerated(base) {
  try { return /^roadmap_mode:[ \t]*generated/m.test(readFileSync(`${base}/config.yml`, 'utf8')); } catch { return false; }
}

export function storeWriteViolation(file, { exists = existsSync(file) } = {}) {
  const norm = String(file).split(String.fromCharCode(92)).join('/');
  const store = splitStore(norm);
  if (!store) return null;
  const [base, rel] = store;
  const fixed = FIXED[rel] || (rel === 'ROADMAP.md' && roadmapGenerated(base) ? ['node scripts/index-tickets.mjs', 'a generated view'] : null);
  if (fixed) return { rel, command: fixed[0], why: `${fixed[1]} is not hand-written` };
  const dir = rel.split('/')[0];
  const create = CREATE[dir];
  if (create && rel.includes('/') && !exists && !NON_ITEMS.has(basename(rel))) {
    return { rel, command: create[0], why: `${create[1]} is created by its command, which mints the id and builds the file` };
  }
  const change = ITEM_VERBS[dir];
  if (change && rel.includes('/') && exists && !NON_ITEMS.has(basename(rel))) {
    return { rel, command: change, why: `${create[1]} is changed by its command, which stamps History and refreshes the cache (KIT-D120)` };
  }
  return null;
}
