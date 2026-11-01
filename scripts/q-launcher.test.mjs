#!/usr/bin/env node
// The bare `q` launchers (bin/q, bin/q.cmd) must work when the home or project path holds a
// space (C:\Users\Chris Sparks). Drives every launcher this machine can run, two ways:
//   1. cwd inside a space-named project, real q.mjs: `q open` returns the project's ticket.
//   2. the launcher installed under a space-named kit dir: arguments and cwd arrive intact.
// ISOLATION: CLAUDE_KIT_REGISTRY and CLAUDE_PLUGIN_ROOT point under a temp dir.

import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WIN = process.platform === 'win32';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const tmpRoot = mkdtempSync(join(tmpdir(), 'kit-qlauncher-'));
const spaced = join(tmpRoot, 'dir with space');
const project = join(spaced, 'project');
const registry = join(tmpRoot, 'registry.json');
const env = {
  ...process.env,
  CLAUDE_KIT_REGISTRY: registry,
  CLAUDE_PLUGIN_ROOT: join(tmpRoot, 'plugin'),
};

const quoteAll = (args) => args.map((a) => `"${a}"`).join(' ');
const viaCmd = (shim, args, cwd) => spawnSync('cmd.exe', ['/d', '/s', '/c', `""${shim}" ${quoteAll(args)}"`],
  { cwd, env, encoding: 'utf8', windowsVerbatimArguments: true });
const viaSh = (shim, args, cwd) => spawnSync('sh', ['-c', `"${shim.replaceAll('\\', '/')}" ${quoteAll(args)}`],
  { cwd, env, encoding: 'utf8' });

const LAUNCHERS = [];
if (IS_WIN) LAUNCHERS.push({ file: 'q.cmd', launch: viaCmd });
if (spawnSync('sh', ['-c', 'exit 0']).status === 0) LAUNCHERS.push({ file: 'q', launch: viaSh });

mkdirSync(join(project, '.ai', 'tickets'), { recursive: true });
writeFileSync(registry, JSON.stringify({ projects: { tst: project } }));
writeFileSync(join(project, '.ai', 'config.yml'),
  'ids:\n  key: "TST"\n  pad: 3\nstatuses:\n  open: [todo, doing, review]\n');
writeFileSync(join(project, '.ai', 'tickets', 'TST-T001-launcher-probe.md'),
  '---\nid: TST-T001\ntitle: launcher probe ticket\ntype: bug\nstatus: todo\npriority: high\n---\n\n## Description\nprobe\n');

test('at least one launcher is runnable here', () => assert.ok(LAUNCHERS.length > 0));

for (const { file, launch } of LAUNCHERS) {
  test(`${file} from a space-named project returns that project's open ticket`, () => {
    const r = launch(join(KIT, 'bin', file), ['open'], project);
    assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr.trim()}`);
    assert.match(r.stdout, /TST-T001/, r.stdout);
  });

  test(`${file} installed under a space-named kit dir forwards arguments`, () => {
    const kit = join(spaced, `kit-${file}`);
    mkdirSync(join(kit, 'bin'), { recursive: true });
    mkdirSync(join(kit, 'scripts'), { recursive: true });
    copyFileSync(join(KIT, 'bin', file), join(kit, 'bin', file));
    writeFileSync(join(kit, 'scripts', 'q.mjs'), 'console.log(`argv=${process.argv.slice(2).join("|")}`);\n');
    const r = launch(join(kit, 'bin', file), ['code', 'two words'], project);
    assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr.trim()}`);
    assert.match(r.stdout, /argv=code\|two words/, r.stdout);
  });
}

rmSync(tmpRoot, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
