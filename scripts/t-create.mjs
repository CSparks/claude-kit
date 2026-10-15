// `t note | t epic | t request | t question` — file a non-ticket item straight into its store
// (KIT-T509). Each verb is the sanctioned writer for its folder: the id is minted by id-reserve,
// the file is built from the store's _TEMPLATE.md by the same writer triage uses, and the args are
// validated before an id is minted, so a bad call burns no id.
//
//   createItem(root, kind, title, opts) -> { id, path }
//   opts: { body, links: string[], priority, answerableBy }

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reserveNextId } from './id-reserve.mjs';
import { readConfig } from './t-config.mjs';
import { writeFromTemplate } from './triage/write-item.mjs';
import { stamp } from './md-body.mjs';

export const KINDS = {
  note: { store: 'notes', body: 'the observation' },
  epic: { store: 'epics', body: 'the goal', priority: true },
  request: { store: 'requests', body: 'the ask', priority: true },
  question: { store: 'questions', body: 'the question' },
};

const ANSWERERS = ['chris', 'claude'];
const HISTORY_PLACEHOLDER = /\[<YYYY-MM-DD HH:MM>\]/;

function validate(root, kind, title, opts) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`t: unknown item kind '${kind}' (one of: ${Object.keys(KINDS).join(', ')})`);
  if (!title || !title.trim()) throw new Error(`t ${kind}: a non-empty "<title>" is required`);
  if (/[\n\r]/.test(title)) throw new Error(`t ${kind}: a title is a single line — put the detail in --body or --file`);
  const cfg = readConfig(root);
  const priority = spec.priority ? (opts.priority || cfg.classPriority[kind] || 'medium') : undefined;
  if (priority && !cfg.priorities.includes(priority)) {
    throw new Error(`t ${kind}: unknown priority '${priority}' (config.priorities: ${cfg.priorities.join(', ')})`);
  }
  if (kind === 'question' && opts.answerableBy && !ANSWERERS.includes(opts.answerableBy)) {
    throw new Error(`t question: --answerable-by is one of: ${ANSWERERS.join(', ')}`);
  }
  return { spec, priority };
}

export function createItem(root, kind, title, opts = {}) {
  const { spec, priority } = validate(root, kind, title, opts);
  const id = reserveNextId(root, spec.store);
  const aiDir = join(root, '.ai');
  const text = String(opts.body ?? '').trim() || title.trim();
  const rel = writeFromTemplate({ aiDir, store: spec.store, id, priority, title: title.trim(), links: opts.links || [], text });
  const path = join(aiDir, rel);
  let doc = readFileSync(path, 'utf8').replace(HISTORY_PLACEHOLDER, `[${stamp()}]`);
  if (kind === 'question' && opts.answerableBy) doc = doc.replace(/^answerable_by:.*$/m, `answerable_by: ${opts.answerableBy}`);
  writeFileSync(path, doc);
  return { id, path };
}
