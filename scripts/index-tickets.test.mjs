#!/usr/bin/env node
// Tests for index-tickets.mjs — board generation (aka: aliases, parent/provenance rollups) and
// the SCOPING of the generated views (KIT-T125/KIT-T154). Builds throwaway .ai fixtures in a
// temp dir. exit 0 = all pass.
//
// TEST ISOLATION (KIT-T142/KIT-T164): synthetic id keys (IDX/AAA/BBB — never a live scope), and
// CLAUDE_PLUGIN_ROOT + CLAUDE_KIT_REGISTRY both redirected into a throwaway world so the cache
// these fixtures read and write is a temp file. Both are resolved at CALL time inside the
// modules under test, so setting them here (after the hoisted imports) is what takes effect.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { regenerateIndexes } from './index-tickets.mjs';

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const world = mkdtempSync(join(tmpdir(), 'kit-idx-world-'));
fixtures.push(world);
mkdirSync(join(world, '.cache'), { recursive: true });
const REGISTRY = join(world, 'projects.json');
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }, null, 2));
process.env.CLAUDE_PLUGIN_ROOT = world;
process.env.CLAUDE_KIT_REGISTRY = REGISTRY;

// Register a fixture so it is allowed to hydrate into the (temp) shared cache — the KIT-T164
// guard refuses unregistered stores, which is exactly what keeps these fixtures off the real one.
function registerProject(name, root) {
  const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  reg.projects[name] = root;
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
}

function project(tickets = {}, key = 'IDX') {
  const d = mkdtempSync(join(tmpdir(), 'kit-idx-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
  for (const [name, body] of Object.entries(tickets)) {
    writeFileSync(join(d, '.ai', 'tickets', name), body);
  }
  return d;
}

function readIndex(root) {
  return readFileSync(join(root, '.ai', 'tickets', 'INDEX.md'), 'utf8');
}

// A ticket WITH aka: [R045] should render `· was R045` in the board row.
const withAka = project({
  'IDX-T045-foo.md': `---\nid: IDX-T045\ntitle: foo feature\ntype: feature\nstatus: todo\npriority: medium\naka: [R045]\n---\n`,
});
await regenerateIndexes(withAka);
const idx1 = readIndex(withAka);
ok('aka single alias renders "· was R045" in board row', idx1.includes('· was R045'));
ok('board row contains ticket id IDX-T045', idx1.includes('IDX-T045'));

// A ticket with multiple aliases renders them joined.
const multiAka = project({
  'IDX-T046-bar.md': `---\nid: IDX-T046\ntitle: bar feature\ntype: feature\nstatus: todo\npriority: medium\naka: [R045, R046]\n---\n`,
});
await regenerateIndexes(multiAka);
const idx2 = readIndex(multiAka);
ok('multiple aka aliases all appear in board row', idx2.includes('R045') && idx2.includes('R046'));
ok('multi-aka row contains "· was"', idx2.includes('· was'));

// A ticket WITHOUT aka: should NOT have "· was" in its row.
const noAka = project({
  'IDX-T047-baz.md': `---\nid: IDX-T047\ntitle: baz feature\ntype: feature\nstatus: todo\npriority: medium\n---\n`,
});
await regenerateIndexes(noAka);
const idx3 = readIndex(noAka);
ok('ticket without aka has no "· was" suffix', !idx3.includes('· was'));

// An empty aka: [] should also produce no suffix.
const emptyAka = project({
  'IDX-T048-qux.md': `---\nid: IDX-T048\ntitle: qux feature\ntype: feature\nstatus: todo\npriority: medium\naka: []\n---\n`,
});
await regenerateIndexes(emptyAka);
const idx4 = readIndex(emptyAka);
ok('empty aka: [] produces no "· was" suffix', !idx4.includes('· was'));

// --- parent: hierarchy tests (KIT-T094) ---

// A parent item with two children → the board renders the downward rollup under the parent row.
const withParent = project({
  'IDX-R067-epic.md': `---\nid: IDX-R067\ntitle: epic request\ntype: request\nstatus: todo\npriority: medium\n---\n`,
  'IDX-T127-child1.md': `---\nid: IDX-T127\ntitle: child one\ntype: feature\nstatus: todo\npriority: medium\nparent: IDX-R067\n---\n`,
  'IDX-T128-child2.md': `---\nid: IDX-T128\ntitle: child two\ntype: feature\nstatus: todo\npriority: medium\nparent: IDX-R067\n---\n`,
});
await regenerateIndexes(withParent);
const idx5 = readIndex(withParent);
ok('parent item row appears in board', idx5.includes('IDX-R067'));
ok('parent item gets downward rollup listing IDX-T127', idx5.includes('IDX-T127') && idx5.includes('children'));
ok('parent item rollup also lists IDX-T128', idx5.includes('IDX-T128'));
ok('child IDX-T127 shows upward parent marker ↳ IDX-R067', idx5.includes('↳ IDX-R067'));
ok('child IDX-T128 also shows upward parent marker', idx5.split('↳ IDX-R067').length >= 3); // parent row + 2 child rows

// A child with parent: renders upward marker.
const childUpward = project({
  'IDX-R070-parent.md': `---\nid: IDX-R070\ntitle: parent item\ntype: request\nstatus: todo\npriority: medium\n---\n`,
  'IDX-T130-child.md': `---\nid: IDX-T130\ntitle: child item\ntype: feature\nstatus: todo\npriority: medium\nparent: IDX-R070\n---\n`,
});
await regenerateIndexes(childUpward);
const idx6 = readIndex(childUpward);
ok('child row contains upward parent marker ↳ IDX-R070', idx6.includes('↳ IDX-R070'));

// A dangling parent: (target missing) must NOT crash the board.
const danglingParent = project({
  'IDX-T131-orphan.md': `---\nid: IDX-T131\ntitle: orphan child\ntype: feature\nstatus: todo\npriority: medium\nparent: IDX-MISSING-999\n---\n`,
});
let danglingOk = false;
try {
  await regenerateIndexes(danglingParent);
  const idx7 = readIndex(danglingParent);
  danglingOk = idx7.includes('IDX-T131');
} catch {
  danglingOk = false;
}
ok('dangling parent does not crash the board', danglingOk);

// A ticket WITHOUT parent: should NOT have ↳ upward marker.
const noParent = project({
  'IDX-T132-standalone.md': `---\nid: IDX-T132\ntitle: standalone\ntype: feature\nstatus: todo\npriority: medium\n---\n`,
});
await regenerateIndexes(noParent);
const idx8 = readIndex(noParent);
ok('ticket without parent has no upward ↳ marker', !idx8.includes('↳'));

// --- provenance fields: produced_by / informs / introduced_by (KIT-T095) ---

// A source doc with informs: [...] gets a downward rollup under its row; the informed
// items each get an upward ← produced_by marker on their row.
const withProvenanceInforms = project({
  'IDX-R067-research.md': `---\nid: IDX-R067\ntitle: research doc\ntype: request\nstatus: done\npriority: medium\ninforms: [IDX-T127, IDX-T128]\n---\n`,
  'IDX-T127-child1.md': `---\nid: IDX-T127\ntitle: work item one\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: IDX-R067\n---\n`,
  'IDX-T128-child2.md': `---\nid: IDX-T128\ntitle: work item two\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: IDX-R067\n---\n`,
});
await regenerateIndexes(withProvenanceInforms);
const idx9 = readIndex(withProvenanceInforms);
ok('source doc with informs: gets downward rollup listing IDX-T127', idx9.includes('IDX-T127') && idx9.includes('informs'));
ok('source doc rollup also lists IDX-T128', idx9.includes('IDX-T128'));
ok('produced item IDX-T127 shows upward marker ← produced_by IDX-R067', idx9.includes('← produced_by IDX-R067'));
ok('produced item IDX-T128 also shows upward marker', idx9.split('← produced_by IDX-R067').length >= 3); // source row + 2 child rows

// A source doc where produced_by is set — the source renders a ↳ produced: rollup.
const withProducedBy = project({
  'IDX-R070-doc.md': `---\nid: IDX-R070\ntitle: design doc\ntype: request\nstatus: done\npriority: medium\n---\n`,
  'IDX-T130-impl.md': `---\nid: IDX-T130\ntitle: implementation\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: IDX-R070\n---\n`,
});
await regenerateIndexes(withProducedBy);
const idx10 = readIndex(withProducedBy);
ok('source doc gets ↳ produced: rollup when children set produced_by', idx10.includes('produced'));
ok('implementation item shows upward ← produced_by IDX-R070 marker', idx10.includes('← produced_by IDX-R070'));

// introduced_by surfaces in the REGRESSIONS view alongside causing_commit.
function readReg(root) { return readFileSync(join(root, '.ai', 'REGRESSIONS.md'), 'utf8'); }
const withIntroducedBy = project({
  'IDX-T050-original.md': `---\nid: IDX-T050\ntitle: original bug\ntype: bug\nstatus: done\npriority: medium\n---\n`,
  'IDX-T051-regression.md': `---\nid: IDX-T051\ntitle: regression of original\ntype: regression\nstatus: todo\npriority: high\nregressed_from: IDX-T050\nintroduced_by: IDX-T040@abc1234\ncausing_commit: def5678\n---\n`,
});
await regenerateIndexes(withIntroducedBy);
const reg1 = readReg(withIntroducedBy);
ok('introduced_by surfaces in REGRESSIONS view', reg1.includes('introduced by IDX-T040@abc1234'));
ok('causing_commit still appears alongside introduced_by', reg1.includes('caused by def5678'));

// A dangling provenance ref (produced_by pointing at a missing id) must not crash.
const danglingProvenance = project({
  'IDX-T135-orphan.md': `---\nid: IDX-T135\ntitle: orphan with dangling provenance\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: IDX-MISSING-999\ninforms: [IDX-MISSING-998]\n---\n`,
});
let danglingProvOk = false;
try {
  await regenerateIndexes(danglingProvenance);
  const idx11 = readIndex(danglingProvenance);
  danglingProvOk = idx11.includes('IDX-T135');
} catch {
  danglingProvOk = false;
}
ok('dangling provenance ref does not crash the board', danglingProvOk);

// --- generated views are scoped to the OWNING project (KIT-T125 / KIT-T154) ---
//
// The defect: the chain data came from the CROSS-SCOPE cache with no scope filter, so a repo
// with zero supersessions still got its SUPERSEDED.md filled with other projects' chains
// (measured in gridiron-blitz: DUP-T005→DUP-T001, GG-T015→GG-T014, GG-D029→GG-T152,
// KIT-T037→KIT-T014, KIT-T060→KIT-T075, RCN-T001→RCN-T002 — not one of them a gridiron ticket),
// and the summary line contradicted itself: "0 superseded … SUPERSEDED.md (6 chain(s))".
//
// Both projects below are REGISTERED and hydrated into the same temp cache, so BBB's chains are
// genuinely present in the DB while AAA regenerates — the leak has something to leak.
function readSup(root) { return readFileSync(join(root, '.ai', 'SUPERSEDED.md'), 'utf8'); }

const neighbour = project({
  'BBB-T001-old.md': `---\nid: BBB-T001\ntitle: retired neighbour ticket\ntype: bug\nstatus: superseded\npriority: medium\nsuperseded_by: BBB-T002\n---\n`,
  'BBB-T002-new.md': `---\nid: BBB-T002\ntitle: replacement neighbour ticket\ntype: bug\nstatus: todo\npriority: medium\nsupersedes: BBB-T001\n---\n`,
}, 'BBB');
registerProject('neighbour-fixture', neighbour);
await regenerateIndexes(neighbour);
ok('neighbour project renders its OWN chain', readSup(neighbour).includes('BBB-T001'));

// A project with tickets but ZERO supersessions must get an EMPTY SUPERSEDED.md.
const cleanProject = project({
  'AAA-T001-one.md': `---\nid: AAA-T001\ntitle: first\ntype: bug\nstatus: todo\npriority: medium\n---\n`,
  'AAA-T002-two.md': `---\nid: AAA-T002\ntitle: second\ntype: feature\nstatus: todo\npriority: medium\n---\n`,
}, 'AAA');
registerProject('clean-fixture', cleanProject);
const cleanSummary = await regenerateIndexes(cleanProject);
const cleanSup = readSup(cleanProject);
ok('a project with no supersessions gets an EMPTY SUPERSEDED.md',
  cleanSup.includes('_No superseded tickets yet._'), cleanSup);
ok('no OTHER project\'s ids leak into SUPERSEDED.md', !/BBB-|KIT-|DUP-|GG-|RCN-/.test(cleanSup), cleanSup);
ok('summary agrees with the file: 0 superseded AND 0 chains',
  cleanSummary.superseded === 0 && cleanSummary.supChains === 0,
  `superseded=${cleanSummary.superseded} supChains=${cleanSummary.supChains}`);

// A project WITH a supersession renders exactly its own chain — and only its own.
const ownChain = project({
  'AAA-T010-old.md': `---\nid: AAA-T010\ntitle: retired\ntype: bug\nstatus: superseded\npriority: medium\nsuperseded_by: AAA-T011\n---\n`,
  'AAA-T011-new.md': `---\nid: AAA-T011\ntitle: replacement\ntype: bug\nstatus: todo\npriority: medium\nsupersedes: AAA-T010\n---\n`,
}, 'AAA');
registerProject('own-chain-fixture', ownChain);
const ownSummary = await regenerateIndexes(ownChain);
const ownSup = readSup(ownChain);
ok('own supersede chain is rendered', ownSup.includes('AAA-T010') && ownSup.includes('AAA-T011'));
ok('foreign chains stay out of it', !/BBB-|KIT-|DUP-|GG-|RCN-/.test(ownSup), ownSup);
ok('summary chain count matches the rendered chains',
  ownSummary.supChains === (ownSup.match(/^- \*\*/gm) || []).length,
  `supChains=${ownSummary.supChains}`);

// The ticket TEMPLATE's commented fields must never parse as real supersede values — the
// second half of KIT-T125 ("# ticket id this one RETIRES (set on the NEWER ticket)" → KIT-T044).
const withTemplate = project({
  'AAA-T020-real.md': `---\nid: AAA-T020\ntitle: a real ticket\ntype: bug\nstatus: todo\npriority: medium\nsupersedes:            # ticket id this one RETIRES (set on the NEWER ticket)\nsuperseded_by:         # ticket id that retired THIS one\n---\n`,
}, 'AAA');
writeFileSync(join(withTemplate, '.ai', 'tickets', '_TEMPLATE.md'),
  `---\nid: AAA-T000\ntitle: <short imperative title>\ntype: bug\nstatus: todo\npriority: medium\nsupersedes:            # ticket id this one RETIRES (set on the NEWER ticket)\nsuperseded_by:         # ticket id that retired THIS one (drops it from the active board)\n---\n\n## Description\n<what and why>\n`);
registerProject('template-fixture', withTemplate);
const tplSummary = await regenerateIndexes(withTemplate);
const tplSup = readSup(withTemplate);
ok('a commented supersedes: field yields no chain',
  tplSup.includes('_No superseded tickets yet._'), tplSup);
ok('no chain is parsed out of the _TEMPLATE.md placeholder id', !tplSup.includes('AAA-T000'), tplSup);
ok('template comment prose never reaches the view', !/RETIRES/.test(tplSup), tplSup);
ok('summary reports 0 chains for the template case', tplSummary.supChains === 0, `supChains=${tplSummary.supChains}`);

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nindex-tickets: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
