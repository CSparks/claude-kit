// Shared setup of the source-shell-gate-touch suites (KIT-T1088): a throwaway adopted repo with a few source files, and the
// calls that drive the gate. Each command runs the gate once; the suites are split so each finishes inside one foreground call.
//
//   touchHarness() -> { check, finish, run, expectPass, expectBlock, repo, scratch, HOOK }
//     expectPass(name, command, tool) / expectBlock(name, command, tool) -> one gate run, one check
//     finish() -> removes the repo, prints the totals and exits with the failure count

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnHookChecked } from './spawn-hook-checked.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const REASON_CHARS = 120;

export function touchHarness() {
  let fails = 0;
  let passes = 0;
  const check = (name, cond, detail = '') => {
    if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
  };
  const repo = mkdtempSync(join(tmpdir(), 'kit-touch-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'src', 'state'), { recursive: true });
  mkdirSync(join(repo, 'lib'), { recursive: true });
  mkdirSync(join(repo, 'src', 'lib'), { recursive: true });
  for (const f of ['src/state/AppState.h', 'src/a.cpp', 'src/b.cpp', 'src/ref.h', 'lib/only.h']) writeFileSync(join(repo, f), 'x\n');
  const scratch = join(tmpdir(), 'kit-touch-copy.cpp').replace(/\\/g, '/');

  const run = (command, tool = 'Bash', env = process.env) => spawnHookChecked(HOOK, { cwd: repo, env, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' });
  const isBlock = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);
  return {
    check, repo, scratch, HOOK, run,
    expectPass: (name, command, tool) => { const r = run(command, tool); check(`passes: ${name}`, r.status === 0, r.stderr.slice(0, REASON_CHARS)); },
    expectBlock: (name, command, tool) => { const r = run(command, tool); check(`blocks: ${name}`, isBlock(r), r.stderr.slice(0, REASON_CHARS)); },
    passes_: (command, tool) => run(command, tool).status === 0,
    finish: () => {
      rmSync(repo, { recursive: true, force: true });
      console.log(`\n${passes} passed, ${fails} failed`);
      process.exit(fails ? 1 : 0);
    },
  };
}
