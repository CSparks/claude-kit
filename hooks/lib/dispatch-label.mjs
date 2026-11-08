// dispatch-label — what a delegation's call must carry so the roster row and the activity line name its model
// (KIT-T179, KIT-T337, KIT-T897). A requirement is a problem to fix on the call itself: nothing rewrites the input.
//
//   LABEL_REQUIREMENTS                  -> the requirement list `q gates agent` prints
//   labelProblems(root, input, p)       -> [{ part, wanted }] for a call that is not in the canonical form, [] when it is
//
// part `model`        a dispatch naming a job but no model passes the capability table's family for that job
// part `description` the description starts with the resolved model's tag: `[Sonnet 5.5] <text>`

import { readLadder } from '../../scripts/dispatch-ladder.mjs';
import { dispatchJob, jobFamilies } from '../dispatch-job.mjs';
import { modelDisplay, resolveDispatchModel, tagDescription } from '../model-tag.mjs';

export const LABEL_CHECK = 'dispatch-label';

export const LABEL_REQUIREMENTS = [
  { part: 'model', wants: "a dispatch with a job passes model:'<family>', the capability table's family for that job" },
  { part: 'description', wants: 'the description starts with the model tag, exactly `[<Family N.M>] <text>` (for example `[Sonnet 5.5] Fix the gate`); a hand-written or missing tag is not accepted' },
];

function tableFamily(root, input) {
  if (typeof input.model === 'string' && input.model.trim()) return '';
  const job = dispatchJob(root, input);
  const row = readLadder().jobs[job];
  return row ? jobFamilies(row)[0] || '' : '';
}

export function labelProblems(root, input, p) {
  const problems = [];
  const family = tableFamily(root, input);
  if (family) problems.push({ part: 'model', wanted: `pass model:'${family}', the capability table's family for job ${dispatchJob(root, input)}` });
  const description = input.description;
  if (typeof description !== 'string' || !description.trim()) return problems;
  const display = modelDisplay(family || resolveDispatchModel(root, input, p));
  const canonical = display ? tagDescription(description, display) : description;
  if (canonical !== description) problems.push({ part: 'description', wanted: `resend description as ${JSON.stringify(canonical)}` });
  return problems;
}
