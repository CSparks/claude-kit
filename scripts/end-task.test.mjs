#!/usr/bin/env node
// Tests for end-task.mjs — the programmatic close wrapper over `t status` (KIT-T029/KIT-T157).
// Shells the real CLI against a throwaway .ai fixture, since the whole surface under test is
// flag parsing + pass-through. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');
let pass = 0;
let fail = 0;
const fixtures = [];

// The CLI's refresh hydrates into a shared cache under CLAUDE_PLUGIN_ROOT; redirect it to a
// throwaway root (KIT-T142) so a fixture never replaces a real project's scope.
const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-endtask-plugin-'));
fixtures.push(PLUGIN_ROOT);
const REGISTRY = join(PLUGIN_ROOT, 'projects.json');
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }, null, 2));
const ENV = { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_KIT_REGISTRY: REGISTRY };

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

function project(status = 'review') {
  const d = mkdtempSync(join(tmpdir(), 'kit-endtask-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), `classifications:
  bug: { routes_to: tickets, priority: high }
statuses:
  flow: [todo, doing, review, done]
  human_only: [done]
  off_board: [superseded]
uat:
  default: required
history:
  archive_done_to: tickets/archive
ids:
  key: "S2"
  prefix: "S2-T"
  pad: 3
`);
  writeFileSync(join(d, '.ai', 'tickets', 'S2-T001-demo.md'), `---
id: S2-T001
title: demo
type: bug
status: ${status}
priority: high
links: []
---

## Description
d

## Acceptance Criteria
- [ ] x

## History
`);
  return d;
}

const read = (root) => readFileSync(join(root, '.ai', 'tickets', 'S2-T001-demo.md'), 'utf8');
function run(root, args) {
  try {
    return { out: execFileSync('node', [SCRIPT, ...args], { env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status ?? 1 };
  }
}

// --root: the flag an agent working another repo always passes. It was rejected outright, so
// the agent fell back to a hand-edit and the fixed_commit link was lost (KIT-T157).
const rooted = project('doing');
const r1 = run(rooted, ['S2-T001', 'review', '--note', 'closing note', '--root', rooted]);
ok('--root resolves the id in that repo (KIT-T157)', r1.code === 0 && /status: S2-T001 doing → review/.test(r1.out));
ok('--note lands as a History comment (KIT-T157)', /\(comment\) closing note/.test(read(rooted)));

// The fixing sha must be written on a SAME-STATUS call — review→review is the shape an agent
// reaches for when the ticket is already in review (KIT-T157/KIT-T190).
const same = project('review');
const r2 = run(same, ['S2-T001', 'review', '--note', 'already in review', '--fixed-commit', 'abc1234', '--root', same]);
ok('same-status call succeeds (KIT-T157)', r2.code === 0);
ok('same-status call still writes fixed_commit (KIT-T157)', /fixed_commit: abc1234/.test(read(same)));
ok('same-status call still stamps the note (KIT-T157)', /\(comment\) already in review/.test(read(same)));

// Negative controls: a bad sha is refused, and a human_only close without --human is refused.
const bad = project('review');
ok('a non-sha --fixed-commit is refused (KIT-T157)', run(bad, ['S2-T001', 'review', '--fixed-commit', 'nope!', '--root', bad]).code !== 0);
ok('the refused call wrote no fixed_commit (KIT-T157)', !/fixed_commit: /.test(read(bad)));
const gated = project('review');
ok('a human_only close without --human is refused (KIT-T157)', run(gated, ['S2-T001', 'done', '--root', gated]).code !== 0);
ok('--human passes the gate through (KIT-T157)', run(gated, ['S2-T001', 'done', '--human', '--root', gated]).code === 0);

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nend-task: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
