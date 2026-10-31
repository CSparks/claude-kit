#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — a questionnaire that a standing decision already
// answers is stopped once, with the decision's own text, before it reaches the maintainer (KIT-T744).
// exit 2 = block, 0 = allow.
//
// The questionnaire's words are matched against the project's in-force decisions (decision-governs.mjs).
// A hit blocks that exact questionnaire once; sending it again unchanged passes, so a question the
// decision does not cover is never wedged. Check id: decision-gate. Fails open on any error.

import { createHash } from 'node:crypto';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { readTurnState, writeTurnState } from './lib/turn-state.mjs';
import { governingDecisions, readDecisions } from '../scripts/decision-governs.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const CHECK_ID = 'decision-gate';
const SLOT = 'decision-gate';

const textOf = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.map((o) => `${o?.label || ''} ${o?.description || ''}`) : [])].filter(Boolean).join(' ');

function blockMessage(hits) {
  return [
    'BLOCKED: a standing decision may already answer this questionnaire (KIT-T744).',
    ...hits.map((d) => `  ${d.id} — ${d.title}${d.hit ? `\n    ${d.hit}` : ''}`),
    'If one of these governs the question, act on it and do not ask.',
    'If the question is still open after reading them, send the same questionnaire again unchanged: it passes.',
    excludeFooter(CHECK_ID),
  ].join('\n');
}

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const root = gitRoot();
  if (!Array.isArray(questions) || !questions.length || !adopted(root)) process.exit(0);

  const text = questions.map(textOf).join(' ');
  const hits = governingDecisions(text, readDecisions(root).filter((d) => !pathExcluded(root, CHECK_ID, d.file)));
  if (!hits.length) process.exit(0);

  const hash = createHash('sha1').update(text).digest('hex');
  if (readTurnState(root, SLOT)?.hash === hash) process.exit(0);
  writeTurnState(root, { hash }, SLOT);
  process.stderr.write(blockMessage(hits));
  process.exit(2);
} catch {
  /* fail open */
}
process.exit(0);
