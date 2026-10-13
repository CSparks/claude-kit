#!/usr/bin/env node
// Tests for is-main.mjs (KIT-T461): a script started through a directory link (the sealed
// runtime's `current`, the plugin install) still sees itself as main, an importer does not, and
// the kit's real entry points run through a link instead of silently doing nothing.
// Run: node scripts/is-main.test.mjs

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const KIT = resolve(fileURLToPath(import.meta.url), '..', '..');
const IS_MAIN = pathToFileURL(join(KIT, 'scripts', 'is-main.mjs')).href;
let pass = 0;
let fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? ' - ' + detail : '')); } };
const run = (file, args = []) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });

const tmp = mkdtempSync(join(tmpdir(), 'kit-ismain-'));
const real = join(tmp, 'real');
mkdirSync(real);
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';
symlinkSync(real, join(tmp, 'link'), LINK_TYPE);
symlinkSync(KIT, join(tmp, 'kit-link'), LINK_TYPE);
writeFileSync(join(real, 'probe.mjs'), `import { isMain } from '${IS_MAIN}';\nconsole.log(isMain(import.meta.url) ? 'main' : 'imported');\n`);
writeFileSync(join(real, 'importer.mjs'), "import './probe.mjs';\n");

ok('started by its real path: main', run(join(real, 'probe.mjs')).stdout.trim() === 'main');
ok('started through a directory link: main', run(join(tmp, 'link', 'probe.mjs')).stdout.trim() === 'main');
ok('imported by another script: not main', run(join(real, 'importer.mjs')).stdout.trim() === 'imported');

const viaLink = (rel, args) => run(join(tmp, 'kit-link', rel), args);
ok('t.mjs through a link prints its usage', /usage: t /.test(viaLink('scripts/t.mjs').stderr + viaLink('scripts/t.mjs').stdout));
ok('compat-run.mjs through a link runs its hook', /BLOCKED|usage|\{/.test(spawnSync(process.execPath, [join(tmp, 'kit-link', 'hooks', 'compat-run.mjs'), 'workflow-gate.mjs'], {
  input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Workflow', tool_input: { script: "await agent('p')" } }), encoding: 'utf8',
}).stderr));

rmSync(join(tmp, 'link'), { recursive: true, force: true });
rmSync(join(tmp, 'kit-link'), { recursive: true, force: true });
rmSync(tmp, { recursive: true, force: true });
console.log(`\nis-main: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
