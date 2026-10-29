#!/usr/bin/env node
// tree-delete-gate.test.mjs — while a live broker daemon owns a checkout, a shell delete inside it is
// refused with the broker clean / delete-patch route; without a daemon, in temp, in build output, or
// on an unadopted repo it passes.
// Run: node hooks/tree-delete-gate.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeDeleteTargets } from './lib/tree-delete.mjs';
import { hiddenBehindQuotes } from './hidden-command-cases.mjs';

const HOOK = fileURLToPath(new URL('./tree-delete-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

function repo({ live }) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-treedel-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, '.ai', 'config.yml'), 'broker:\n  repos:\n    - { name: app, path: . }\n');
  writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\nmembers = []\n');
  execFileSync('git', ['add', 'Cargo.toml'], { cwd: dir });
  if (live) {
    mkdirSync(join(dir, 'target', 'broker'), { recursive: true });
    writeFileSync(join(dir, 'target', 'broker', 'broker.lock'), JSON.stringify({ pid: process.pid, host: hostname() }));
  }
  return dir;
}
const run = (cwd, command) => spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });

const live = repo({ live: true });
const idle = repo({ live: false });
try {
  const r = run(live, 'rm -rf scripts/__pycache__');
  check('blocks an rm inside a daemon-owned checkout', r.status === 2, r.stderr);
  check('the message names broker clean and the delete patch', /broker\.mjs" clean scripts\/__pycache__/.test(r.stderr) && /\*\*\* delete/.test(r.stderr));
  check('KIT-T705: an rm hidden behind an escaped quote or a $\'…\' string blocks', hiddenBehindQuotes('rm -rf scripts/__pycache__').every((c) => run(live, c).status === 2));
  check('blocks Remove-Item too', run(live, 'Remove-Item -Recurse -Force assets\\tmp').status === 2);
  check('allows an rm of build output', run(live, 'rm -rf target/debug').status === 0);
  check('allows an rm in the temp dir', run(live, `rm -rf ${join(tmpdir(), 'scratch')}`).status === 0);
  check('allows a non-delete command', run(live, 'ls scripts').status === 0);
  check('allows an rm when no daemon owns the checkout', run(idle, 'rm -rf scripts/__pycache__').status === 0);
  check('allows an rm on an unadopted repo', (() => {
    const plain = mkdtempSync(join(tmpdir(), 'kit-treedel-plain-'));
    execFileSync('git', ['init', '-q'], { cwd: plain });
    const code = run(plain, 'rm -rf x').status;
    rmSync(plain, { recursive: true, force: true });
    return code === 0;
  })());
  check('treeDeleteTargets resolves relative paths against the cwd', treeDeleteTargets('rm a/b.txt', live, join(live, 'src')).length === 1);
  check('treeDeleteTargets ignores paths outside the root', treeDeleteTargets('rm /elsewhere/x', live, live).length === 0);
  for (const [name, command] of [
    ['a quoted shell variable', 'rm -rf "$S/out"'],
    ['a braced shell variable', 'rm -rf ${S}/out'],
    ['a command substitution', 'rm -rf $(mktemp -d)/x'],
    ['a cmd.exe variable', 'del %TEMP%\\x.txt'],
    ['a home path', 'rm -rf ~/scratch'],
    ['a relative path after a cd into a variable', 'cd "$S" && rm -rf out'],
  ]) {
    check(`treeDeleteTargets leaves ${name} unresolved (KIT-T644)`, treeDeleteTargets(command, live, live).length === 0, command);
    check(`allows an rm of ${name} in a daemon-owned checkout`, run(live, command).status === 0);
  }
  check('treeDeleteTargets still resolves a literal path after an unknown cd is left by an absolute one', treeDeleteTargets(`cd "$S" && cd ${live.replace(/\\/g, '/')} && rm -rf out`, live, live).length === 1);
  writeFileSync(join(live, '.claude-kit-ignore.yaml'), 'tree-delete:\n  - "scripts/**"\n');
  check('the documented exclusion lifts the block', run(live, 'rm -rf scripts/__pycache__').status === 0);
  check('fail-open: a malformed payload exits 0', spawnSync(process.execPath, [HOOK], { cwd: live, input: 'nope', encoding: 'utf8' }).status === 0);
} finally {
  rmSync(live, { recursive: true, force: true });
  rmSync(idle, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
