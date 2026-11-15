#!/usr/bin/env node
// source-shell-gate-main-thread.test.mjs — the main thread removes an untracked source file whose writer is no longer
// live with a plain `rm <path>` (KIT-T1246); a live writer's file, a subagent's delete, tracked source and the git
// discard verbs stay refused, and each refusal names the one way out.
// Run: node hooks/source-shell-gate-main-thread.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = mkdtempSync(join(tmpdir(), 'kit-mtdel-state-'));
const holders = mkdtempSync(join(tmpdir(), 'kit-mtdel-holders-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
process.env.CLAUDE_KIT_TURN_STATE = state;
const { releaseAgent, releaseTree, claimFile } = await import('./lib/checkout-holder.mjs');

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-mtdel-'));
const spawnHook = (name, payload) => spawnSync(process.execPath, [hook(name)], { cwd: repo, env: process.env, input: JSON.stringify(payload), encoding: 'utf8' });
const who = (session, agent) => ({ session_id: session, ...(agent ? { agent_id: agent, agent_type: 'worker' } : {}) });
const HOURS_MS = 60 * 60 * 1000;
const ENDED_AGO_MS = 3 * HOURS_MS;

// A Write as the tools leave it: pre-write predicts, the file lands, PostToolUse confirms, the holder hook claims it.
// An ended writer is a stopped agent (SubagentStop releases it) or a main thread silent past its window.
function toolWrite(rel, text, session, agent = '', { ended = false } = {}) {
  const input = { ...who(session, agent), tool_input: { file_path: join(repo, rel), content: text } };
  spawnHook('pre-write.mjs', input);
  writeFileSync(join(repo, rel), text);
  spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
  if (ended && !agent) {
    const tree = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repo, encoding: 'utf8' }).trim();
    claimFile({ tree, session, rel, now: Date.now() - ENDED_AGO_MS });
    return;
  }
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
  writeFileSync(join(repo, 'tracked.rs'), 'fn tracked() {}\n');
  execFileSync('git', ['add', 'tracked.rs'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: repo });

  toolWrite('ended-agent.rs', 'fn a() {}\n', 'S1', 'A', { ended: true });
  check('the main thread deletes the untracked file of an ended agent', !blocked(sh('rm ended-agent.rs', 'S1')));
  check('the main thread of another session deletes it too', !blocked(sh('rm ended-agent.rs', 'S9')));
  check('PowerShell Remove-Item passes the same way', !blocked(sh('Remove-Item ended-agent.rs', 'S1', '', 'PowerShell')));

  toolWrite('ended-main.rs', 'fn m() {}\n', 'S2', '', { ended: true });
  check('the main thread deletes the file of a main thread silent past its window', !blocked(sh('rm ended-main.rs', 'S1')));

  writeFileSync(join(repo, 'no-tool-wrote.rs'), 'fn n() {}\n');
  check('the main thread deletes an untracked file no tool wrote while no writer is live', !blocked(sh('rm no-tool-wrote.rs', 'S1')));

  toolWrite('subagent-target.rs', 'fn t() {}\n', 'S1', 'A', { ended: true });
  const bySubagent = sh('rm subagent-target.rs', 'S1', 'B');
  check('a subagent is refused another agent\'s file even when that writer ended', blocked(bySubagent));
  check('a subagent\'s block names the main thread and its exact command', /main thread[^\n]*`rm subagent-target\.rs`/.test(bySubagent.stderr), bySubagent.stderr);
  const bySubagentUnrecorded = sh('rm no-tool-wrote.rs', 'S1', 'B');
  check('a subagent is refused a file no tool wrote', blocked(bySubagentUnrecorded) && /main thread[^\n]*`rm no-tool-wrote\.rs`/.test(bySubagentUnrecorded.stderr));
  check('the subagent that wrote a file may still delete it', !blocked(sh('rm subagent-target.rs', 'S1', 'A')));

  toolWrite('live-agent.rs', 'fn l() {}\n', 'S1', 'C');
  const byMain = sh('rm live-agent.rs', 'S1');
  check('the main thread is refused a live agent\'s file', blocked(byMain));
  check('the block names the live writer and the plain rm that passes once it stops', /agent C[^\n]*live[^]*`rm live-agent\.rs`/.test(byMain.stderr), byMain.stderr);
  check('a subagent is refused the live agent\'s file', blocked(sh('rm live-agent.rs', 'S1', 'B')));

  toolWrite('live-other-session.rs', 'fn o() {}\n', 'S3');
  check('the main thread is refused the file of another live session', blocked(sh('rm live-other-session.rs', 'S1')));

  writeFileSync(join(repo, 'while-others-live.rs'), 'fn w() {}\n');
  check('an unattributed file stays refused while another writer is live', blocked(sh('rm while-others-live.rs', 'S1')));

  releaseAgent('C');
  releaseTree(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repo, encoding: 'utf8' }).trim(), 'S3');
  toolWrite('live-other-session.rs', 'fn o() {}\n', 'S3', '', { ended: true });
  check('once the live writers stop the same delete passes', !blocked(sh('rm live-agent.rs', 'S1')) && !blocked(sh('rm while-others-live.rs', 'S1')));

  toolWrite('tracked.rs', 'fn tracked() { 1 }\n', 'S2', 'D', { ended: true });
  const tracked = sh('rm tracked.rs', 'S1');
  check('tracked source stays refused and names git rm', blocked(tracked) && /git rm -- tracked\.rs/.test(tracked.stderr));

  toolWrite('discard-target.rs', 'fn d() {}\n', 'S2', 'E', { ended: true });
  check('a git discard verb of an ended writer\'s file stays refused', blocked(sh('git clean -f -- discard-target.rs', 'S1')));
  check('rm of it passes', !blocked(sh('rm discard-target.rs', 'S1')));
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
  rmSync(holders, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
