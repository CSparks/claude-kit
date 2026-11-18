// pre-write and data or scratchpad files (KIT-T1385): a tab-separated table, a log, and anything under the temp directory
// (the session scratchpad) are never linted for magic numbers; shipped code still is.
// Run: node hooks/pre-write-scratch.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
let fails = 0;
const check = (name, cond, detail = '') => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : `  ${detail}`}`); if (!cond) fails++; };
const env = { ...process.env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'pws-state-')), CLAUDE_KIT_HOLDERS_DIR: mkdtempSync(join(tmpdir(), 'pws-holders-')) };
const write = (file, content, cwd) => spawnSync(process.execPath, [HOOK], { cwd, env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: 'Write', tool_input: { file_path: file, content } }) });
const TABLE = 'test\tseconds\tstate\nworld_seed_contract\t412\tfail\nroads_cut\t97\tpass\n';

const scratch = mkdtempSync(join(tmpdir(), 'pws-scratch-'));
check('a tab-separated table in the scratchpad passes', write(join(scratch, 'triage.tsv'), TABLE, scratch).status === 0);
check('a scratch script in the scratchpad passes the magic-number lint', write(join(scratch, 'probe.mjs'), 'export function run() {\n  return wait(4711);\n}\n', scratch).status === 0);
check('a log file passes', write(join(scratch, 'run.log'), 'frame 1200 took 33 ms\n', scratch).status === 0);

// Shipped code lives outside the temp directory: a repo under the home directory.
const shipped = mkdtempSync(join(homedir(), '.kit-pws-'));
try {
  execFileSync('git', ['init', '-q'], { cwd: shipped });
  mkdirSync(join(shipped, '.ai'));
  const code = write(join(shipped, 'src.mjs'), 'export function run() {\n  return wait(4711);\n}\n', shipped);
  check('negative control: a magic number in shipped code is still refused', code.status === 2 && /magic-numbers/.test(code.stderr), code.stderr.slice(0, 300));
  const tsv = write(join(shipped, 'table.tsv'), TABLE, shipped);
  check('a .tsv data file in a repo is not linted either', tsv.status === 0, tsv.stderr.slice(0, 300));
} finally {
  rmSync(shipped, { recursive: true, force: true });
}

console.log(fails ? `\npre-write-scratch: ${fails} failed` : '\npre-write-scratch: all pass');
process.exit(fails ? 1 : 0);
