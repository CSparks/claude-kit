#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexFilePayloads, formatCodexSuccess, parsePatchFiles } from './compat-run.mjs';

let pass = 0;
let fail = 0;

function ok(name, condition) {
  if (condition) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}`);
  }
}

const patch = `*** Begin Patch
*** Update File: src/one.mjs
@@
-const oldValue = 1;
+const newValue = 2;
*** Add File: src/two.mjs
+export const two = true;
*** Update File: src/old-name.mjs
*** Move to: src/new-name.mjs
@@
+export const moved = true;
*** End Patch`;

const files = parsePatchFiles(patch, 'C:/repo');
ok('patch parser finds update, add, and both sides of move', files.length === 4);
ok('patch parser resolves paths from hook cwd', files[0].filePath.replace(/\\/g, '/').endsWith('/repo/src/one.mjs'));
ok('patch parser keeps only added content', files[0].content === 'const newValue = 2;');

const payloads = codexFilePayloads({
  cwd: 'C:/repo',
  hook_event_name: 'PreToolUse',
  tool_name: 'apply_patch',
  tool_input: { command: patch },
}, 'pre-write.mjs');
ok('file hook fans one Codex patch out per file', payloads.length === 4);
ok('fanout provides Claude-compatible file_path', payloads[1].tool_input.file_path.endsWith('two.mjs'));
ok('non-file hook keeps the original payload', codexFilePayloads(payloads[0], 'commit-gate.mjs')[0] === payloads[0]);

const pre = JSON.parse(formatCodexSuccess('PreToolUse', [], ['remember this']));
ok('PreToolUse advisory becomes additionalContext', pre.hookSpecificOutput.additionalContext === 'remember this');
const stop = JSON.parse(formatCodexSuccess('Stop', ['finish the rundown'], []));
ok('Stop stdout requests a continuation', stop.decision === 'block' && stop.reason === 'finish the rundown');
const stopLog = JSON.parse(formatCodexSuccess('Stop', [], ['cache refreshed']));
ok('Stop stderr is informational only', !stopLog.decision && stopLog.systemMessage === 'cache refreshed');
const existing = formatCodexSuccess('PreToolUse', ['{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}'], []);
ok('already-structured hook output passes through', JSON.parse(existing).hookSpecificOutput.hookEventName === 'PreToolUse');

const repo = mkdtempSync(join(tmpdir(), 'compat-run-'));
mkdirSync(join(repo, '.ai'), { recursive: true });
mkdirSync(join(repo, 'src'), { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: repo });
const runner = fileURLToPath(new URL('./compat-run.mjs', import.meta.url));
const pluginRoot = fileURLToPath(new URL('..', import.meta.url));
const blocked = spawnSync(process.execPath, [runner, 'pre-write.mjs'], {
  cwd: repo,
  env: { ...process.env, PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_ROOT: pluginRoot },
  input: JSON.stringify({
    cwd: repo,
    hook_event_name: 'PreToolUse',
    tool_name: 'apply_patch',
    tool_input: {
      command: '*** Begin Patch\n*** Add File: src/example.mjs\n+doThing(12345);\n*** End Patch',
    },
  }),
  encoding: 'utf8',
});
ok('Codex apply_patch reaches the existing pre-write gate', blocked.status === 2);
ok('Codex pre-write block preserves the original reason', blocked.stderr.includes('magic-numbers'));

console.log(`\ncompat-run: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
