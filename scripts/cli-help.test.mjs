#!/usr/bin/env node
// Tests for the help path every kit CLI must answer (KIT-T184).
//
// The lived failure: `cap --help` CAPTURED an inbox item whose body was "--help" — asking a tool
// for usage wrote a file into the work store. `t --help` / `rem --help` answered "unknown
// subcommand '--help'", and `code-graph --help` dumped the entire graph as JSON. Agents discover
// these CLIs by asking them for usage, so this suite drives the REAL binaries and asserts the
// same contract for all of them: exit 0, usage on STDOUT, nothing written.
//
// ISOLATION (KIT-T142/T164): every child runs in a throwaway repo with CLAUDE_KIT_REGISTRY and
// CLAUDE_PLUGIN_ROOT pointed under a temp dir, so no live store or cache is reachable.

import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { isHelpFlag, wantsHelp, wantsHelpFirst } from './cli-help.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}

const tmpRoot = mkdtempSync(join(tmpdir(), 'kit-clihelp-'));
const repo = join(tmpRoot, 'repo');
mkdirSync(join(repo, '.ai', 'inbox'), { recursive: true });
writeFileSync(join(repo, '.ai', 'config.yml'),
  `classifications:\n  bug:     { routes_to: tickets, priority: high, blocking: never }\nids:\n  key: "TST"\n  pad: 3\n`);

const run = (script, args) => spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
  cwd: repo,
  encoding: 'utf8',
  env: {
    ...process.env,
    CLAUDE_KIT_REGISTRY: join(tmpRoot, 'no-registry.json'),
    CLAUDE_PLUGIN_ROOT: join(tmpRoot, 'plugin'),
  },
});

// ---- the flag predicate (pure) ----------------------------------------------
test('isHelpFlag accepts --help and -h only', () => {
  assert.ok(isHelpFlag('--help') && isHelpFlag('-h'));
  assert.ok(!isHelpFlag('help'), 'the bare word is a query verb for q, not a universal flag');
  assert.ok(!isHelpFlag('--helpful') && !isHelpFlag(undefined));
});
test('wantsHelp finds the flag anywhere (structured CLIs)', () => {
  assert.ok(wantsHelp(['new', '--help']));
  assert.ok(!wantsHelp(['new', 'bug', 'a title']));
});
test('wantsHelpFirst only fires in first position (free-text CLIs)', () => {
  assert.ok(wantsHelpFirst(['--help']));
  assert.ok(!wantsHelpFirst(['bug', '-h prints nothing']), 'prose containing a flag is still a capture');
  assert.ok(!wantsHelpFirst([]));
});

// ---- every CLI answers the flag the same way --------------------------------
for (const [script, expect] of [
  ['cap.mjs', /^usage: cap /],
  ['t.mjs', /^usage: t /],
  ['q.mjs', /^usage: q\.mjs /],
  ['rem.mjs', /^usage: rem /],
  ['code-graph.mjs', /^usage: code-graph /],
]) {
  for (const flag of ['--help', '-h']) {
    test(`${script} ${flag}: exit 0, usage on stdout`, () => {
      const r = run(script, [flag]);
      assert.equal(r.status, 0, `expected exit 0, got ${r.status} (stderr: ${r.stderr.trim()})`);
      assert.match(r.stdout, expect, 'usage goes to STDOUT so a pipe can read it');
      assert.doesNotMatch(r.stderr, /unknown (subcommand|verb|type|query)/,
        'help is not an unknown-argument error');
    });
  }
}

// ---- cap: the help path must not WRITE ---------------------------------------
test('cap --help writes nothing into the store (the KIT-T184 repro)', () => {
  const before = readdirSync(join(repo, '.ai', 'inbox'));
  run('cap.mjs', ['--help']);
  run('cap.mjs', ['-h']);
  assert.deepEqual(readdirSync(join(repo, '.ai', 'inbox')), before, 'inbox is untouched by a help call');
});
test('cap still captures free text that CONTAINS a help flag', () => {
  const r = run('cap.mjs', ['bug', 'the -h output is stale']);
  assert.equal(r.status, 0, `cap exited ${r.status}: ${r.stderr.trim()}`);
  const files = readdirSync(join(repo, '.ai', 'inbox'));
  assert.equal(files.length, 1, 'the capture landed');
  assert.match(r.stdout, /^captured \(bug\)/, 'and it was typed, not treated as usage');
});
// ---- the verbs a gate message sends agents to must exist in the help ---------
test('q --help documents the inbox verbs the store-grep gate points at (KIT-T238)', () => {
  const { stdout } = run('q.mjs', ['--help']);
  assert.match(stdout, /^\s{2}inbox \[scope\] \[--older-than Nd\]/m);
  assert.match(stdout, /^\s{2}confirmations \[scope\]/m);
});
test('code-graph --help documents the status verb (KIT-T236)', () =>
  assert.match(run('code-graph.mjs', ['--help']).stdout, /^\s{2}status\b/m));

test('code-graph --help does not build the graph (no JSON dump)', () => {
  const { stdout } = run('code-graph.mjs', ['--help']);
  assert.doesNotMatch(stdout, /"files":/, 'the whole-graph dump is gone from the help path');
});

rmSync(tmpRoot, { recursive: true, force: true });

console.log(`\ncli-help: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
