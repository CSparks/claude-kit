#!/usr/bin/env node
// source-shell-gate-chained.test.mjs — a variable assigned in the && chain (behind `cd dir &&`) resolves for the segments joined to
// it by && alone, so a copy of a built exe into a scratch directory named by that variable is no source write (KIT-T1165).
// A copy onto repo source, from scratch into the repo, behind a `;` after the cd, or before the assignment stays blocked.
// Run: node hooks/source-shell-gate-chained.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond) => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}`); }
};
const slashed = (p) => p.replace(/\\/g, '/');

const repo = mkdtempSync(join(tmpdir(), 'kit-chain-repo-'));
const scratch = mkdtempSync(join(tmpdir(), 'kit-chain-scratch-'));
const R = slashed(repo);
const P = slashed(scratch);
const run = (command, tool = 'Bash') => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ session_id: 'S1', tool_name: tool, tool_input: { command } }), encoding: 'utf8' });
const blocked = (command) => run(command).status === 2;

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  mkdirSync(join(repo, 'target', 'debug'), { recursive: true });
  writeFileSync(join(repo, 'src', 'lib.rs'), 'fn lib() {}\n');
  writeFileSync(join(repo, 'target', 'debug', 'probe.exe'), 'MZ');
  writeFileSync(join(scratch, 'new.rs'), 'fn n() {}\n');

  const COPY_EXE = 'mkdir -p "$S" && cp target/debug/probe.exe "$S/probe.exe" && cp target/debug/probe.exe "$S/deck.exe" && git diff --stat -- src/lib.rs && ls "$S"';
  check('the reported copy of built exes into a scratch directory passes', !blocked(`S="${P}/run" && ${COPY_EXE}`));
  check('the same behind a cd prefix passes', !blocked(`cd ${R} && S="${P}/run" && ${COPY_EXE}`));
  check('a source file copied out to a variable scratch path passes behind a cd prefix', !blocked(`cd ${R} && S="${P}" && cp src/lib.rs "$S/lib.rs.bak"`));
  check('a literal scratch destination passes', !blocked(`cp target/debug/probe.exe "${P}/probe.exe"`));

  check('a ; after the cd leaves the variable unresolved: blocked', blocked(`cd ${R} && S="${P}"; cp target/debug/probe.exe "$S/probe.exe"`));
  check('an assignment behind a failing && is not visible after a ;: blocked', blocked(`false && S="${P}"; cp target/debug/probe.exe "$S/probe.exe"`));
  check('an assignment after the copy: blocked', blocked(`cp target/debug/probe.exe "$S/probe.exe" && S="${P}"`));
  check('a variable never assigned: blocked', blocked('cp target/debug/probe.exe "$S/probe.exe"'));
  check('a pipe between the assignment and the use ends the chain: blocked', blocked(`cd ${R} && S="${P}" && echo x | cat && cp target/debug/probe.exe "$S/probe.exe"`));

  check('a copy onto repo source stays blocked', blocked(`S="${P}" && cp "$S/new.rs" src/lib.rs`));
  check('a copy from scratch into the repo source tree stays blocked', blocked(`cd ${R} && S="${P}" && cp "$S/new.rs" src/new.rs`));
  check('a variable naming the repo source directory stays blocked', blocked(`cd ${R} && S=src && cp "${P}/new.rs" "$S/new.rs"`));
  check('a plain redirect into source stays blocked', blocked(`cd ${R} && S="${P}" && echo x > src/lib.rs`));
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
