// t-refresh.test.mjs — a mutation never waits on a wedged board indexer (KIT-T536): `t session
// --append` under pipes returns within the refresh timeout with the line written; control: a
// healthy indexer runs and the same call succeeds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const T = join(import.meta.dirname, 't.mjs');
const KIT_AI = join(import.meta.dirname, '..', '.ai');

function store() {
  const root = mkdtempSync(join(tmpdir(), 'kit-refresh-'));
  for (const s of ['tickets', 'epics', 'requests', 'notes', 'questions']) {
    mkdirSync(join(root, '.ai', s), { recursive: true });
    if (s !== 'tickets') copyFileSync(join(KIT_AI, s, '_TEMPLATE.md'), join(root, '.ai', s, '_TEMPLATE.md'));
  }
  writeFileSync(join(root, '.ai', 'config.yml'), 'classifications:\n  bug: { routes_to: tickets, priority: high }\nstatuses:\n  flow: [todo, doing, review, done]\nuat:\n  default: none\nids:\n  key: "RFR"\n  pad: 3\n');
  writeFileSync(join(root, '.ai', 'SESSION.md'), '# SESSION\n\n## Current state\n\nold\n');
  writeFileSync(join(root, 'line.txt'), 'a new line');
  return root;
}

function appendSession(root, env) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [T, 'session', '--file', join(root, 'line.txt'), '--append', '--root', root], { encoding: 'utf8', timeout: 90_000, env: { ...process.env, CLAUDE_KIT_REGISTRY: join(root, 'none.json'), ...env } });
  return { r, ms: Date.now() - t0 };
}

test('t session --append returns at the refresh timeout when the indexer hangs, line written', () => {
  const root = store();
  const hang = join(root, 'hang.mjs');
  writeFileSync(hang, 'setInterval(() => {}, 1000);\n');
  try {
    const { r, ms } = appendSession(root, { CLAUDE_KIT_INDEXER: hang, CLAUDE_KIT_REFRESH_TIMEOUT_MS: '1500' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(ms < 30_000, `took ${ms} ms`);
    assert.match(readFileSync(join(root, '.ai', 'SESSION.md'), 'utf8'), /a new line/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('control: a healthy indexer runs to completion and the call succeeds', () => {
  const root = store();
  const ran = join(root, 'ran.txt').split(String.fromCharCode(92)).join('/');
  const ok = join(root, 'ok.mjs');
  writeFileSync(ok, `process.getBuiltinModule("node:fs").writeFileSync("${ran}", "x");`);
  try {
    const { r } = appendSession(root, { CLAUDE_KIT_INDEXER: ok, CLAUDE_KIT_REFRESH_TIMEOUT_MS: '30000' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(join(root, 'ran.txt'), 'utf8'), 'x', 'the indexer ran');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
