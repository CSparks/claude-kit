// Dispatch escalation gate (KIT-T432, KIT-D090). A dispatch's `[job: X]` may not outrank the job the
// work's ticket type routes to (.ai/config.yml dispatch.default_job) unless the prompt carries
// `[escalate: <reason>]`. The family compared is the dispatch's explicit model when it names one
// (an opus build on a bug ticket escalates), else the job row's family. A row marked
// `self_escalating: true` (plan) is itself the escalation and passes.
//
//   ticketTypes(roots, text)   -> ticket types of every ticket id the text names, found under roots
//   expectedJob(ladder, types, readOnly) -> { job, why } | null   the cheapest-defensible job to hold the dispatch to
//   escalationBlock({ root, input, prompt, readOnly, footer }) -> block message | null (check `dispatch-escalation`)
//
// Expected job: the dearest default among the named tickets (a brief naming a regression and a bug
// is held to the regression's). No ticket named: a read-only dispatch is held to `research`; a
// writer is not held. `forensic` additionally needs a `regression` ticket.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readLadder } from '../scripts/dispatch-ladder.mjs';
import { familyOf } from '../scripts/dispatch-outcomes.mjs';
import { dispatchJob } from './dispatch-job.mjs';
import { dispatchTargetRoot } from './dispatch-target.mjs';

export const ESCALATION_CHECK = 'dispatch-escalation';
const ESCALATE_TOKEN = /\[escalate:\s*([^\]\s][^\]]*)\]/i;
const TICKET_ID = /\b[A-Z][A-Z0-9]*-T\d{1,4}\b/g;
const COST_RANK = { haiku: 0, sonnet: 1, opus: 2, fable: 3 };
const REGRESSION_ONLY_JOB = 'forensic';
const NO_TICKET_READ_ONLY_JOB = 'research';

export function escalateReason(prompt) {
  const m = String(prompt || '').match(ESCALATE_TOKEN);
  return m ? m[1].trim() : '';
}

function ticketType(roots, id) {
  for (const root of roots) {
    for (const dir of [join(root, '.ai', 'tickets'), join(root, '.ai', 'tickets', 'archive')]) {
      if (!existsSync(dir)) continue;
      const file = readdirSync(dir).find((f) => f.startsWith(`${id}-`) || f === `${id}.md`);
      if (!file) continue;
      const head = readFileSync(join(dir, file), 'utf8').split(/^---\s*$/m)[1] || '';
      const m = head.match(/^type:[ \t]*([\w-]+)/m);
      return m ? m[1] : '*';
    }
  }
  return null;
}

export function ticketTypes(roots, text) {
  const types = [];
  for (const id of new Set(String(text || '').match(TICKET_ID) || [])) {
    const type = ticketType(roots, id);
    if (type) types.push(type);
  }
  return types;
}

const rank = (ladder, job) => COST_RANK[ladder.jobs[job]?.family] ?? -1;
const modelRank = (model) => COST_RANK[familyOf(model)] ?? -1;

export function expectedJob(ladder, types, readOnly) {
  if (!types.length) {
    return readOnly && ladder.jobs[NO_TICKET_READ_ONLY_JOB]
      ? { job: NO_TICKET_READ_ONLY_JOB, why: 'read-only diagnosis with no ticket named' }
      : null;
  }
  let best = null;
  for (const type of types) {
    const job = ladder.defaultJob[type] || ladder.defaultJob['*'];
    if (job && (!best || rank(ladder, job) > rank(ladder, best.job))) best = { job, why: `ticket type "${type}"` };
  }
  return best;
}

export function escalationBlock({ root, input, prompt, readOnly, footer }) {
  const job = dispatchJob(root, input);
  const ladder = readLadder();
  if (!ladder.jobs[job] || ladder.jobs[job].self_escalating === true || escalateReason(prompt)) return null;
  const text = `${prompt}\n${input.description || ''}`;
  const target = dispatchTargetRoot(root, input);
  const types = ticketTypes(target === root ? [root] : [target, root], text);
  const expected = expectedJob(ladder, types, readOnly);
  if (!expected) return null;

  const model = typeof input.model === 'string' ? input.model.trim() : '';
  const spend = Math.max(rank(ladder, job), model ? modelRank(model) : -1);
  const outranks = spend > rank(ladder, expected.job);
  const needsRegression = job === REGRESSION_ONLY_JOB && !types.includes('regression');
  if (!outranks && !needsRegression) return null;

  const cheaper = ladder.jobs[expected.job];
  const reason = needsRegression && !outranks
    ? `job "${job}" is the regression first pass, and no regression ticket is named`
    : `job "${job}" (${model ? familyOf(model) : ladder.jobs[job].family}) outranks "${expected.job}" (${cheaper.family}), the default for ${expected.why}`;
  return [
    `BLOCKED: dispatch escalates past the default job (KIT-T432). ${reason}.`,
    `  agent: ${String(input.subagent_type || input.agent_type || '(default)')}   table: .ai/config.yml dispatch.default_job`,
    '',
    'Sonnet 5.5 handles straightforward fixes, diagnosis and wiring. Opus design/forensic writes the plan and apply brief',
    '(file:line, exact change, test, acceptance); sonnet applies it. An opus build is the exception.',
    `Fix: dispatch [job: ${expected.job}] (${cheaper.family}).`,
    'A deliberate escalation: add [escalate: <reason>] to the prompt (a failed first pass, spatial work, a regression).',
    '',
    footer,
  ].join('\n');
}
