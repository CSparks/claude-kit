#!/usr/bin/env node
// source-shell-gate-copy-variable.test.mjs — a cp or mv refused because an operand holds a variable the command does not
// resolve names that variable, why it stayed unresolved and how to write the command so it resolves (KIT-T1168).
// Run: node hooks/source-shell-gate-copy-variable.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-copyvar-repo-'));
const scratch = mkdtempSync(join(tmpdir(), 'kit-copyvar-scratch-'));
const P = scratch.replace(/\\/g, '/');
const run = (command, tool = 'Bash') => {
  const r = spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ session_id: 'S1', tool_name: tool, tool_input: { command } }), encoding: 'utf8' });
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}` };
};

const BASH_WAY_OUT = 'S=/literal/dir && cp';
// The block text must name the call's operand and variable, give the reason in `why`, and the way out.
const explains = (name, command, why, { operand = '$S/lib.rs.bak', variable = '$S', how = BASH_WAY_OUT, tool = 'Bash' } = {}) => {
  const r = run(command, tool);
  check(name, r.code === 2 && r.text.includes(`names ${operand}: ${variable} `) && r.text.includes(why) && r.text.includes(how), r.text.trim());
};

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src', 'lib.rs'), 'fn lib() {}\n');

  const COPY = 'cp src/lib.rs "$S/lib.rs.bak"';
  explains('never assigned in this command', COPY, 'is not assigned in this command');
  explains('exported by name only', `export S; ${COPY}`, 'is only exported by name');
  explains('assigned after a pipe', `echo go | S=${P}/out; ${COPY}`, 'assigned in a pipeline');
  explains('assigned in an && chain behind a cd, the copy behind a ;', `cd src && S=${P}/out; cp lib.rs "$S/lib.rs.bak"`, 'assigned inside an && chain');
  explains('assigned behind ||', `false || S=${P}/out; ${COPY}`, 'assigned behind || or &');
  explains('assigned after the copy', `${COPY} && S=${P}/out`, 'assigned after the copy');
  explains('assigned twice', `S=${P}/a; S=${P}/b; ${COPY}`, 'assigned more than once');
  explains('assigned only as the prefix of a command', `S=${P}/out ${COPY}`, 'assigned only inside another command');
  explains('assigned a value holding a substitution', `S=$(pwd)/out; ${COPY}`, 'no plain literal');
  explains('a name the shell rewrites', `PWD=${P}/out; cp src/lib.rs "$PWD/lib.rs.bak"`, 'rewrites itself', { operand: '$PWD/lib.rs.bak', variable: '$PWD', how: 'PWD=/literal/dir && cp' });
  explains('a command the gate cannot prove leaves variables alone', `S=${P}/out; some-unknown-tool; ${COPY}`, 'may rebind variables');
  explains('a value with a space copied unquoted', `S="${P}/my dir"; cp src/lib.rs $S/lib.rs.bak`, 'splits or expands', { how: 'in double quotes ("$S/<file>")' });
  explains('a mv names its variable the same way', 'mv src/lib.rs "$S/lib.rs.bak"', 'is not assigned in this command');

  const ps = run('Copy-Item src/lib.rs "$S/lib.rs.bak"', 'PowerShell');
  check('PowerShell: the way out is a PowerShell assignment', ps.code === 2 && ps.text.includes('is not assigned in this command') && ps.text.includes("$S = 'C:/literal/dir'; Copy-Item"), ps.text.trim());

  check('the named way out resolves: the same copy joined to its assignment by && passes', run(`S=${P} && ${COPY}`).code === 0);
  check('negative control: a copy with no variable keeps the plain block text', (() => { const r = run('cp src/lib.rs src/other.rs'); return r.code === 2 && !r.text.includes(' names ') && r.text.includes('writes a source file by hand'); })());
  check('negative control: a delete with an unresolved variable keeps its own guidance', (() => { const r = run('rm "$S/lib.rs"'); return r.code === 2 && r.text.includes('Delete rule') && !r.text.includes('This rm names'); })());
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
