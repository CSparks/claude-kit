#!/usr/bin/env node
// Tests for `t link` / `t unlink` (KIT-T723): each relation writes its forward field on the named
// item and its inverse on the target, and unlink removes both sides. Drives the real CLI, so the
// post-mutation reconcile pass is part of what is judged. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { field, listField, splitFrontmatter } from './frontmatter.mjs';
import { findTicket } from './t.mjs';

const SCRIPT = fileURLToPath(new URL('./t.mjs', import.meta.url));
const SHA = 'a1b2c3d';
let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log(`  ok    ${name}`); } else { fail++; console.log(`  FAIL  ${name}`); }
};

const SANDBOX = mkdtempSync(join(tmpdir(), 'kit-tlink-'));
const REGISTRY = join(SANDBOX, 'projects.json');
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }));
const ENV = { ...process.env, CLAUDE_PLUGIN_ROOT: SANDBOX, CLAUDE_KIT_REGISTRY: REGISTRY };

const CONFIG = `classifications:
  bug: { routes_to: tickets }
statuses:
  flow: [todo, doing, review, done]
  off_board: [superseded]
uat:
  default: none
history:
  archive_done_to: tickets/archive
ids:
  key: "KIT"
  prefix: "KIT-T"
  pad: 3
`;

const ticket = (id, status = 'todo') => `---
id: ${id}
title: seed ${id}
type: bug
status: ${status}
priority: high
links: []
supersedes:
superseded_by:
---

## Description
seed.

## History
`;

function fixture(ids) {
  const root = mkdtempSync(join(SANDBOX, 'p-'));
  mkdirSync(join(root, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
  for (const id of ids) writeFileSync(join(root, '.ai', 'tickets', `${id}-seed.md`), ticket(id));
  return root;
}

const t = (root, ...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', env: ENV });
const fm = (root, id) => splitFrontmatter(readFileSync(findTicket(root, id).path, 'utf8')).fm;
const body = (root, id) => readFileSync(findTicket(root, id).path, 'utf8');

try {
  // superseded_by: the NAMED ticket is the retired one; the target is the newer.
  let root = fixture(['KIT-T720', 'KIT-T487']);
  let r = t(root, 'link', 'KIT-T720', 'superseded_by', 'KIT-T487');
  ok('superseded_by: exit 0', r.status === 0);
  ok('superseded_by: forward field on the named item', field(fm(root, 'KIT-T720'), 'superseded_by') === 'KIT-T487');
  ok('superseded_by: named item has no supersedes', field(fm(root, 'KIT-T720'), 'supersedes') === '');
  ok('superseded_by: inverse supersedes on the target', field(fm(root, 'KIT-T487'), 'supersedes') === 'KIT-T720');
  ok('superseded_by: target has no superseded_by', field(fm(root, 'KIT-T487'), 'superseded_by') === '');
  ok('superseded_by: named item retired, target untouched',
    field(fm(root, 'KIT-T720'), 'status') === 'superseded' && field(fm(root, 'KIT-T487'), 'status') === 'todo');

  // supersedes: the NAMED ticket is the newer one.
  root = fixture(['KIT-T001', 'KIT-T002']);
  t(root, 'link', 'KIT-T002', 'supersedes', 'KIT-T001');
  ok('supersedes: forward field on the named item', field(fm(root, 'KIT-T002'), 'supersedes') === 'KIT-T001');
  ok('supersedes: inverse superseded_by on the target', field(fm(root, 'KIT-T001'), 'superseded_by') === 'KIT-T002');
  ok('supersedes: target retired, named item untouched',
    field(fm(root, 'KIT-T001'), 'status') === 'superseded' && field(fm(root, 'KIT-T002'), 'status') === 'todo');
  ok('supersedes: named item has no superseded_by', field(fm(root, 'KIT-T002'), 'superseded_by') === '');

  // unlink of a supersede pair cleans both sides, whichever side names it.
  r = t(root, 'unlink', 'KIT-T001', 'superseded_by', 'KIT-T002');
  ok('unlink superseded_by: exit 0', r.status === 0);
  ok('unlink superseded_by: forward field cleared', field(fm(root, 'KIT-T001'), 'superseded_by') === '');
  ok('unlink superseded_by: inverse cleared', field(fm(root, 'KIT-T002'), 'supersedes') === '');
  ok('unlink superseded_by: retired item restored to its prior status', field(fm(root, 'KIT-T001'), 'status') === 'todo');
  ok('unlink superseded_by: History records the removal', /\(unlink\)/.test(body(root, 'KIT-T001')));

  t(root, 'link', 'KIT-T002', 'supersedes', 'KIT-T001');
  t(root, 'unlink', 'KIT-T002', 'supersedes', 'KIT-T001');
  ok('unlink supersedes: both sides cleared',
    field(fm(root, 'KIT-T002'), 'supersedes') === '' && field(fm(root, 'KIT-T001'), 'superseded_by') === ''
    && field(fm(root, 'KIT-T001'), 'status') === 'todo');

  // a wrong link is replaced by unlink + link: the old pair is gone, the new pair stands.
  root = fixture(['KIT-T010', 'KIT-T011', 'KIT-T012']);
  t(root, 'link', 'KIT-T010', 'superseded_by', 'KIT-T011');
  t(root, 'unlink', 'KIT-T010', 'superseded_by', 'KIT-T011');
  t(root, 'link', 'KIT-T010', 'superseded_by', 'KIT-T012');
  ok('replace: old inverse gone', field(fm(root, 'KIT-T011'), 'supersedes') === '');
  ok('replace: new pair written', field(fm(root, 'KIT-T012'), 'supersedes') === 'KIT-T010' && field(fm(root, 'KIT-T010'), 'superseded_by') === 'KIT-T012');

  // unlink refuses a target that is not the current value.
  r = t(root, 'unlink', 'KIT-T010', 'superseded_by', 'KIT-T011');
  ok('unlink: refuses a target that is not linked', r.status !== 0 && /not linked|no such link/i.test(r.stderr));

  // the single-sided relations write exactly their own field and unlink clears it.
  root = fixture(['KIT-T020', 'KIT-T021']);
  for (const [rel, target] of [['parent', 'KIT-T021'], ['regressed_from', 'KIT-T021'], ['causing_commit', SHA], ['fixed_commit', SHA]]) {
    t(root, 'link', 'KIT-T020', rel, target);
    ok(`${rel}: forward field on the named item`, field(fm(root, 'KIT-T020'), rel) === target);
    ok(`${rel}: target untouched`, !fm(root, 'KIT-T021').includes(rel));
    t(root, 'unlink', 'KIT-T020', rel, target);
    ok(`unlink ${rel}: field cleared`, field(fm(root, 'KIT-T020'), rel) === '');
  }

  t(root, 'link', 'KIT-T020', 'link', 'KIT-T021');
  ok('link: target added to the named item links list', listField(fm(root, 'KIT-T020'), 'links').includes('KIT-T021'));
  t(root, 'unlink', 'KIT-T020', 'link', 'KIT-T021');
  ok('unlink link: target removed from the list', !listField(fm(root, 'KIT-T020'), 'links').includes('KIT-T021'));

  // `t status done` on a bug without a fixed_commit names the exact command.
  root = fixture(['KIT-T030']);
  r = t(root, 'status', 'KIT-T030', 'doing');
  r = t(root, 'status', 'KIT-T030', 'done');
  ok('done without fixed_commit: warning names the exact command',
    /t status KIT-T030 done --fixed-commit <sha>/.test(r.stdout + r.stderr) && /t link KIT-T030 fixed_commit <sha>/.test(r.stdout + r.stderr));
} finally {
  rmSync(SANDBOX, { recursive: true, force: true });
}

console.log(`\nt-link: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
