// rulings-checked — a dispatch check for dispatch-guard (KIT-T938). A design or plan brief goes out only after the
// dispatcher searched the inbox for maintainer rulings: notes captured and never promoted were designed against once.
//
//   rulingsBlock({ root, input, prompt, footer }) -> block message | null (check `rulings-checked`)
//   isDesignDispatch(root, input, prompt)         -> job `plan`, or an analytical agent briefed with design words
//
// Silent while the inbox holds no un-triaged note. Read-only agents are asked too: planners are read-only.
// Escape: `[rulings-checked: <what was searched or read> | none apply: <why>]`.

import { dispatchJob } from './dispatch-job.mjs';
import { pendingNotes, unpromotedRulings } from './lib/inbox-rulings.mjs';
import { planBlock } from './lib/ruling-messages.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const RULINGS_CHECK = 'rulings-checked';
const TOKEN = TOKENS.rulingsChecked.pattern;
const PLAN_JOB = 'plan';
const ANALYTICAL_TYPES = new Set(['plan', 'analyst', 'analyst-max', 'researcher', 'explore']);
const DESIGN = /\b(?:design(?:s|ing)?|architect(?:ure|ural)?|master plan|plan(?:ning)? (?:the|a|for)|propos(?:e|al|als)|blueprint|data model|storage model|spec(?:ification)?)\b/i;

const typeName = (input) => String(input.subagent_type || input.agent_type || '').split(':').pop().trim().toLowerCase();

export function isDesignDispatch(root, input, prompt) {
  if (dispatchJob(root, input) === PLAN_JOB) return true;
  return ANALYTICAL_TYPES.has(typeName(input)) && DESIGN.test(`${prompt}\n${input.description || ''}`);
}

export function rulingsBlock({ root, input, prompt, footer }) {
  if (!isDesignDispatch(root, input, prompt)) return null;
  const pending = pendingNotes(root).length;
  if (!pending || TOKEN.test(String(prompt))) return null;
  return [planBlock(unpromotedRulings(root), { agent: String(input.subagent_type || input.agent_type || ''), pending }), '', footer].join('\n');
}
