// run-tests.mjs — `npm test` entry (KIT-T467). Runs the `test:chain` script with
// CLAUDE_KIT_REGISTRY pointing at an empty throwaway registry, so no suite hydrates the
// maintainer's live project stores (that took minutes per step and tracked live-session load).
// A suite that needs projects registered sets its own CLAUDE_KIT_REGISTRY.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'kit-test-reg-'));
const registry = join(dir, 'registry.json');
writeFileSync(registry, '{}\n');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npm, ['run', 'test:chain', '--silent'], {
  stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, CLAUDE_KIT_REGISTRY: registry, BROKER_NO_AUTOSTART: '1' },
});
rmSync(dir, { recursive: true, force: true });
process.exit(r.status ?? 1);
