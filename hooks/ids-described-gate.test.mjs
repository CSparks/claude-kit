// ids-described-gate (KIT-T817, KIT-D128): an AskUserQuestion that names a ticket, decision or question id without
// saying what the item is blocks; a described id, a question with no id, an id the store does not hold, the ignore
// file and garbage stdin pass.
// Run: node hooks/ids-described-gate.test.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOOKS, adopted, cleanup, hook, reporter } from './test-harness.mjs';
import { stems } from './lib/stems.mjs';

const { ok, done } = reporter('ids-described-gate');
const OPTIONS = [{ label: '(Recommended) Block', description: 'refuse the dispatch' }, { label: 'Warn', description: 'print only' }];

try {
  ok('wired into hooks.json for AskUserQuestion', JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'))
    .hooks.PreToolUse.some((e) => e.matcher.includes('AskUserQuestion') && e.hooks.some((h) => h.command.includes('ids-described-gate'))));

  const d = adopted(false);
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  mkdirSync(join(d, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(d, '.ai', 'tickets', 'KIT-T703-briefs.md'), '---\nid: KIT-T703\ntitle: Orchestrator briefs invent requirements beyond the maintainers words\ntype: bug\n---\n');
  writeFileSync(join(d, '.ai', 'decisions', 'KIT-D128-ids.md'), '---\nid: KIT-D128\ntitle: Every ticket, decision or question id shown to the maintainer carries what it is in plain words\n---\n');
  const ask = (question, header = 'Scope', options = OPTIONS) => hook('ids-described-gate.mjs', { tool_name: 'AskUserQuestion', tool_input: { questions: [{ question, header, options }] } }, d);

  const bare = ask('Which ticket types should the KIT-T703 brief check cover?');
  ok('a bare-id question is blocked', bare.code === 2);
  ok('the block names the id, its title, the check id and both exclusion surfaces',
    bare.out.includes('KIT-T703') && bare.out.includes('Orchestrator briefs invent requirements') && bare.out.includes('ids-described') && bare.out.includes('.claude-kit-ignore.yaml'));
  ok('an id named only in an option is blocked', ask('Which way?', 'Scope', [{ label: 'Follow KIT-D128', description: 'as written' }, { label: 'Skip' }]).code === 2);
  ok('a described id passes', ask('Should the check that stops orchestrator briefs inventing requirements beyond the maintainers words (KIT-T703) block or warn?').code === 0);
  ok('a described decision passes', ask('Does KIT-D128, the rule that every id shown to the maintainer carries plain words, cover receipts too?').code === 0);
  ok('the description may sit in an option', ask('Block or warn for KIT-T703?', 'Scope', [{ label: 'Block', description: 'orchestrator briefs that invent requirements get refused' }, { label: 'Warn' }]).code === 0);
  ok('negative control: a question with no id passes', ask('Should the check block or only warn?').code === 0);
  ok('negative control: an id the store does not hold passes', ask('Which scope for KIT-T999?').code === 0);

  writeFileSync(join(d, '.ai', 'tickets', 'RDG-T024-settlements.md'), "---\nid: RDG-T024\ntitle: Settlements are cut off from the highways: no off-ramp or on-ramp leads from a motorway into a settlement's streets\ntype: bug\n---\n");
  const ramps = ask('Which first?', 'Scope', [{ label: 'the settlement access work (off-ramps and on-ramps into settlements, RDG-T024)' }, { label: 'Skip' }]);
  ok('KIT-T1102: plural and hyphenated words of the title describe the id', ramps.code === 0);
  ok('KIT-T1102: the singular form of a plural title word counts', ask('Does RDG-T024 about the settlement and its motorway access matter now?').code === 0);
  const bareRamp = ask('Which first, RDG-T024?');
  ok('KIT-T1102 negative control: an id with no description still blocks', bareRamp.code === 2);
  ok('KIT-T1102: the block prints the title words it looked for and those it found',
    bareRamp.out.includes('looked for 2 of its title words: settlements, highways, off-ramp') && bareRamp.out.includes('found: none')
    && ask('Which first, RDG-T024, the settlement work?').out.includes('found: settlements'));
  ok('KIT-T1102: stems join a hyphenated word and cut a plural', [...stems('off-ramps and queries')].sort().join() === 'offra,query,ramp');

  writeFileSync(join(d, '.claude-kit-ignore.yaml'), 'ids-described:\n  - "**"\n');
  ok('the ignore file lifts the gate', ask('Which ticket types should the KIT-T703 brief check cover?').code === 0);
  writeFileSync(join(d, '.claude-kit-ignore.yaml'), '');

  ok('garbage stdin fails open', hook('ids-described-gate.mjs', 'not json', d).code === 0);
  ok('another tool is ignored', hook('ids-described-gate.mjs', { tool_name: 'Bash', tool_input: { questions: [{ question: 'KIT-T703?' }] } }, d).code === 0);
} finally {
  cleanup();
}

done();
