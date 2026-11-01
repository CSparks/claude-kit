#!/usr/bin/env node
// commit-gate: a code commit's cited key must belong to the repo's own store or a submodule the
// commit touches (KIT-T799). Throwaway git fixtures, real hook invocations. exit 0 = all pass.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as harness from './test-harness.mjs';

let pass = 0;
let fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? `  (${detail})` : '')); }
}

const gate = (command, cwd) => {
  const r = spawnSync(process.execPath, [join(harness.HOOKS, 'commit-gate.mjs')], {
    input: JSON.stringify({ tool_input: { command } }), cwd, encoding: 'utf8', env: harness.ENV,
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const run = (args, cwd) => harness.git(args, cwd);

function keyedRepo(key) {
  const d = harness.project('none', key);
  writeFileSync(join(d, 'base.txt'), 'base\n');
  run(['add', '-A'], d);
  run(['commit', '-q', '-m', 'base'], d);
  return d;
}
function stageHook(d) {
  mkdirSync(join(d, 'hooks'), { recursive: true });
  writeFileSync(join(d, 'hooks', 'gate.mjs'), 'export const gate = 1;\n');
  run(['add', 'hooks/gate.mjs'], d);
}
function stageTicket(d) {
  writeFileSync(join(d, '.ai', 'tickets', 'KIT-T001-x.md'), '---\nid: KIT-T001\ntitle: x\nstatus: doing\n---\n');
  run(['add', '.ai/tickets/KIT-T001-x.md'], d);
}

try {
  let d = keyedRepo('KIT');
  stageHook(d);
  let r = gate(`git -C ${d} commit -m "fix: billboards (implements MAR-T035)"`, d);
  ok('a foreign key alone blocks a code commit', r.code === 2 && r.out.includes('MAR') && r.out.includes('KIT-T###'), r.out.trim());

  stageTicket(d);
  r = gate(`git -C ${d} commit -m "fix: billboards (implements MAR-T035)"`, d);
  ok('a foreign key blocks even when the commit also touches a ticket', r.code === 2 && r.out.includes('KIT-T799'), r.out.trim());

  r = gate(`git -C ${d} commit -m "implements KIT-T001"`, d);
  ok('the repo own key passes', r.code === 0, r.out.trim());

  r = gate(`git -C ${d} commit -m "implements KIT-T001; see MAR-T035"`, d);
  ok('an own key beside a foreign reference passes', r.code === 0, r.out.trim());

  r = gate(`git -C ${d} commit -m "chore [no-log: scratch] MAR-T035"`, d);
  ok('[no-log] still lifts the gate', r.code === 0, r.out.trim());

  d = keyedRepo('KIT');
  writeFileSync(join(d, 'notes.md'), 'doc\n');
  run(['add', 'notes.md'], d);
  r = gate(`git -C ${d} commit -m "docs (MAR-T035)"`, d);
  ok('a docs-only commit citing a foreign key is not judged', r.code === 0, r.out.trim());

  const sub = harness.identify(harness.repo());
  mkdirSync(join(sub, '.ai'), { recursive: true });
  writeFileSync(join(sub, '.ai', 'config.yml'), 'ids:\n  key: "SUB"\n');
  writeFileSync(join(sub, 'a.txt'), 'a\n');
  run(['add', '-A'], sub);
  run(['commit', '-q', '-m', 'init'], sub);
  d = keyedRepo('KIT');
  run(['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', sub, 'sub'], d);
  run(['commit', '-q', '-m', 'add sub'], d);
  stageHook(d);
  r = gate(`git -C ${d} commit -m "implements SUB-T007"`, d);
  ok('a submodule key not touched by the commit blocks', r.code === 2 && r.out.includes('SUB'), r.out.trim());

  writeFileSync(join(d, 'sub', 'a.txt'), 'b\n');
  run(['-C', join(d, 'sub'), 'commit', '-q', '-am', 'advance'], d);
  run(['add', 'sub'], d);
  r = gate(`git -C ${d} commit -m "implements SUB-T007"`, d);
  ok('a commit touching the submodule may cite its key', r.code === 0, r.out.trim());
} finally {
  harness.cleanup();
}

console.log(fail === 0 ? `\ncommit-cite-keys: all pass (${pass})` : `\ncommit-cite-keys: ${fail} FAILED, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
