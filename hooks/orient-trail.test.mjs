#!/usr/bin/env node
// KIT-T048: orient replays the provenance trail for the in-flight `doing` ticket(s), so a cold
// session resumes with the governing context the ticket came from — summaries, not titles.
// Spawns the real hook against a throwaway adopted repo. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ORIENT = join(dirname(fileURLToPath(import.meta.url)), 'orient.mjs');
const fixtures = [];
let pass = 0;
let fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name); }
};

// A private plugin root + empty registry keeps the run off the live cache; the fixture scope key
// is its own ("OTR") because the kit's OWN .ai is always a hydration source.
const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-otr-plugin-'));
fixtures.push(PLUGIN_ROOT);
const REGISTRY = join(PLUGIN_ROOT, 'projects.json');

function repo({ doing = true } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-otr-'));
  fixtures.push(d);
  execFileSync('git', ['init', '-q'], { cwd: d, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: d, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: d, stdio: 'ignore' });
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  mkdirSync(join(d, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), 'ids:\n  key: "OTR"\n  pad: 3\n');
  writeFileSync(join(d, '.ai', 'tickets', 'OTR-T001-seed.md'),
    `---\nid: OTR-T001\ntitle: the in-flight ticket\ntype: feature\nstatus: ${doing ? 'doing' : 'review'}\n`
    + 'priority: high\nlinks: [OTR-D001]\n---\n\n## Description\nx\n');
  writeFileSync(join(d, '.ai', 'decisions', 'OTR-D001.md'),
    '---\nid: OTR-D001\ntitle: a headline nobody wants to read in full at resume time\n'
    + 'summary: the governing call, in one line\ndate: 2026-08-15\n---\n**Decision:** as summarized.\n');
  return d;
}

function orient(cwd) {
  const r = spawnSync(process.execPath, [ORIENT], {
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    cwd, encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_KIT_REGISTRY: REGISTRY },
  });
  return `${r.stdout || ''}${r.stderr || ''}`;
}

writeFileSync(REGISTRY, JSON.stringify({ projects: {} }));
const doingRepo = repo();
writeFileSync(REGISTRY, JSON.stringify({ projects: { 'otr-doing': doingRepo } }));
const out = orient(doingRepo);
ok('orient: the doing ticket gets a trail block', /trail OTR-T001:/.test(out));
ok('orient: the antecedent is shown by SUMMARY, not its long title',
  /OTR-D001 \(decisions, via link\) — the governing call, in one line/.test(out));
ok('orient: the trail line itself carries no clipped title',
  !out.split('\n').some((l) => /OTR-D001 \(decisions/.test(l) && /a headline nobody wants/.test(l)));
ok('orient: the block stays compact (<= 6 lines per ticket)',
  out.split('\n').filter((l) => /OTR-D001|trail OTR-T001/.test(l)).length <= 6);

// Negative control: a `review` ticket is not in-flight work — no trail block for it.
writeFileSync(REGISTRY, JSON.stringify({ projects: {} }));
const reviewRepo = repo({ doing: false });
writeFileSync(REGISTRY, JSON.stringify({ projects: { 'otr-review': reviewRepo } }));
ok('orient: a review-only ticket gets no trail block', !/trail OTR-T001:/.test(orient(reviewRepo)));

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } }
console.log(`\norient trail: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
