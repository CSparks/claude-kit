// dispatch-difficulty.mjs — the dispatch-difficulty check of the dispatch gate (KIT-T1414, KIT-D170, KIT-D169). Every
// delegation carries a difficulty assessment (lib/difficulty.mjs); its tier decides the family, not the agent definition.
//
//   difficultyCheck({ root, input, prompt, transcriptPath, footer, now? }) -> { block, warn }  (either may be '')
//     a brief with no tag, a tag that does not hold together, a brief that must be split, or a model off the tier's family
//     (without [model-override: <reason>]) is refused; the refusal prints the rubric and a ready-to-paste example tag.
//     A session that started before the check took effect (ENFORCED_SINCE), or whose transcript start cannot be read, only
//     gets the same text as a warning, so running sessions keep dispatching until they restart.
//   DIFFICULTY_CHECK  the check id

import { closeSync, openSync, readSync } from 'node:fs';
import { familyOf } from '../scripts/dispatch-outcomes.mjs';
import { readLadder } from '../scripts/dispatch-ladder.mjs';
import { dispatchJob, modelOverride } from './dispatch-job.mjs';
import { EXAMPLE_TAG, FAMILY_OF_TIER, RUBRIC_LINES, parseDifficulty, splitReason } from './lib/difficulty.mjs';

export const DIFFICULTY_CHECK = 'dispatch-difficulty';
// Sessions whose transcript starts before this instant were running when the check was published: they are warned only.
export const ENFORCED_SINCE = Date.parse(process.env.CLAUDE_KIT_DIFFICULTY_SINCE || '2026-11-19T01:30:00Z');
const HEAD_BYTES = 64 * 1024;

// The first timestamp in the session transcript: read from its head only (a transcript can run to hundreds of megabytes).
function sessionStartMs(transcriptPath) {
  let fd;
  try {
    fd = openSync(transcriptPath, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const head = buf.toString('utf8', 0, readSync(fd, buf, 0, HEAD_BYTES, 0));
    const stamp = (/"timestamp"\s*:\s*"([^"]+)"/.exec(head) || [])[1];
    return stamp ? Date.parse(stamp) : NaN;
  } catch {
    return NaN;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function fallbackLine(root, input) {
  const job = dispatchJob(root, input);
  const row = readLadder().jobs[job];
  return row ? `  Without an assessment the agent definition's default would have given job ${job} -> ${row.family}: a fallback suggestion only (KIT-D170).` : '';
}

function problemsOf({ input, prompt }) {
  const assessment = parseDifficulty(prompt) || parseDifficulty(input.description);
  if (!assessment) return { why: 'this delegation carries no difficulty assessment', assessment };
  if (assessment.problems.length) return { why: `its difficulty tag does not hold together: ${assessment.problems.join('; ')}`, assessment };
  const split = splitReason(assessment, prompt);
  if (split) return { why: `the brief must be split into one dispatch per concern: ${split}`, assessment };
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (model && familyOf(model) !== assessment.family && !modelOverride(prompt)) {
    return { why: `model "${model}" is not the family its ${assessment.tier} assessment gives (${assessment.family})`, assessment };
  }
  return { why: '', assessment };
}

export function difficultyCheck({ root, input, prompt, transcriptPath = '', footer, now = Date.now() }) {
  const { why, assessment } = problemsOf({ input, prompt });
  if (!why) return { block: '', warn: '' };
  const tierLine = assessment && assessment.impliedTier ? `  The scores sum to ${assessment.sum}: ${assessment.impliedTier} -> ${FAMILY_OF_TIER[assessment.impliedTier]}.` : '';
  const text = [
    `${why} (KIT-T1414, KIT-D170): the family of a dispatch follows the assessed difficulty of the job, never the agent definition.`,
    tierLine,
    fallbackLine(root, input),
    '',
    ...RUBRIC_LINES,
    '',
    `Ready to paste into the prompt (adjust each field to this job): ${EXAMPLE_TAG}`,
    'A deliberate exception to the family: add [model-override: <reason>].',
  ].filter(Boolean).join('\n');
  const started = transcriptPath ? sessionStartMs(transcriptPath) : NaN;
  const enforced = Number.isFinite(started) && started >= ENFORCED_SINCE && now >= ENFORCED_SINCE;
  return enforced ? { block: `BLOCKED: ${text}\n\n${footer}`, warn: '' } : { block: '', warn: `NOTE (not enforced in this session; it starts refusing after a restart): ${text}` };
}
