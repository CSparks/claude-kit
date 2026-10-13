#!/usr/bin/env node
// Tests for id-reserve.mjs (KIT-T451): ids minted by concurrent creators never collide, even
// when every creator reads the store before any of them has written its file.
// Run: node scripts/id-reserve.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reserveNextId } from './id-reserve.mjs';
import { checkIds } from './id-utils.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
let pass = 0;
let fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name); } };

const dir = mkdtempSync(join(tmpdir(), 'kit-idres-'));
mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
writeFileSync(join(dir, '.ai', 'config.yml'), 'ids:\n  key: "FQI"\n  pad: 3\n');

const a = reserveNextId(dir, 'tickets');
const b = reserveNextId(dir, 'tickets');
ok('two reservations before any file is written are distinct and ascending', a === 'FQI-T001' && b === 'FQI-T002');

writeFileSync(join(dir, '.ai', 'tickets', 'FQI-T007-x.md'), '---\nid: FQI-T007\n---\n');
ok('a reservation starts above what is on disk', reserveNextId(dir, 'tickets') === 'FQI-T008');

const env = { ...process.env, CLAUDE_PLUGIN_ROOT: dir, CLAUDE_KIT_REGISTRY: join(dir, 'reg.json') };
const create = (n) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(HERE, 't.mjs'), '--root', dir, 'new', 'chore', `parallel job ${n}`], { env, stdio: 'ignore' });
  p.on('close', (code) => resolve(code));
});
const codes = await Promise.all([1, 2, 3, 4, 5, 6].map(create));
const { duplicates } = checkIds(dir);
ok('six concurrent t new runs all succeed', codes.every((c) => c === 0));
ok('they leave no duplicate id', duplicates.length === 0);

rmSync(dir, { recursive: true, force: true });
console.log(`\nid-reserve: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
