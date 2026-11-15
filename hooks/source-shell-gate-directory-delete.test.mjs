#!/usr/bin/env node
// source-shell-gate-directory-delete.test.mjs — a delete whose operand is a directory is judged file by file for the source
// beneath it (KIT-T1246): another writer's file inside stops a subagent, the main thread passes once its writer ended,
// tracked source inside is refused, and a directory with no source or only build output passes.
// Run: node hooks/source-shell-gate-directory-delete.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = mkdtempSync(join(tmpdir(), 'kit-dirdel-state-'));
const holders = mkdtempSync(join(tmpdir(), 'kit-dirdel-holders-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
process.env.CLAUDE_KIT_TURN_STATE = state;
const { releaseAgent } = await import('./lib/checkout-holder.mjs');

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-dirdel-'));
const spawnHook = (name, payload) => spawnSync(process.execPath, [hook(name)], { cwd: repo, env: process.env, input: JSON.stringify(payload), encoding: 'utf8' });
const who = (session, agent) => ({ session_id: session, ...(agent ? { agent_id: agent, agent_type: 'worker' } : {}) });

// A Write as the tools leave it and the holder hook claims it; an ended writer is a stopped agent.
function toolWrite(rel, text, session, agent, { ended = false } = {}) {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  const input = { ...who(session, agent), tool_input: { file_path: join(repo, rel), content: text } };
  spawnHook('pre-write.mjs', input);
  writeFileSync(join(repo, rel), text);
  spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
  spawnHook('holder-beat.mjs', input);
  if (ended) releaseAgent(agent);
}
const sh = (command, session, agent = '', tool = 'Bash') => spawnHook('source-shell-gate.mjs', { ...who(session, agent), tool_name: tool, tool_input: { command } });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'kept'), { recursive: true });
  writeFileSync(join(repo, 'kept', 'tracked.rs'), 'fn tracked() {}\n');
  execFileSync('git', ['add', 'kept/tracked.rs'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: repo });

  toolWrite('theirs/src/lib.rs', 'fn a() {}\n', 'S1', 'A');
  const refused = sh('rm -rf theirs', 'S1', 'B');
  check('a subagent is refused a directory holding another agent\'s file', blocked(refused) && /theirs\/src\/lib\.rs/.test(refused.stderr), refused.stderr);
  check('the main thread is refused it while that agent is live', blocked(sh('rm -rf theirs', 'S1')));
  check('PowerShell Remove-Item -Recurse is judged the same way', blocked(sh('Remove-Item -Recurse -Force theirs', 'S1', 'B', 'PowerShell')));
  check('a delete after a cd into the parent is judged too', blocked(sh('cd theirs/.. && rm -rf theirs', 'S1', 'B')));
  check('the writing agent may remove its own directory', !blocked(sh('rm -rf theirs', 'S1', 'A')));

  releaseAgent('A');
  check('a subagent is still refused once the writer ended', blocked(sh('rm -rf theirs', 'S1', 'B')));
  check('the main thread removes the directory of an ended agent', !blocked(sh('rm -rf theirs', 'S1')));

  toolWrite('mixed/mine.rs', 'fn m() {}\n', 'S1', 'B');
  toolWrite('mixed/other.rs', 'fn o() {}\n', 'S1', 'C');
  check('one foreign file inside a directory refuses the delete for a subagent', blocked(sh('rm -rf mixed', 'S1', 'B')));

  check('tracked source inside a directory is refused', blocked(sh('rm -rf kept', 'S1')));
  check('the refusal of tracked source names git rm', /git rm -- [^\n]*kept\/tracked\.rs/.test(sh('rm -rf kept', 'S1').stderr));

  mkdirSync(join(repo, 'notes'), { recursive: true });
  writeFileSync(join(repo, 'notes', 'a.txt'), 'text\n');
  check('a directory with no source passes', !blocked(sh('rm -rf notes', 'S1', 'B')));
  mkdirSync(join(repo, 'target', 'debug'), { recursive: true });
  writeFileSync(join(repo, 'target', 'debug', 'build.rs'), 'fn b() {}\n');
  check('build output passes', !blocked(sh('rm -rf target', 'S1', 'B')));
  check('a missing directory passes', !blocked(sh('rm -rf nowhere', 'S1', 'B')));

  // A link to a directory is judged as its target (a trailing slash too).
  toolWrite('real/src/lib.rs', 'fn r() {}\n', 'S1', 'A');
  symlinkSync(join(repo, 'real'), join(repo, 'lnk'), process.platform === 'win32' ? 'junction' : 'dir');
  check('a link to a directory holding another agent\'s file is refused', blocked(sh('rm -rf lnk', 'S1', 'B')));
  check('a link with a trailing slash is refused too', blocked(sh('rm -rf lnk/', 'S1', 'B')));
  check('a link to a directory is judged for the main thread while its writer is live', blocked(sh('rm -rf lnk', 'S1')));

  // A nested repository inside a deleted directory is refused whole; git is never run inside it.
  const nestedRepo = (rel, { gitlink = false } = {}) => {
    const dir = join(repo, rel);
    mkdirSync(join(dir, '.ai'), { recursive: true });
    mkdirSync(join(dir, 'src'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: dir });
    if (gitlink) {
      writeFileSync(join(dir, 'seed.txt'), 'seed\n');
      execFileSync('git', ['add', 'seed.txt'], { cwd: dir });
      execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'seed'], { cwd: dir });
    }
    writeFileSync(join(dir, 'src', 'inner.rs'), 'fn i() {}\n');
  };
  const marker = join(state, 'fsmonitor-ran');
  nestedRepo('outer/clone');
  execFileSync('git', ['config', 'core.fsmonitor', `touch ${marker.replace(/\\/g, '/')}`], { cwd: join(repo, 'outer', 'clone') });
  const viaClone = sh('rm -rf outer', 'S1', 'B');
  check('a directory holding an untracked nested repository is refused, for every caller', blocked(viaClone) && blocked(sh('rm -rf outer', 'S1')), viaClone.stderr);
  check('the refusal names the nested directory and says to name each file', /outer\/clone\*[^]*name each file/.test(viaClone.stderr), viaClone.stderr);
  check('git is never run inside the nested repository', !existsSync(marker));
  nestedRepo('cont/sub', { gitlink: true });
  execFileSync('git', ['add', 'cont/sub'], { cwd: repo });
  check('a directory holding a submodule is refused for every caller', blocked(sh('rm -rf cont', 'S1', 'B')) && blocked(sh('rm -rf cont', 'S1')));
  check('a source file inside the submodule named alone is judged from its own root', blocked(sh('rm cont/sub/src/inner.rs', 'S1', 'B')));
  check('a submodule named as the operand is judged from its own root', blocked(sh('rm -rf cont/sub', 'S1', 'B')));
  nestedRepo('sub2', { gitlink: true });
  execFileSync('git', ['add', 'sub2'], { cwd: repo });
  rmSync(join(repo, 'sub2'), { recursive: true, force: true });
  mkdirSync(join(repo, 'sub2'));
  check('an uninitialised submodule directory is refused as well: the rule holds no exception', blocked(sh('rm -rf sub2', 'S1', 'B')));
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
  rmSync(holders, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
