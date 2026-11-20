// KIT-T1450: a search of a DIRECTORY outside every registered project, adopted repo and `.ai` (a scratch folder in the user
// temp directory) is no search of source, so the retrieval gate passes it, the Grep tool included. A directory inside a
// project, above one, or under `.ai` still blocks, as do a file in a repo and an unresolved variable path.
// Run: node hooks/query-gate-outside-dir.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TMP_REG, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('query-gate-outside-dir');
const slashed = (p) => p.replace(/\\/g, '/');

try {
  const repo = adopted(false);
  mkdirSync(join(repo, 'src'));
  const scratch = tmpDir('qgod-scratch-');
  mkdirSync(join(scratch, 'plans'));
  writeFileSync(join(scratch, 'plans', 'a.md'), 'plan\n');
  const registered = tmpDir('qgod-registered-');
  mkdirSync(join(registered, 'src'));
  const holder = tmpDir('qgod-holder-');
  const nested = join(holder, 'proj');
  mkdirSync(join(nested, 'src'), { recursive: true });
  writeFileSync(TMP_REG, JSON.stringify({ projects: { other: registered, nested } }));

  const grep = (input, cwd = repo) => hook('query-gate.mjs', { tool_name: 'Grep', tool_input: input }, cwd);
  const bash = (command, cwd = repo) => hook('query-gate.mjs', { tool_name: 'Bash', tool_input: { command } }, cwd);
  const BLOCK = 2;
  const PASS = 0;

  ok('the Grep tool on a scratch directory outside every project passes', grep({ pattern: 'plan', path: scratch }).code === PASS);
  ok('the Grep tool on a subdirectory of it passes', grep({ pattern: 'plan', path: join(scratch, 'plans') }).code === PASS);
  ok('the Grep tool with a glob on it passes', grep({ pattern: 'plan', path: scratch, glob: '*.md', output_mode: 'content' }).code === PASS);
  ok('the Grep tool with forward slashes passes', grep({ pattern: 'plan', path: slashed(scratch) }).code === PASS);
  ok('rg of the scratch directory in Bash passes', bash(`rg plan "${slashed(scratch)}"`).code === PASS);
  ok('grep -rn of the scratch directory in Bash passes', bash(`grep -rn plan "${slashed(scratch)}"`).code === PASS);

  ok('negative control: the Grep tool on a directory of the session repo blocks', grep({ pattern: 'plan', path: join(repo, 'src') }).code === BLOCK);
  ok('negative control: the Grep tool on the session repo itself blocks', grep({ pattern: 'plan', path: repo }).code === BLOCK);
  ok('negative control: a directory of a registered project blocks', grep({ pattern: 'plan', path: join(registered, 'src') }).code === BLOCK);
  ok('negative control: a registered project root blocks', grep({ pattern: 'plan', path: registered }).code === BLOCK);
  ok('negative control: a directory that holds a registered project blocks', grep({ pattern: 'plan', path: holder }).code === BLOCK);
  ok('negative control: a directory that holds the session repo blocks', grep({ pattern: 'plan', path: join(repo, '..') }).code === BLOCK);
  ok('negative control: a relative directory blocks', grep({ pattern: 'plan', path: 'src' }).code === BLOCK);
  ok('negative control: no path (the working directory) blocks', grep({ pattern: 'plan' }).code === BLOCK);
  ok('negative control: an unresolved variable path blocks', bash('rg plan "$SCRATCH/plans"').code === BLOCK);
  ok('negative control: a scratch directory mixed with a repo directory blocks', bash(`rg plan "${slashed(scratch)}" src`).code === BLOCK);

  const adoptedElsewhere = adopted(false);
  mkdirSync(join(adoptedElsewhere, 'src'));
  ok('negative control: an adopted repo outside the registry blocks', grep({ pattern: 'plan', path: join(adoptedElsewhere, 'src') }).code === BLOCK);

  const store = join(scratch, '.ai');
  mkdirSync(store);
  ok('negative control: a directory named .ai outside every repo still blocks as a store search', grep({ pattern: 'plan', path: store }).code === BLOCK);
  ok('control: the Grep tool on a file in the repo still passes (one file)', (() => { writeFileSync(join(repo, 'src', 'lib.rs'), 'fn a() {}\n'); return grep({ pattern: 'a', path: join(repo, 'src', 'lib.rs') }).code === PASS; })());
  ok('control: a file in the scratch directory passes', grep({ pattern: 'plan', path: join(scratch, 'plans', 'a.md') }).code === PASS);
} finally {
  cleanup();
}
done();
