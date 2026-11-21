// brief-decisions — a check for dispatch-guard (KIT-T1458). A plan, design, analyst-max or perf brief goes out only
// after it names the recorded decisions it overlaps most (lib/brief-grounding.mjs: the project's store and its framework's).
//
//   decisionsBlock({ root, input, prompt, footer }) -> block message | null (check `brief-decisions`)
//   isGroundedDispatch(root, input, prompt)          -> a plan or design dispatch, or an analyst-max or perf-tuner agent
//
// Escape: name the decision ids, in the brief or in a `[rulings-checked: ...]` tag; "none apply" clears no decision it does
// not name. Fails open on a store error.

import { isDesignDispatch, typeName } from './dispatch-rulings.mjs';
import { briefDecisionMisses } from './lib/brief-grounding.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const DECISIONS_CHECK = 'brief-decisions';
const ALWAYS_GROUNDED_TYPES = new Set(['analyst-max', 'perf-tuner']);
const MAX_TITLE_SHOWN = 100;
const PERCENT = 100;

export const isGroundedDispatch = (root, input, prompt) => ALWAYS_GROUNDED_TYPES.has(typeName(input)) || isDesignDispatch(root, input, prompt);

const line = (m) => `  ${m.id} (${m.source}) "${m.title.slice(0, MAX_TITLE_SHOWN)}" — the brief covers ${Math.round(m.coverage * PERCENT)}% of its words (${m.stems.join(', ')})`;

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
