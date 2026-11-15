// Shared setup of the source-shell-gate-discard suites (KIT-T1163, KIT-T1266): a seeded throwaway repo, the checkout's registry
// of live writers, and the calls that drive the gate. The suites are split so that each finishes inside one foreground call.
//
//   discardHarness() -> { check, finish, git, top, run, passes_, stops, stops_ps, blocked, toolWrite, freshHolders, seed }
//     seed({ aliases }) -> creates the repo, the files of each writer and, with `aliases`, the git aliases the sweeps name
//     finish() -> removes what the harness made, prints the totals and exits with the failure count

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnHookChecked } from './spawn-hook-checked.mjs';
import { ALIASES } from './source-shell-gate-discard-sweeps.mjs';

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

export function discardHarness() {
  let fails = 0;
  let passes = 0;
  const check = (name, cond, detail = '') => {
    if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
  };

  const state = mkdtempSync(join(tmpdir(), 'kit-gitdel-state-'));
  const repo = mkdtempSync(join(tmpdir(), 'kit-gitdel-'));
  const holderDirs = [];
  const env = { ...process.env, CLAUDE_KIT_TURN_STATE: state };
  // An empty registry of the checkout's live writers, for the hook children and this process alike.
  const freshHolders = () => {
    const dir = mkdtempSync(join(tmpdir(), 'kit-gitdel-holders-'));
    holderDirs.push(dir);
    env.CLAUDE_KIT_HOLDERS_DIR = dir;
    process.env.CLAUDE_KIT_HOLDERS_DIR = dir;
  };
  freshHolders();
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const spawnHook = (name, payload) => spawnHookChecked(hook(name), { cwd: repo, env, input: JSON.stringify(payload), encoding: 'utf8' });
  const who = (session, agent) => ({ ...(session ? { session_id: session } : {}), ...(agent ? { agent_id: agent } : {}) });
  const toolWrite = (rel, text, session, agent = '') => {
    const input = { ...who(session, agent), tool_input: { file_path: join(repo, rel), content: text } };
    spawnHook('pre-write.mjs', input);
    writeFileSync(join(repo, rel), text);
    spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
  };
  const run = (command, session, agent = '', tool = 'Bash') => spawnHook('source-shell-gate.mjs', { ...who(session, agent), tool_name: tool, tool_input: { command } });
  const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);
  const passes_ = (command, session = 'S1', agent = '') => !blocked(run(command, session, agent));
  const stops = (command, session = 'S1', agent = '') => blocked(run(command, session, agent));
  const stops_ps = (command) => blocked(run(command, 'S1', '', 'PowerShell'));
  const harness = { check, git, run, passes_, stops, stops_ps, blocked, toolWrite, freshHolders, top: '' };

  harness.seed = ({ aliases = false } = {}) => {
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    mkdirSync(join(repo, '.ai'), { recursive: true });
    mkdirSync(join(repo, 'sub'), { recursive: true });
    writeFileSync(join(repo, 'sub', 'keep.txt'), 'x\n');
    for (const name of ['tracked.rs', 'dirty.rs']) writeFileSync(join(repo, name), `fn ${name.slice(0, -3)}() {}\n`);
    git('add', '.');
    git('commit', '-q', '-m', 'seed');
    harness.top = git('rev-parse', '--show-toplevel');
    toolWrite('mine.rs', 'fn mine() {}\n', 'S1');
    toolWrite('theirs.rs', 'fn theirs() {}\n', 'S2');
    toolWrite('dirty.rs', 'fn dirty() { 1 }\n', 'S1');
    writeFileSync(join(repo, 'never-ledgered.rs'), 'fn n() {}\n');
    writeFileSync(join(repo, 'notes.txt'), 'n\n');
    if (aliases) for (const [alias, value] of ALIASES) git('config', `alias.${alias}`, value);
  };

  harness.finish = () => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(state, { recursive: true, force: true });
    for (const dir of holderDirs) rmSync(dir, { recursive: true, force: true });
    console.log(`\n${passes} passed, ${fails} failed`);
    process.exit(fails ? 1 : 0);
  };
  return harness;
}
