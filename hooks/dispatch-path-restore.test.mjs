#!/usr/bin/env node
// dispatch-path-restore.test.mjs — the path-restore dispatch check (KIT-T1340): a brief that prescribes `git checkout <rev> -- <dir>`
// or `git restore --source=<rev>` for an older revision is blocked and pointed at restore-tree; a brief that names restore-tree, a
// forbidding clause and unrelated git calls pass.
// Run: node hooks/dispatch-path-restore.test.mjs

import { PATH_RESTORE_CHECK, pathRestoreBlock } from './dispatch-path-restore.mjs';

let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const block = (prompt) => pathRestoreBlock({ prompt, footer: `check ${PATH_RESTORE_CHECK}` });

const BLOCKED = [
  ['the incident brief: a bisect by checkout of old files', 'Bisect the test: git checkout 1a2b3c4 -- crates/rg-townplan crates/rdg-world, run it, then git checkout HEAD -- the same dirs.'],
  ['a full sha', 'Run git checkout 0123456789abcdef0123456789abcdef01234567 -- src and measure.'],
  ['a <sha> placeholder', 'For each old state: `git checkout <old sha> -- <dirs>` then run the probe.'],
  ['a <rev> placeholder', 'Use git checkout <rev> -- crates/x to compare.'],
  ['git restore --source with a sha', 'Compare using git restore --source=abc1234 --worktree -- crates/x.'],
  ['git restore --source with a ref', 'Put the dirs back with git restore --source=HEAD~5 -- crates/x, then measure.'],
];
for (const [name, prompt] of BLOCKED) check(`blocks ${name}`, block(prompt) !== null);

const PASSES = [
  ['a brief that names restore-tree', 'Bisect with restore-tree 1a2b3c4 crates/rg-townplan, then restore-tree --back crates/rg-townplan.'],
  ['restore-tree named beside the raw form it replaces', 'Use restore-tree, not git checkout <sha> -- <dirs>.'],
  ['a forbidding clause', 'Never git checkout <sha> -- <dirs>: it leaves strays.'],
  ['a checkout of a branch', 'Run git checkout main and pull.'],
  ['a checkout of a path with no revision', 'Discard it with git checkout -- src/a.rs.'],
  ['a restore of one path from the index', 'Put it back with git restore src/a.rs.'],
  ['a restore --staged', 'Unstage with git restore --staged src/a.rs.'],
  ['a discard from bare HEAD', 'Discard it with git restore --source=HEAD -- src/a.rs.'],
  ['no git at all', 'Rename the menu enum variant and update the callers.'],
];
for (const [name, prompt] of PASSES) check(`passes ${name}`, block(prompt) === null);

const text = block(BLOCKED[0][1]);
check('the block names the verb, the way back and the ticket', /restore-tree <rev> <dir>/.test(text) && /restore-tree --back/.test(text) && /KIT-T1340/.test(text));
check('the block ends with the exclusion footer', text.endsWith(`check ${PATH_RESTORE_CHECK}`));
check('an empty prompt is no brief to judge', block('') === null && block(undefined) === null);

console.log(`\ndispatch-path-restore: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
