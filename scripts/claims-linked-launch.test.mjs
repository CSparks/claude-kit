// claims.mjs run through a linked scripts folder (the sealed runtime's `current`) must still run and print (KIT-T1329).
// Run: node --test scripts/claims-linked-launch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_USAGE = 64;
const scriptsDir = fileURLToPath(new URL('.', import.meta.url));

function runVia(dir) {
  return spawnSync(process.execPath, [join(dir, 'claims.mjs'), '--release', 'someagent123'], { encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_HOLDERS_DIR: mkdtempSync(join(tmpdir(), 'cl-holders-')) } });
}

test('the real path prints a refusal and exits non-zero', () => {
  const r = runVia(scriptsDir);
  assert.equal(r.status, EXIT_USAGE);
  assert.match(r.stderr, /both are required/);
});

test('a linked scripts folder prints the same refusal instead of exiting silently', () => {
  const link = join(mkdtempSync(join(tmpdir(), 'cl-link-')), 'scripts');
  symlinkSync(scriptsDir, link, 'junction');
  const r = runVia(link);
  assert.equal(r.status, EXIT_USAGE);
  assert.match(r.stderr, /both are required/);
});
