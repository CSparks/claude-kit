// question-grounded-gate (KIT-T936): an option that matches a recorded decision or open ticket the questionnaire never
// cites blocks; citing each by id passes; routine and unrelated options, closed tickets, the escape tag, the ignore
// file, a store error and garbage stdin pass.
// Run: node hooks/question-grounded-gate.test.mjs

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, HOOKS, ROOT, adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { optionStems } from './lib/question-grounding.mjs';

const { ok, done } = reporter('question-grounded-gate');
const GATE = 'question-grounded-gate.mjs';
const DECISION = 'DE-D077';
const TICKET = 'DE-T285';

const file = (id, title, extra, body) => `---\nid: ${id}\ntitle: ${title}\n${extra}---\n${body}\n`;

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes(GATE))));
  ok('stems: suffixes cut, stopwords and short words dropped', [...optionStems('Share meshes across the cells')].sort().join() === 'cell,mesh,shar'
    && optionStems('Yes').size === 0 && optionStems('Defer').size === 0);

  const d = adopted(false);
  const dir = (name) => { mkdirSync(join(d, '.ai', name), { recursive: true }); return join(d, '.ai', name); };
  writeFileSync(join(dir('decisions'), `${DECISION}-foliage-and-rocks.md`), file(DECISION, 'Foliage and rocks are framework crates shared with Stiletto', 'date: 2026-11-02\n',
    '**Decision:** foliage and rock meshes are built once in rapid-game and shared by every cell and every game.'));
  writeFileSync(join(dir('tickets'), `${TICKET}-share-mesh-reuse.md`), file(TICKET, 'Share one mesh per flora kind across cells', 'type: feature\nstatus: todo\n',
    'Build the shared mesh reuse the decision asked for.'));
  writeFileSync(join(dir('tickets'), 'DE-T100-old-mesh-sharing.md'), file('DE-T100', 'Shared mesh cells prototype', 'type: feature\nstatus: done\n', 'old'));
  writeFileSync(join(dir('tickets'), 'DE-T101-radar.md'), file('DE-T101', 'Radar badge sizing', 'type: bug\nstatus: todo\n', 'badges'));

  const SHARE = [{ label: '(Recommended) Share meshes across cells', description: 'one mesh per flora kind' }, { label: 'Keep per-cell meshes', description: 'status quo' }];
  const ask = (options, question = 'How should flora geometry be built?', header = 'Flora') =>
    hook(GATE, { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question, header, options }] } }, d);

  const missed = ask(SHARE);
  ok('an option offering shared meshes with the decision and ticket uncited is blocked', missed.code === 2);
  ok('the block names both ids, their titles, the matched option, the citation form, the check id and both exclusion surfaces',
    [DECISION, TICKET, 'Foliage and rocks are framework crates', 'Share one mesh per flora kind', 'Share meshes across cells', `Share one mesh per flora kind across cells (${TICKET})`,'question-grounded', '.claude-kit-ignore.yaml', 'options-checked'].every((s) => missed.out.includes(s)));
  ok('a closed ticket is never demanded', !missed.out.includes('DE-T100'));
  ok('an unrelated ticket is never demanded', !missed.out.includes('DE-T101'));

  const both = `The decision that foliage and rocks are shared framework crates (${DECISION}) and the open ticket to share one mesh per flora kind across cells (${TICKET}) already cover this.`;
  ok('citing both ids in the question text passes', ask(SHARE, both).code === 0);
  ok('citing both in an option description passes', ask([{ label: 'Share meshes across cells', description: `as ${DECISION} and ${TICKET} say` }, SHARE[1]]).code === 0);
  const half = ask(SHARE, `Foliage and rocks are shared framework crates (${DECISION}).`);
  ok('citing only the decision still blocks on the ticket', half.code === 2 && half.out.includes(TICKET) && !half.out.includes(`${DECISION} (decision)`));

  ok('negative control: an unrelated option passes', ask([{ label: '(Recommended) Rename the stadium sign' }, { label: 'Leave it' }], 'Which sign text?', 'Sign').code === 0);
  ok('negative control: routine options (Yes / Defer) pass', ask([{ label: '(Recommended) Yes' }, { label: 'Defer' }], 'Proceed with it?', 'Go').code === 0);
  ok('the escape tag with a reason passes; without one it does not', ask(SHARE, 'Flora geometry. [options-checked: none apply: read both, neither governs this]').code === 0
    && ask(SHARE, 'Flora geometry. [options-checked: none apply]').code === 2);

  const dry = (...labels) => spawnSync(process.execPath, [join(ROOT, 'scripts', 'q.mjs'), 'gates', 'question', '--check', ...labels, '--root', d], { cwd: d, encoding: 'utf8', env: ENV });
  const hit = dry('Share meshes across cells');
  ok('the dry run lists the decision and the ticket a matching label finds, id and title', hit.status === 0
    && hit.stdout.includes(`${DECISION} (decision) "Foliage and rocks are framework crates shared with Stiletto"`) && hit.stdout.includes(`${TICKET} (ticket) "Share one mesh per flora kind across cells"`));
  ok('the dry run finds exactly the ids the gate blocks on for the same label', [...hit.stdout.matchAll(/DE-[DT]\d+/g)].map((m) => m[0]).sort().join() === [...missed.out.matchAll(/^ {2}(DE-[DT]\d+) /gm)].map((m) => m[1]).sort().join());
  const none = dry('(Recommended) Rename the stadium sign');
  ok('negative control: a label that matches nothing prints none and no id', none.status === 0 && none.stdout.includes('none') && !/DE-[DT]\d+/.test(none.stdout));
  const two = dry('Share meshes across cells', 'Rename the stadium sign');
  ok('several labels are answered one after the other', two.stdout.indexOf('Share meshes across cells') < two.stdout.indexOf(`${TICKET} (ticket)`) && two.stdout.indexOf(`${TICKET} (ticket)`) < two.stdout.indexOf('Rename the stadium sign'));
  ok('the dry run never lists a closed ticket', !hit.stdout.includes('DE-T100'));
  ok('--check with no label exits 1', dry().status === 1);
  ok('q gates question names the dry run', spawnSync(process.execPath, [join(ROOT, 'scripts', 'q.mjs'), 'gates', 'question', '--root', d], { cwd: d, encoding: 'utf8', env: ENV }).stdout.includes('q gates question --check'));

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'question-grounded:\n  - "**"\n');
  ok('the ignore file lifts the gate', ask(SHARE).code === 0);
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), '');

  ok('another tool is ignored', hook(GATE, { tool_name: 'Bash', tool_input: { questions: [{ question: 'x', options: SHARE }] } }, d).code === 0);
  ok('garbage stdin fails open', hook(GATE, 'not json', d).code === 0);

  rmSync(join(d, '.ai', 'decisions'), { recursive: true, force: true });
  writeFileSync(join(d, '.ai', 'decisions'), 'a file where the decisions directory should be');
  ok('a store error fails open: the same uncited option passes when the decisions directory cannot be read', ask(SHARE).code === 0);
} finally {
  cleanup();
}

done();
