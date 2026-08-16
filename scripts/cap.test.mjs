#!/usr/bin/env node
// Tests for cap.mjs — the sub-second capture script.
// Drives the REAL CLI in a throwaway adopted temp repo so the full arg-parsing +
// file-write path is exercised end-to-end. exit 0 = all pass. (KIT-T013)

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import * as harness from '../hooks/test-harness.mjs';

const CAP = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

// Minimal config.yml — just enough for classificationKeys() to recognise `bug`. The id KEY is a
// parameter because the cross-project tests need two projects that are distinguishable by key.
const MIN_CONFIG = (key) => `classifications:
  bug:     { routes_to: tickets, priority: high, blocking: when-touching-active }
  feature: { routes_to: backlog, priority: medium, blocking: never }
ids:
  key: "${key}"
  prefix: "${key}-T"
  pad: 3
`;

function makeRepo(key = 'TST') {
  const root = mkdtempSync(join(tmpdir(), 'kit-cap-'));
  fixtures.push(root);
  mkdirSync(join(root, '.ai', 'inbox'),   { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), MIN_CONFIG(key));
  return root;
}

function cap(repo, args) {
  return execFileSync(process.execPath, [CAP, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-registry-for-cap-test.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// --------------------------------------------------------------------------
// 1. cap --done (untyped) writes to resolved/, NOT inbox/
// --------------------------------------------------------------------------
console.log('\ncap --done (untyped) writes to resolved/');
{
  const repo = makeRepo();
  cap(repo, ['--done', 'already fixed the moon']);
  const resolvedFiles = existsSync(join(repo, '.ai', 'resolved'))
    ? readdirSync(join(repo, '.ai', 'resolved')) : [];
  const inboxFiles = readdirSync(join(repo, '.ai', 'inbox'));
  ok('resolved/ dir created', existsSync(join(repo, '.ai', 'resolved')));
  ok('one file in resolved/', resolvedFiles.length === 1);
  ok('inbox stays empty', inboxFiles.length === 0);

  const { readFileSync } = await import('node:fs');
  const content = readFileSync(join(repo, '.ai', 'resolved', resolvedFiles[0]), 'utf8');
  ok('file contains the text', content.includes('already fixed the moon'));
  ok('file contains resolved: timestamp', /^resolved:\s*\d{4}-\d{2}-\d{2}T/m.test(content));
  ok('no type prefix (untyped)', !content.startsWith('('));

  const fname = resolvedFiles[0];
  ok('filename matches YYYY-MM-DD-HHMM-slug pattern', /^\d{4}-\d{2}-\d{2}-\d{4}-/.test(fname));
}

// --------------------------------------------------------------------------
// 2. cap --done <type> <text> records type in the resolved record
// --------------------------------------------------------------------------
console.log('\ncap --done bug records type=bug in the resolved record');
{
  const repo = makeRepo();
  cap(repo, ['--done', 'bug', 'fixed login crash']);
  const resolvedFiles = readdirSync(join(repo, '.ai', 'resolved'));
  ok('resolved file written', resolvedFiles.length === 1);

  const { readFileSync } = await import('node:fs');
  const content = readFileSync(join(repo, '.ai', 'resolved', resolvedFiles[0]), 'utf8');
  ok('type prefix present', content.startsWith('(bug)'));
  ok('text present', content.includes('fixed login crash'));
  ok('resolved: timestamp present', /^resolved:\s*\d{4}-\d{2}-\d{2}T/m.test(content));
}

// --------------------------------------------------------------------------
// 3. cap (no --done) still writes to inbox/ exactly as before
// --------------------------------------------------------------------------
console.log('\ncap without --done still writes to inbox/');
{
  const repo = makeRepo();
  cap(repo, ['normal capture without done flag']);
  const inboxFiles = readdirSync(join(repo, '.ai', 'inbox'));
  const resolvedExists = existsSync(join(repo, '.ai', 'resolved'));
  ok('one file in inbox/', inboxFiles.length === 1);
  ok('resolved/ not created', !resolvedExists);

  const { readFileSync } = await import('node:fs');
  const content = readFileSync(join(repo, '.ai', 'inbox', inboxFiles[0]), 'utf8');
  ok('text in inbox file', content.includes('normal capture without done flag'));
  ok('no resolved: field in inbox file', !/^resolved:/m.test(content));
}

// --------------------------------------------------------------------------
// 4. cap --done with type AND plain text in a single arg
// --------------------------------------------------------------------------
console.log('\ncap --done with quoted text works');
{
  const repo = makeRepo();
  cap(repo, ['--done', 'patched the floodgate']);
  const resolvedFiles = readdirSync(join(repo, '.ai', 'resolved'));
  ok('resolved file present for quoted text', resolvedFiles.length === 1);
}

// --------------------------------------------------------------------------
// 5. KIT-T186 — a capture naming ANOTHER project warns BEFORE the write, and the
//    receipt itself carries the ambiguity. (Routing still obeys KIT-T067: cwd owns
//    the write; this only proposes.)
// --------------------------------------------------------------------------
console.log('\ncap warns about a cross-project capture before it writes');
{
  const { openSync, closeSync, readFileSync, writeFileSync: write } = await import('node:fs');
  const cwdRepo = makeRepo('CWD');       // the project the capture lands in
  const other = makeRepo('OTH');         // a registered project the TEXT names
  const registry = join(other, 'registry.json');
  write(registry, JSON.stringify({
    dataRoot: null,
    projects: { 'cwd-project': cwdRepo, 'other-project': other },
  }));

  // Both streams share ONE fd, so the file records the real emission ORDER — the whole point
  // of the fix (the warning used to trail a receipt that already read "captured").
  const logPath = join(other, 'cap-order.log');
  const fd = openSync(logPath, 'w');
  execFileSync(process.execPath, [CAP, 'bug', 'the other-project build is broken'], {
    cwd: cwdRepo,
    env: { ...process.env, CLAUDE_KIT_REGISTRY: registry },
    stdio: ['ignore', fd, fd],
  });
  closeSync(fd);
  const log = readFileSync(logPath, 'utf8');

  const warnAt = log.indexOf('cap: this text also names');
  const receiptAt = log.indexOf('captured (bug) ->');
  ok('the warning names the other project', warnAt >= 0 && /other-project/.test(log));
  ok('the warning suggests the exact --project re-run for the NAMED project', /re-run: cap --project oth/.test(log));
  ok('the warning is emitted BEFORE the receipt', warnAt >= 0 && receiptAt > warnAt);
  ok('the receipt itself carries the ambiguity marker', /captured \(bug\) -> .*\[also names other-project/.test(log));
  ok('the capture still landed in the cwd project (KIT-T067 routing unchanged)',
    readdirSync(join(cwdRepo, '.ai', 'inbox')).length === 1);
  ok('the other project was NOT written to', readdirSync(join(other, '.ai', 'inbox')).length === 0);
}

// --------------------------------------------------------------------------
// 6. KIT-T186 — outside every adopted repo, cap fails loudly and lists the targets
// --------------------------------------------------------------------------
console.log('\ncap outside any repo names the projects it could capture into');
{
  const { writeFileSync: write } = await import('node:fs');
  const home = mkdtempSync(join(tmpdir(), 'kit-cap-norepo-'));
  fixtures.push(home);
  const target = makeRepo('TGT');
  const registry = join(home, 'registry.json');
  write(registry, JSON.stringify({ dataRoot: null, projects: { 'a-target': target } }));

  let status = 0;
  let stderr = '';
  try {
    execFileSync(process.execPath, [CAP, 'bug', 'nowhere to put this'], {
      cwd: home,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_KIT_REGISTRY: registry },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    status = e.status;
    stderr = String(e.stderr);
  }
  ok('exits non-zero rather than capturing nowhere', status !== 0);
  ok('says plainly that the cwd is not an adopted repo', /not an adopted repo/.test(stderr));
  ok('lists the registered projects with their id keys', /Registered: a-target \(tgt\)/.test(stderr));
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// KIT-T067 — cross-project targeting: an explicit target WINS over the cwd walk, the receipt
// always names the resolved project, and text that obviously names another project is
// PROPOSED rather than routed. The fixture pairs a local repo (the cwd) with a CENTRAL-ONLY
// project under dataRoot, so the cross-project route is genuine and not a sibling repo.
// --------------------------------------------------------------------------
{
  const creg = join(harness.tmpDir('kit-creg-'), 'r.json');
  const cwdRepo = harness.repo(); // the shell sits here (the misroute origin)
  mkdirSync(join(cwdRepo, '.ai'), { recursive: true });
  const cfg = 'ids:\n  key: "KIT"\nclassifications:\n  bug:\n    routes_to: tickets\n  feature:\n    routes_to: tickets\n  decision:\n    routes_to: decisions\n';
  writeFileSync(join(cwdRepo, '.ai', 'config.yml'), cfg);
  const dataRoot = harness.tmpDir('kit-cdata-');
  const hodAi = join(dataRoot, 'projects', 'hustle-or-die');
  mkdirSync(join(hodAi, 'inbox'), { recursive: true });
  writeFileSync(join(hodAi, 'config.yml'), cfg.replace('"KIT"', '"HOD"'));
  writeFileSync(creg, JSON.stringify({ dataRoot, projects: { 'claude-kit': cwdRepo } }));

  const capture = (args) => harness.script('cap.mjs', args, cwdRepo, { CLAUDE_KIT_REGISTRY: creg });
  const hodFiles = () => readdirSync(join(hodAi, 'inbox')).filter((f) => f.endsWith('.md'));
  const kitDir = join(cwdRepo, '.ai', 'inbox');
  const kitFiles = () => (existsSync(kitDir) ? readdirSync(kitDir).filter((f) => f.endsWith('.md')) : []);
  // Read the captured text from the path the RECEIPT names — robust to same-minute timestamp
  // collisions, where a "newest by sort" proxy picks the wrong sibling.
  const capturedText = (dir, out) => {
    const m = out.match(/-> [^/]+\/inbox\/(\S+\.md)/);
    return m ? readFileSync(join(dir, m[1]), 'utf8') : '';
  };

  let r = capture(['--project', 'hod', 'feature', 'graded roads meet terrain']);
  ok('cap: --project flag wins over cwd-walk (routes to the named project)', r.code === 0 && hodFiles().length === 1);
  ok('cap: receipt names the destination project (cross-project, caught in 3 words)', /captured \(feature\) -> hustle-or-die\/inbox\//.test(r.out));

  r = capture(['hod:', 'roads are graded not raw terrain']);
  ok('cap: `name:` prefix routes to the named project', r.code === 0 && hodFiles().length === 2 && /-> hustle-or-die\/inbox\//.test(r.out));
  ok('cap: the resolved `name:` prefix is stripped from the stored text', capturedText(join(hodAi, 'inbox'), r.out).trim() === 'roads are graded not raw terrain');

  r = capture(['hod: terrain heightfield is the foundation']);
  ok('cap: fused "name: text" single-arg prefix routes + strips', r.code === 0 && capturedText(join(hodAi, 'inbox'), r.out).trim() === 'terrain heightfield is the foundation');

  r = capture(['bug', 'commit gate misfires on rebase']);
  ok('cap: cwd fallback writes the cwd project, receipt names it', r.code === 0 && kitFiles().length === 1 && /captured \(bug\) -> claude-kit\/inbox\//.test(r.out));
  ok('cap: a clean cwd capture proposes nothing', !r.err.includes('names'));

  r = capture(['decision', 'the terrain model for Project: HOD must stay smooth']);
  ok('cap: text naming another project is PROPOSED, not routed (cwd still owns the write)',
    r.code === 0 && kitFiles().length === 2 && /names hustle-or-die/.test(r.err) && /--project hod/.test(r.err));

  r = capture(['--project', 'nope', 'feature', 'x']);
  ok('cap: unknown --project errors instead of silently falling back to cwd', r.code === 1 && /matches no registered project/.test(r.err));

  r = capture(['bug: login redirect loops after sso']);
  ok('cap: a non-project `word:` lead is captured as content, not targeting',
    r.code === 0 && kitFiles().length === 3 && capturedText(kitDir, r.out).includes('bug: login redirect loops'));
}

// Teardown
// --------------------------------------------------------------------------
harness.cleanup();
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
