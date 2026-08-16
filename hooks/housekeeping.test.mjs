// Test for the CLAUDE_CODE_SUBAGENT_MODEL SessionStart nag (KIT-T220): warn when the env var
// is set (it overrides the Agent-tool model param and every frontmatter pin), silent when not.
// Run: node hooks/housekeeping.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./housekeeping.mjs', import.meta.url));
let failures = 0;
let count = 0;

function ok(name, cond) {
  count++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const repo = mkdtempSync(join(tmpdir(), 'hk-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai', 'tickets'), { recursive: true });

function run(env) {
  const base = { ...process.env };
  delete base.CLAUDE_CODE_SUBAGENT_MODEL;
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: repo,
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
    env: { ...base, ...env },
  });
  return { code: r.status, out: r.stdout || '' };
}

const set = run({ CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' });
ok('env set: nag fires', /SUBAGENT MODEL OVERRIDE/.test(set.out));
ok('env set: names the value', /CLAUDE_CODE_SUBAGENT_MODEL=haiku/.test(set.out));
ok('env set: names the consequence', /dispatch ladder/.test(set.out));
ok('env set: never blocks', set.code === 0);

const unset = run({});
ok('env unset: silent (negative control)', !/SUBAGENT MODEL OVERRIDE/.test(unset.out));
ok('env unset: exits 0', unset.code === 0);

console.log(`\n${count - failures}/${count} passed`);
process.exit(failures ? 1 : 0);
