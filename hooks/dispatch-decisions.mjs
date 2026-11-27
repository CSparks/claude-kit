// brief-decisions — a check for dispatch-guard (KIT-T1458). A plan, design, analyst-max or perf brief, and any brief that
// touches a kit gate (KIT-T1607), goes out only after it names the recorded decisions it centres on (lib/brief-grounding.mjs:
// the project's store and its framework's).
//
//   decisionsBlock({ root, input, prompt, footer }) -> block message | null (check `brief-decisions`)
//   isGroundedDispatch(root, input, prompt)          -> a plan or design dispatch, an analyst-max or perf-tuner agent, or a gate brief
//   touchesGate(prompt)                              -> the brief names a path under hooks/, a [paths: hooks] tag, or a ticket on a named gate
//
// Escape: name the decision ids, in the brief or in a `[rulings-checked: ...]` tag; "none apply" clears no decision it does
// not name. Fails open on a store error.

import { isDesignDispatch, typeName } from './dispatch-rulings.mjs';
import { briefDecisionMisses } from './lib/brief-grounding.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const DECISIONS_CHECK = 'brief-decisions';
const ALWAYS_GROUNDED_TYPES = new Set(['analyst-max', 'perf-tuner']);
const MAX_TITLE_SHOWN = 100;

// A brief that touches a kit gate, whatever its job (KIT-T1607): a path under hooks/, a [paths: ...] tag naming hooks, or a
// ticket id beside a hyphenated gate name (source-shell-gate, dispatch-guard). Gate fixes are where a ruling that reverted
// gate changes binds, and a fix brief otherwise goes out unmatched.
const HOOKS_PATH = /\bhooks[\\/]/i;
const HOOKS_TAG = /\[paths:[^\]]*\bhooks\b/i;
const TICKET = /\b[A-Z]+-T\d+\b/;
const GATE_NAME = /\b[a-z][\w-]*-(?:gate|guard)\b/i;
export const touchesGate = (prompt) => {
  const text = String(prompt ?? '');
  return HOOKS_PATH.test(text) || HOOKS_TAG.test(text) || (TICKET.test(text) && GATE_NAME.test(text));
};

export const isGroundedDispatch = (root, input, prompt) => ALWAYS_GROUNDED_TYPES.has(typeName(input)) || isDesignDispatch(root, input, prompt) || touchesGate(prompt);

const line = (m) => `  ${m.id} (${m.source}) "${m.title.slice(0, MAX_TITLE_SHOWN)}" — ${m.stems.length} words of its title are central to the brief (${m.stems.join(', ')})`;

export function decisionsBlock({ root, input, prompt, footer }) {
  if (!isGroundedDispatch(root, input, prompt)) return null;
  const misses = briefDecisionMisses(root, prompt);
  if (!misses.length) return null;
  const first = misses[0];
  return [
    `BLOCKED: this brief overlaps ${misses.length} recorded decision(s) it never names (KIT-T1458).`,
    `  agent: ${String(input.subagent_type || input.agent_type || '(default)')}`,
    ...misses.map(line),
    '',
    'A brief that proposes work a decision already ruled designs it twice or against the ruling; naming a neighbouring decision is not reading this one.',
    'Read each (q show <id>), then name every one in the brief with what it is in plain words, and build on it:',
    `  "${first.title.slice(0, MAX_TITLE_SHOWN)} (${first.id})"`,
    `A ${TOKENS.rulingsChecked.form} tag clears a decision only by naming its id; "none apply" clears none it does not name.`,
    '',
    footer,
  ].join('\n');
}
