// The dispatch difficulty loop (KIT-T1414, KIT-D170): the rubric and its tiers, the split rule, `dispatch-ladder resolve
// --difficulty`, the dispatch-difficulty guard (enforced only in sessions that began after it took effect), the predicted tier
// on the roster and the outcome row, and the calibration report that names rows for the weekly reassessment.
// Run: node --test scripts/difficulty.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXAMPLE_TAG, assessedFamily, parseDifficulty, splitReason, tierOfSum } from '../hooks/lib/difficulty.mjs';
import { ENFORCED_SINCE, difficultyCheck } from '../hooks/dispatch-difficulty.mjs';
import { resolveJob } from './dispatch-ladder.mjs';
import { outcomeRow } from '../hooks/lib/dispatch-ledger.mjs';
import { calibrate, calibrationLines } from './difficulty-calibration.mjs';
import { makeRepo, runRaw } from '../hooks/dispatch-guard-harness.mjs';

const OPUS_TAG = '[difficulty: very-hard; systems=4 root=unknown proof=mixed ref=partial coupling=shared context=m]';

test('the rubric: each field 0-2, the sum names the tier, the tier names the family', () => {
  assert.deepEqual([0, 1, 2, 5, 6, 8, 9, 12].map(tierOfSum), ['automation', 'automation', 'medium', 'medium', 'very-hard', 'very-hard', 'extreme', 'extreme']);
  const a = parseDifficulty(`brief ${OPUS_TAG}`);
  assert.equal(a.sum, 8);
  assert.equal(a.family, 'opus');
  assert.deepEqual(a.problems, []);
  assert.equal(parseDifficulty(EXAMPLE_TAG).problems.length, 0, 'the printed example tag holds together');
  assert.match(parseDifficulty('[difficulty: medium; systems=4 root=unknown proof=judgement ref=no coupling=global context=l]').problems.join(), /sum to 12, which is extreme, not medium/);
  assert.match(parseDifficulty('[difficulty: medium; systems=1]').problems.join(), /root= is missing/);
  assert.equal(parseDifficulty('no tag here'), null);
  assert.equal(assessedFamily(OPUS_TAG), 'opus');
});

test('split rule: four or more systems with a large context, or two listed concerns', () => {
  assert.match(splitReason(parseDifficulty('[difficulty: extreme; systems=5 root=unknown proof=mixed ref=no coupling=shared context=l]')), /four or more systems/);
  assert.match(splitReason(parseDifficulty(EXAMPLE_TAG), 'Concerns:\n- the roofs\n- the window frames\n'), /2 independent concerns/);
  assert.equal(splitReason(parseDifficulty(EXAMPLE_TAG), 'one concern only'), '', 'negative control');
});

test('resolve: the assessment decides the family, the job row only the work', () => {
  const assessed = resolveJob({ job: 'fix', difficulty: OPUS_TAG.slice(1, -1).replace(/^difficulty:\s*/, '') });
  assert.equal(assessed.family, 'opus');
  assert.equal(assessed.assessed.tier, 'very-hard');
  assert.equal(resolveJob({ job: 'fix' }).family, 'sonnet', 'no assessment: the row is the fallback');
  assert.throws(() => resolveJob({ job: 'fix', difficulty: 'medium; systems=4 root=unknown proof=mixed ref=partial coupling=shared context=m' }), /does not hold together/);
});

function transcriptAt(dir, iso) {
  const file = join(dir, 'session.jsonl');
  writeFileSync(file, `${JSON.stringify({ type: 'user', timestamp: iso, message: { role: 'user', content: 'go' } })}\n`);
  return file;
}

test('the guard refuses in a session that began after it took effect, with a ready-to-paste tag, and only warns in an older one', () => {
  const root = makeRepo();
  const input = { subagent_type: 'claude-kit:implementer', model: 'sonnet', prompt: 'build the roofs [job: fix]' };
  const fresh = transcriptAt(root, new Date(ENFORCED_SINCE + 60000).toISOString());
  const now = ENFORCED_SINCE + 120000;
  const refused = difficultyCheck({ root, input, prompt: input.prompt, transcriptPath: fresh, footer: 'F', now });
  assert.match(refused.block, /^BLOCKED: this delegation carries no difficulty assessment/);
  assert.ok(refused.block.includes(`Ready to paste into the prompt (adjust each field to this job): ${EXAMPLE_TAG}`));
  assert.match(refused.block, /systems=N/);
  const old = transcriptAt(join(root, '.ai'), new Date(ENFORCED_SINCE - 60000).toISOString());
  const warned = difficultyCheck({ root, input, prompt: input.prompt, transcriptPath: old, footer: 'F', now });
  assert.equal(warned.block, '');
  assert.match(warned.warn, /not enforced in this session/);
  const wrongModel = { ...input, prompt: `build the roofs [job: fix] ${OPUS_TAG}` };
  assert.match(difficultyCheck({ root, input: wrongModel, prompt: wrongModel.prompt, transcriptPath: fresh, footer: 'F', now }).block, /model "sonnet" is not the family its very-hard assessment gives \(opus\)/);
  const right = { ...wrongModel, model: 'opus' };
  assert.equal(difficultyCheck({ root, input: right, prompt: right.prompt, transcriptPath: fresh, footer: 'F', now }).block, '', 'the assessed family passes');
  const override = `${wrongModel.prompt} [model-override: owner asked for sonnet]`;
  assert.equal(difficultyCheck({ root, input: { ...wrongModel, prompt: override }, prompt: override, transcriptPath: fresh, footer: 'F', now }).block, '');
  assert.equal(difficultyCheck({ root, input, prompt: input.prompt, footer: 'F', now }).block, '', 'no transcript start: never refused');
});

test('through the dispatch gate: an opus dispatch on a sonnet job row passes with an opus assessment', () => {
  const root = makeRepo();
  const tag = OPUS_TAG;
  const r = runRaw(root, JSON.stringify({ tool_name: 'Agent', tool_input: { subagent_type: 'claude-kit:implementer', model: 'opus', description: '[Opus 5.5] roofs', prompt: `build the roofs [job: fix] ${tag}` } }));
  assert.doesNotMatch(r.err, /differs from the capability table|dispatch-difficulty/, r.err.slice(0, 600));
});

test('the outcome row carries the prediction; calibration names re-date candidates and rows to review', () => {
  const row = outcomeRow({ id: 'a1', rosterRow: { job: 'fix', model: 'opus', difficulty: { tier: 'very-hard', sum: 8, family: 'opus' }, tickets: ['RDG-T1'] }, outcome: { tokens: 100 } });
  assert.deepEqual(row.predicted, { tier: 'very-hard', sum: 8, family: 'opus' });
  assert.deepEqual(row.tickets, ['RDG-T1']);
  const medium = { tier: 'medium', sum: 4, family: 'sonnet' };
  const hard = { tier: 'very-hard', sum: 7, family: 'opus' };
  const at = (n) => `2026-11-18T10:0${n}:00Z`;
  const outcomes = [
    { ts: at(1), id: 's1', job: 'fix', model: 'sonnet', outcome: 'completed', tokens: 200, predicted: medium, tickets: ['T1'] },
    { ts: at(2), id: 's2', job: 'fix', model: 'sonnet', outcome: 'completed', tokens: 200, predicted: medium, tickets: ['T2'] },
    { ts: at(3), id: 's3', job: 'fix', model: 'sonnet', outcome: 'completed', tokens: 200, predicted: medium, tickets: ['T3'] },
    { ts: at(4), id: 's4', job: 'fix', model: 'sonnet', outcome: 'completed', tokens: 200, predicted: medium, tickets: ['T4'] },
    { ts: at(5), id: 'o1', job: 'fix', model: 'opus', outcome: 'completed', tokens: 500, predicted: medium, tickets: ['T4'] },
    { ts: at(6), id: 'b1', job: 'build', model: 'opus', outcome: 'completed', tokens: 400, predicted: hard },
    { ts: at(7), id: 'b2', job: 'build', model: 'opus', outcome: 'completed', tokens: 400, predicted: hard },
  ];
  const result = calibrate({ outcomes, ladderJobs: { fix: { family: 'sonnet' }, build: { family: 'sonnet' } }, handoffIds: new Set(['s2']) });
  const mediumTier = result.tiers.find((t) => t.tier === 'medium');
  assert.equal(mediumTier.dispatches, 5);
  assert.equal(mediumTier.escalated, 1, 's4 was followed on its ticket by an opus dispatch');
  assert.equal(mediumTier.otherFamily, 1, 'o1 was assessed medium but finished on opus');
  assert.equal(mediumTier.handoffs, 1);
  assert.deepEqual(result.redate, ['fix'], 'three or more landings on the row family');
  assert.deepEqual(result.review, [{ job: 'build', row: 'sonnet', assessed: 'opus', of: '2 of 2' }]);
  const text = calibrationLines(result).join('\n');
  assert.match(text, /re-date candidates for the weekly reassessment .*: fix/);
  assert.match(text, /review row build: table sonnet, assessed opus on 2 of 2/);
});
