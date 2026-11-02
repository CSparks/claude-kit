// Shared fixtures for the dispatch-guard check tests (dispatch-guard.test.mjs and the dispatch-*.test.mjs files).
// Importing it isolates the holder registry in a throwaway directory and builds a fresh-evidence capability-table kit.
//
//   makeRepo({ adopt, cargo }) -> a git repo, adopted (.ai/) by default, optionally a Cargo workspace
//   roster(dir, rows)          -> writes .ai/agents.jsonl rows (objects or raw lines); returns dir
//   inFlightRow(ageMs, extra)  -> a live roster row
//   ignoreFile(dir, ...ids)    -> a .claude-kit-ignore.yaml excluding each check id everywhere
//   transcript(dir, name, m)   -> a session transcript whose latest assistant turn ran on model `m`
//   runRaw(dir, stdin)         -> { code, err } of the hook on raw stdin
//   run(dir, toolInput, tp)    -> runRaw with a well-formed Agent payload; `jobless: true` keeps the job token off the brief
//   expect(name, actual, want) -> prints PASS/FAIL and counts failures; finish() exits non-zero on any
//   gitTop(dir)                -> the repo's top-level path

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { fixtureKit, isoDaysAgo } from './test-harness.mjs';

export const FRESH_KIT = fixtureKit(isoDaysAgo(0));
process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'dg-holders-'));
export const HOOK = fileURLToPath(new URL('./dispatch-guard.mjs', import.meta.url));
export const HOURS = 60 * 60 * 1000;
let failures = 0;

export function makeRepo({ adopt = true, cargo = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai'), { recursive: true });
  if (cargo) writeFileSync(join(dir, 'Cargo.toml'), '[workspace]\nmembers = ["game"]\n');
  return dir;
}

export const gitTop = (dir) => execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).trim();

export function roster(dir, rows) {
  writeFileSync(join(dir, '.ai', 'agents.jsonl'), rows.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n');
  return dir;
}

export function inFlightRow(agesMs = 0, extra = {}) {
  return { ts: new Date(Date.now() - agesMs).toISOString(), id: 'agent-live', status: 'in-flight', task: 'refactor the mesh factory', scope: 'refactorer', ...extra };
}

export function ignoreFile(dir, ...checkIds) {
  writeFileSync(join(dir, '.claude-kit-ignore.yaml'), checkIds.map((id) => `${id}:\n  - "**"\n`).join(''));
  return dir;
}

export function transcript(dir, name, model) {
  const file = join(dir, `${name}.jsonl`);
  const rows = [
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    JSON.stringify({ type: 'assistant', message: { model, content: [] } }),
  ];
  writeFileSync(file, rows.join('\n') + '\n');
  return file;
}

export function runRaw(dir, stdin) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_ALLOW_FABLE: '', CLAUDE_PLUGIN_ROOT: '', CLAUDE_KIT_LADDER_ROOT: process.env.DG_LADDER_ROOT || FRESH_KIT },
  });
  return { code: r.status, err: r.stderr || '' };
}

// The job token, a model override and an escalate keep dispatch-job and dispatch-escalation quiet for the other checks.
export function run(dir, toolInput, transcriptPath) {
  const input = toolInput.jobless ? { ...toolInput, jobless: undefined } : { ...toolInput, prompt: `${toolInput.prompt || ''} [job: fix] [model-override: fixture] [escalate: fixture]` };
  return runRaw(dir, JSON.stringify({ tool_name: 'Agent', tool_input: input, transcript_path: transcriptPath }));
}

export function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

export const finish = () => process.exit(failures ? 1 : 0);
