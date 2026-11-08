// decision-gate (KIT-T744, KIT-T907, KIT-D151): a questionnaire that repeats a whole decision title is blocked with the
// decision's text, every time; one that only shares words with decisions passes with them listed as advisory context;
// superseded and excluded decisions never appear. The two real groovegrid questionnaires that were blocked
// once each are replayed against their real decision titles.
// Run: node hooks/decision-gate.test.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, cleanup, hook, project, reporter } from './test-harness.mjs';

const { ok, done } = reporter('decision-gate');

const DECISION = (id, title, decided, extra = '') => `---\nid: ${id}\ntitle: ${title}\nsummary: \ndate: 2026-10-30\nsupersedes: \nsource: \n${extra}---\n\n**Decision:** ${decided}\n`;
const option = (label, description = '') => ({ label, description });
const advisory = (out) => (out.trim().startsWith('{') ? JSON.parse(out).hookSpecificOutput?.additionalContext || '' : '');

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('decision-gate'))));

  const d = project('required', 'FQD');
  const dir = join(d, '.ai', 'decisions');
  mkdirSync(dir, { recursive: true });
  const decide = (file, id, title, decided, extra) => writeFileSync(join(dir, file), DECISION(id, title, decided, extra));
  decide('FQD-D071-vehicle-feel.md', 'FQD-D071', 'Vehicle feel sits closest to GTA with a real gearbox', 'Vehicle feel follows GTA; gears live in the vehicle model.');
  decide('FQD-D072-old-camera.md', 'FQD-D072', 'Camera orbit distance follows the chase target', 'Orbit at fixed distance.', 'status: superseded\n');
  decide('GG-D051-shift.md', 'GG-D051', 'Shift+click is a range select everywhere in the app', 'Shift+click selects the range from the anchor item to the clicked item.');
  decide('GG-D048-song-layout.md', 'GG-D048', 'Song mode layout - collapse persists in project state; lanes reuse automation components', 'Collapse state is saved with the project.');
  decide('GG-D047-song-automation.md', 'GG-D047', 'Song mode: everything above the tracks is editable automation, the track lanes below are a read-only representation', 'Everything above the tracks is the editable automation.');

  const ask = (questions) => hook('decision-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: { questions } }, d);
  const one = (question, header, ...options) => ask([{ question, header, options }]);

  const restating = 'Vehicle feel sits closest to GTA with a real gearbox: keep it?';
  const first = one(restating, 'Feel', option('Keep'), option('Change'));
  ok('a question repeating a whole decision title is blocked', first.code === 2);
  ok('the block carries the decision id, title and Decision paragraph', /FQD-D071/.test(first.out) && /Vehicle feel sits closest/.test(first.out) && /follows GTA/.test(first.out));
  ok('the block names the check id and both exclusion surfaces', first.out.includes('decision-gate') && first.out.includes('.claude-kit-ignore.yaml'));
  ok('the identical question is blocked again: no resend passes', one(restating, 'Feel', option('Keep'), option('Change')).code === 2);
  ok('a header carrying the title counts with the question', one('Keep it?', 'Vehicle feel sits closest to GTA with a real gearbox', option('Yes'), option('No')).code === 2);

  const vehicle = 'How should the wheelie hold behave for vehicle feel: stick sets height or real balance?';
  const related = one(vehicle, 'Feel', option('(Recommended) Stick sets height'), option('Real balance'));
  ok('a question sharing only some title words passes', related.code === 0);
  ok('and lists the related decision as advisory context, with its Decision text', advisory(related.out).includes('FQD-D071') && advisory(related.out).includes('follows GTA'));

  ok('negative: an unrelated questionnaire passes with no advisory', (() => { const r = one('Which colour for the stereo mixer faders on the settings page?', 'Colour', option('Red'), option('Blue')); return r.code === 0 && r.out.trim() === ''; })());
  ok('negative: a superseded decision neither blocks nor appears', (() => { const r = one('Should camera orbit distance follow the chase target at fixed distance?', 'Camera', option('Yes'), option('No')); return r.code === 0 && !r.out.includes('FQD-D072'); })());

  const shiftAndAudit = ask([
    { question: 'Should Shift+click replace the selection with the range, or add the block to it?', header: 'Shift mode', options: [option('(Recommended) Replace the selection with the range', 'Shift behaves like every other surface and a smaller second range shrinks the selection.'), option('Add the block to the selection', 'Keeps today\'s build, where Shift never clears. Differs from the rest of the app and from GG-D051.')] },
    { question: 'Do you want the other surfaces audited and moved onto the shared range primitive?', header: 'Audit', options: [option('(Recommended) Audit and converge the other surfaces', 'One writer moves scene grid, track list, module strip, mod matrix and slot panel onto the primitive.'), option('Leave the other surfaces alone for now', 'They stay as they are, which does not match GG-D051 everywhere.')] },
  ]);
  ok('replay: the real Shift+click and audit questionnaire passes without a block', shiftAndAudit.code === 0);
  ok('replay: GG-D051 is listed as advisory context', advisory(shiftAndAudit.out).includes('GG-D051'));
  ok('replay: no BLOCKED text and no resend instruction anywhere in the output', !shiftAndAudit.out.includes('BLOCKED') && !shiftAndAudit.out.includes('again unchanged'));

  const gateFix = one('How do we handle the same-reply brief the gate cannot read on the first call?', 'Gate fix',
    option('(Recommended) Brief, one cheap call, then questionnaire', 'No gate change and no block.'), option('Keep the block with an accurate message', 'Every questionnaire\'s first call is blocked once.'),
    option('Warn instead of block', 'The brief is audited afterwards; everything above the tracks stays as it is.'));
  ok('replay: the real gate-fix questionnaire passes', gateFix.code === 0);

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'decision-gate:\n  - .ai/decisions/FQD-D071*\n');
  const excluded = one(restating, 'Feel', option('Keep'), option('Change'));
  ok('negative: a decision excluded under decision-gate neither blocks nor appears', excluded.code === 0 && !excluded.out.includes('FQD-D071'));
} finally {
  cleanup();
}

done();
