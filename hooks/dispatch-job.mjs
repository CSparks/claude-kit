// Job-typed dispatch (KIT-T419, KIT-D080). Every delegation names the job it serves; the kit
// capability table (.ai/config.yml dispatch.jobs) says which family runs it.
//
//   dispatchJob(root, input)        -> job id from `[job: x]` in the prompt or description, else the
//                                      agent definition's `job:` default, else ''
//   modelOverride(prompt)           -> the reason in `[model-override: <reason>]`, or ''
//   jobFamilies(jobRow)             -> the Claude families the row allows: its family, then its fallback
//   jobBlock({ root, input, prompt, footer }) -> block message | null (dispatch-guard check `dispatch-job`)
//
// A dispatch with no job, an unknown job, or an explicit model outside the row's families is
// blocked. An explicit model passes with `[model-override: <reason>]`; a dispatch naming no model
// takes the row's family (activity-tag fills it in).

import { readLadder } from '../scripts/dispatch-ladder.mjs';
import { familyOf } from '../scripts/dispatch-outcomes.mjs';
import { definitionJob } from './model-tag.mjs';
import { declaredJob } from './agent-outcome.mjs';

export const JOB_CHECK = 'dispatch-job';
const OVERRIDE_TOKEN = /\[model-override:\s*([^\]\s][^\]]*)\]/i;
const CLAUDE_FAMILIES = new Set(['fable', 'opus', 'sonnet', 'haiku']);

export function dispatchJob(root, input = {}) {
  const declared = declaredJob(input.prompt) || declaredJob(input.message) || declaredJob(input.description);
  return declared || definitionJob(root, input.subagent_type || input.agent_type);
}

export function modelOverride(prompt) {
  const m = String(prompt || '').match(OVERRIDE_TOKEN);
  return m ? m[1].trim() : '';
}

export const jobFamilies = (row) => [row.family, row.fallback].filter((f) => CLAUDE_FAMILIES.has(f));

export function jobBlock({ root, input, prompt, footer }) {
  const { jobs } = readLadder();
  const ids = Object.keys(jobs);
  const agent = String(input.subagent_type || input.agent_type || '(default)');
  const job = dispatchJob(root, input);
  if (!jobs[job]) {
    return [
      `BLOCKED: this delegation names ${job ? `unknown job "${job}"` : 'no job'} (KIT-T419).`,
      `  agent: ${agent}`,
      '',
      'The capability table routes by job type; a dispatch with no job is free-hand routing.',
      `Job ids: ${ids.join(', ')}.`,
      'Fix: add [job: <id>] to the prompt or description (an agent definition may carry a default job:).',
      `Resolve the family: node scripts/dispatch-ladder.mjs resolve --job <id>`,
      '',
      footer,
    ].join('\n');
  }
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (!model) return null;
  const row = jobs[job];
  const allowed = jobFamilies(row);
  if (allowed.includes(familyOf(model)) || modelOverride(prompt)) return null;
  return [
    `BLOCKED: model "${model}" differs from the capability table for job "${job}" (KIT-T419).`,
    `  agent: ${agent}   table row: ${job} -> ${allowed.join(' (fallback ') + (allowed.length > 1 ? ')' : '')}  evidence ${row.evidence}  (${row.source})`,
    '',
    'Fix: dispatch the table family, or omit model and let the job decide.',
    'A deliberate exception: add [model-override: <reason>] to the prompt; the reason is logged on the roster row.',
    '',
    footer,
  ].join('\n');
}
