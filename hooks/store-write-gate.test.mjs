#!/usr/bin/env node
// store-write-gate.test.mjs — the `store-write` check (KIT-T509): a hand Write that CREATES a file
// in a typed .ai store, or writes SESSION.md / a generated view / a hook-owned log, is refused and
// names the command; editing an existing item's prose, writing templates and non-store paths pass;
// the documented exclusions lift it.
// Run: node hooks/store-write-gate.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { storeWriteViolation } from './lib/store-write-gate.mjs';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'kit-storewrite-')));
const ai = join(root, '.ai');
for (const d of ['tickets', 'decisions', 'notes', 'questions', 'epics', 'requests', 'inbox', 'resolved']) mkdirSync(join(ai, d), { recursive: true });
writeFileSync(join(ai, 'config.yml'), 'roadmap_mode: generated\nids:\n  key: ZZ\n');
writeFileSync(join(ai, 'tickets', 'ZZ-T001-x.md'), '---\nid: ZZ-T001\n---\n');
writeFileSync(join(ai, 'tickets', '_TEMPLATE.md'), 'x');
spawnSync('git', ['init', '-q'], { cwd: root });
const plain = mkdtempSync(join(tmpdir(), 'kit-storewrite-plain-'));

const run = (file, extra = {}) => spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file, content: '# x\n', ...extra } }),
  cwd: root, encoding: 'utf8',
});

try {
  const cases = [
    ['a new decision', join(ai, 'decisions', 'ZZ-D009-x.md'), 't decide'],
    ['a new ticket', join(ai, 'tickets', 'ZZ-T009-x.md'), 't new'],
    ['a new note', join(ai, 'notes', 'ZZ-N009-x.md'), 't note'],
    ['a new question', join(ai, 'questions', 'ZZ-Q009-x.md'), 't question'],
    ['a new epic', join(ai, 'epics', 'ZZ-E009-x.md'), 't epic'],
    ['a new request', join(ai, 'requests', 'ZZ-R009-x.md'), 't request'],
    ['a hand inbox capture', join(ai, 'inbox', 'x.md'), 'cap'],
    ['a resolved record', join(ai, 'resolved', 'x.md'), 'cap --done'],
    ['SESSION.md', join(ai, 'SESSION.md'), 't session'],
    ['the board INDEX', join(ai, 'tickets', 'INDEX.md'), 'index-tickets'],
    ['a generated ROADMAP', join(ai, 'ROADMAP.md'), 'index-tickets'],
    ['the agent roster', join(ai, 'agents.jsonl'), 'hook'],
  ];
  for (const [name, file, cmd] of cases) {
    const r = run(file);
    check(`refuses ${name} and names the command`, r.status === 2 && r.stderr.includes(cmd) && r.stderr.includes('store-write'), `(exit ${r.status}) ${r.stderr.slice(0, 120)}`);
  }

  const allowed = [
    ['editing an existing ticket', join(ai, 'tickets', 'ZZ-T001-x.md')],
    ['a store template', join(ai, 'tickets', '_TEMPLATE.md')],
    ['config.yml', join(ai, 'config.yml')],
    ['a file outside any store', join(plain, 'decisions', 'x.md')],
    ['a folder named .ai without config.yml', join(plain, '.ai', 'decisions', 'x.md')],
  ];
  for (const [name, file] of allowed) {
    const r = run(file);
    check(`allows ${name}`, r.status === 0, `(exit ${r.status}) ${r.stderr.slice(0, 120)}`);
  }

  check('the in-source marker lifts the check', run(join(ai, 'notes', 'ZZ-N010-y.md'), { content: '<!-- claude-kit-ignore-file store-write -->\nx\n' }).status === 0);
  writeFileSync(join(root, '.claude-kit-ignore.yaml'), 'store-write:\n  - ".ai/notes/**"\n');
  check('a path glob in .claude-kit-ignore.yaml lifts the check', run(join(ai, 'notes', 'ZZ-N011-z.md')).status === 0);
  check('the glob is per path: decisions stay refused', run(join(ai, 'decisions', 'ZZ-D010-y.md')).status === 2);

  check('pure: a malformed path fails open', storeWriteViolation('') === null);
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
}
console.log(`\nstore-write-gate: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
