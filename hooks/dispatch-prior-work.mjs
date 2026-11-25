// prior-work-checked — a dispatch check for dispatch-guard (KIT-T1553). A build or fix brief goes out only after the dispatcher
// read the earlier work left in the paths it touches: untracked source files and stashes. An agent that never opened them
// built the same rule a second time beside an untracked file that already held it.
//
//   priorWorkBlock({ root, input, prompt, footer }) -> block message | null (check `prior-work-checked`)
//
// Silent for a read-only brief, a job that writes no code, and a checkout with no untracked source file or stash under the
// brief's [paths:] (every path when it declares none). Escape: `[prior-work-checked: <what was read>]`.

import { dispatchTargetRoot } from './dispatch-target.mjs';
import { dispatchJob } from './dispatch-job.mjs';
import { readOnlyDispatch } from './dispatch-readonly.mjs';
import { workerPaths } from './dispatch-worker.mjs';
import { priorWork, priorWorkLines } from './lib/prior-work.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

export const PRIOR_WORK_CHECK = 'prior-work-checked';
const TOKEN = TOKENS.priorWorkChecked.pattern;
const WRITING_JOBS = new Set(['build', 'fix', 'refactor', 'targeted-change', 'wiring', 'greenfield']);

const agentOf = (input) => String(input.subagent_type || input.agent_type || input.task_name || '').trim() || '(default)';

export function priorWorkBlock({ root, input, prompt, footer }) {
  const brief = String(prompt || '');
  if (TOKEN.test(brief) || !WRITING_JOBS.has(dispatchJob(root, input))) return null;
  if (readOnlyDispatch(root, agentOf(input), brief)) return null;
  const tree = dispatchTargetRoot(root, input);
  const found = priorWork(tree, { paths: workerPaths(brief, tree) });
  if (!found.untracked.length && !found.stashes.length) return null;
  return [
    'BLOCKED: this build or fix brief names no prior-work check, and earlier uncommitted work sits in the paths it touches (KIT-T1553).',
    `  agent: ${agentOf(input)}   tree: ${tree}`,
    ...priorWorkLines(found),
    '',
    'An untracked file is earlier work, possibly a switched-off feature, not another writer\'s to leave alone: an agent that never opened one built the same rule twice.',
    'Read each stash (git stash show -p) and untracked file, decide use, merge or report, and tell the agent which one holds what it needs.',
    `Fix: add ${TOKENS.priorWorkChecked.form} to the brief.`,
    '',
    footer,
  ].join('\n');
}
