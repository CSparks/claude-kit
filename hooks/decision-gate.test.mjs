// decision-gate (KIT-T744): a questionnaire sharing its words with an in-force decision is blocked once with the
// decision's text; the same questionnaire sent again, an unrelated one, a superseded decision, and an excluded
// check pass.
// Run: node hooks/decision-gate.test.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, cleanup, hook, project, reporter } from './test-harness.mjs';

const { ok, done } = reporter('decision-gate');

const DECISION = (id, title, decided, extra = '') => `---\nid: ${id}\ntitle: ${title}\nsummary: \ndate: 2026-10-30\nsupersedes: \nsource: \n${extra}---\n\n**Decision:** ${decided}\n`;

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('decision-gate'))));

  const d = project('required', 'FQD');
  const dir = join(d, '.ai', 'decisions');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'FQD-D071-vehicle-feel.md'), DECISION('FQD-D071', 'Vehicle feel sits closest to GTA with a real gearbox', 'Vehicle feel follows GTA; gears live in the vehicle model.'));
  writeFileSync(join(dir, 'FQD-D072-old-camera.md'), DECISION('FQD-D072', 'Camera orbit distance follows the chase target', 'Orbit at fixed distance.', 'status: superseded\n'));

  const ask = (question, header = 'Feel') => hook('decision-gate.mjs', {
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question, header, options: [{ label: '(Recommended) Stick sets height' }, { label: 'Real balance' }] }] },
  }, d);

  const vehicle = 'How should the wheelie hold behave for vehicle feel: stick sets height or real balance?';
  const first = ask(vehicle);
  ok('a questionnaire sharing the decision title words is blocked', first.code === 2);
  ok('the block carries the decision id, title and Decision paragraph', /FQD-D071/.test(first.out) && /Vehicle feel sits closest/.test(first.out) && /follows GTA/.test(first.out));
  ok('the block names the check id and both exclusion surfaces', first.out.includes('decision-gate') && first.out.includes('.claude-kit-ignore.yaml'));
  ok('the same questionnaire sent again passes', ask(vehicle).code === 0);
  ok('a changed questionnaire on the same decision blocks again', ask(`${vehicle} Also the dust.`).code === 2);
  ok('negative: an unrelated questionnaire passes', ask('Which colour for the stereo mixer faders on the settings page?', 'Colour').code === 0);
  ok('negative: a superseded decision never blocks', ask('Should camera orbit distance follow the chase target at fixed distance?', 'Camera').code === 0);

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'decision-gate:\n  - .ai/decisions/FQD-D071*\n');
  ok('negative: a decision excluded under decision-gate no longer blocks', ask(`${vehicle} Third form.`).code === 0);
} finally {
  cleanup();
}

done();
