#!/usr/bin/env node
// cap-ruling.test.mjs — a capture that quotes the maintainer prints the promotion demand (KIT-T938); a plain capture,
// a bug quoting error text and a kit ticket print none. Drives the real CLI in a throwaway adopted repo.
// Run: node scripts/cap-ruling.test.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, reporter } from '../hooks/test-harness.mjs';
import { unpromotedRulings } from '../hooks/lib/inbox-rulings.mjs';

const { ok, done } = reporter('cap-ruling');
const CAP = fileURLToPath(new URL('./cap.mjs', import.meta.url));
const CONFIG = 'classifications:\n  bug:     { routes_to: tickets, priority: high, blocking: never }\nids:\n  key: "RUL"\n  prefix: "RUL-T"\n  pad: 3\n';

const root = mkdtempSync(join(tmpdir(), 'kit-cap-ruling-'));
mkdirSync(join(root, '.ai', 'inbox'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'), CONFIG);
const cap = (args) => execFileSync(process.execPath, [CAP, ...args], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, KIT_USER: 'chris', CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-registry-for-cap-ruling-test.json') },
});

try {
  const verbatim = cap(["note on song mode (Chris 2026-11-09, verbatim): 'A scene owns its values and keeps its metadata.'"]);
  ok('a verbatim capture prints the ruling demand with its id and the promote command', /RULING CAPTURED: 2026-/.test(verbatim) && /t decide --file <draft\.md> --from 2026-/.test(verbatim) && /THIS turn/.test(verbatim));
  ok('the demand names the cheap clear for a false match', /t triage 2026-\S+ --skip/.test(verbatim));
  ok('the captured note is listed as an un-promoted ruling', unpromotedRulings(root, { user: 'chris' }).length === 1);
  ok('a speaker said capture prints the demand', /RULING CAPTURED/.test(cap(['Chris said the roles modal opens from the toolbar'])));
  ok('negative control: an untyped idea prints no demand', !/RULING CAPTURED/.test(cap(['form double-submits on slow network'])));
  ok('negative control: a bug quoting error text prints no demand', !/RULING CAPTURED/.test(cap(['bug', 'console says "could not open the project file for writing" on save'])));
  ok('negative control: --done prints no demand', !/RULING CAPTURED/.test(cap(['--done', 'Chris said it was fixed, verbatim'])));
} finally { cleanup(); }
done();
