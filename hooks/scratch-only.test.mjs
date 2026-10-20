#!/usr/bin/env node
// scratch-only.test.mjs — a patch worker's Write reaches the system temp dir only: pre-write refuses
// a Write by that agent anywhere else (the tree, the .ai store) and lets every other agent through
// to the normal checks; patch-worker counts as read-only for the one-writer rule.
// Run: node hooks/scratch-only.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratchOnlyViolation } from './lib/scratch-only.mjs';
import { readOnlyType } from './dispatch-readonly.mjs';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const tree = realpathSync.native(mkdtempSync(join(tmpdir(), 'kit-scratchonly-')));
const outside = process.platform === 'win32' ? 'D:\\dev\\some-repo\\src\\lib.rs' : '/home/dev/some-repo/src/lib.rs';
const run = (agentType, file) => spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ tool_name: 'Write', agent_type: agentType, tool_input: { file_path: file, content: '# envelope\n' } }),
  cwd: tree, encoding: 'utf8',
});

try {
  const envelope = join(tmpdir(), 'claude', 'scratchpad', 'env.patch');
  check('a patch worker may Write under the temp dir', scratchOnlyViolation('claude-kit:patch-worker', envelope) === null);
  check('the plugin prefix is optional', scratchOnlyViolation('patch-worker', envelope) === null);
  check('a patch worker is refused outside the temp dir', scratchOnlyViolation('claude-kit:patch-worker', outside) !== null);
  check('a patch worker is refused at the temp dir itself', scratchOnlyViolation('patch-worker', tmpdir()) !== null);
  check('another agent is never judged', scratchOnlyViolation('claude-kit:implementer', outside) === null);
  check('the main thread (no agent type) is never judged', scratchOnlyViolation(undefined, outside) === null);

  const blocked = run('claude-kit:patch-worker', outside);
  check('the hook blocks the patch worker outside the temp dir (exit 2)', blocked.status === 2, blocked.stderr);
  check('the message names the escape: the scratchpad and submit.mjs', /scratchpad/.test(blocked.stderr) && /submit\.mjs/.test(blocked.stderr));
  const inTree = run('claude-kit:patch-worker', join(tree, 'src', 'x.rs'));
  check('the hook blocks a patch worker Write into the working tree', inTree.status === 2);
  const scratch = run('claude-kit:patch-worker', envelope);
  check('the hook passes a patch worker Write of an envelope', scratch.status === 0, scratch.stderr);
  const other = run('claude-kit:implementer', join(tree, 'notes.txt'));
  check('the hook leaves other agents to the normal checks', other.status === 0, other.stderr);

  check('patch-worker counts as read-only for the one-writer rule', readOnlyType(tree, 'claude-kit:patch-worker') === true);
  check('an implementer does not', readOnlyType(tree, 'claude-kit:implementer') === false);
} finally {
  rmSync(tree, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
