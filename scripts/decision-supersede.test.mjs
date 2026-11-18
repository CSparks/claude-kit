// A correction is a machine-visible link (KIT-T1374): `t revise <newer> --supersedes <older>` writes it after the fact, `q show`
// prints SUPERSEDED BY on the older decision, orient lists the replacement under it and no longer shows it as standing, and
// the dispatch gate warns a brief that cites it.
// Run: node --test scripts/decision-supersede.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviseDecision } from './t-revise.mjs';
import { showRows } from './q-show.mjs';
import { retiredDecisions } from './contract-rules/superseded-citations.mjs';
import { decisionViews } from '../hooks/lib/orient/decisions.mjs';
import { supersededCitationWarning } from '../hooks/dispatch-superseded.mjs';

const decision = (id, title, extra = '') => `---\nid: ${id}\ntitle: ${title}\nsummary: s\ndate: 2026-11-14\nsupersedes: \nsource: chris\n${extra}---\n\n**Decision:** ${title}.\n\n**Why:** because.\n`;

function store() {
  const root = mkdtempSync(join(tmpdir(), 'kit-sup-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, '.ai', 'decisions'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), 'classifications:\n  decision: { routes_to: decisions }\n');
  const put = (id, title, extra) => writeFileSync(join(root, '.ai', 'decisions', `${id}-x.md`), decision(id, title, extra));
  put('SP-D063', 'Every test run needs sign-off', 'standing: true\n');
  put('SP-D065', 'Targeted tests are allowed; a whole suite needs approval');
  put('SP-D122', 'Tests in isolation are always allowed');
  put('SP-D070', 'An unrelated rule', 'standing: true\n');
  return root;
}

test('t revise --supersedes links the older decisions, refuses an unknown or self id, and keeps what was there', () => {
  const root = store();
  const r = reviseDecision(root, 'SP-D065', { supersedes: 'SP-D063,SP-D122' });
  assert.deepEqual(r.changed, ['supersedes']);
  assert.match(readFileSync(join(root, '.ai', 'decisions', 'SP-D065-x.md'), 'utf8'), /^supersedes: SP-D063 SP-D122$/m);
  reviseDecision(root, 'SP-D065', { supersedes: 'SP-D063' });
  assert.match(readFileSync(join(root, '.ai', 'decisions', 'SP-D065-x.md'), 'utf8'), /^supersedes: SP-D063 SP-D122$/m, 'an id is added once');
  assert.throws(() => reviseDecision(root, 'SP-D065', { supersedes: 'SP-D999' }), /no decision SP-D999/);
  assert.throws(() => reviseDecision(root, 'SP-D065', { supersedes: 'SP-D065' }), /cannot supersede itself/);
  assert.deepEqual(retiredDecisions(root).get('SP-D063'), ['SP-D065']);
});

test('q show prints SUPERSEDED BY with the replacement on the older decision only', () => {
  const root = store();
  reviseDecision(root, 'SP-D065', { supersedes: 'SP-D063' });
  const old = showRows('SP-D063', root);
  assert.match(old[1], /^SUPERSEDED BY SP-D065 \(Targeted tests are allowed; a whole suite needs approval\): this decision no longer stands as written/);
  assert.ok(!showRows('SP-D065', root).some((l) => l.startsWith('SUPERSEDED BY')), 'negative control: the replacement carries no banner');
  assert.ok(!showRows('SP-D070', root).some((l) => l.startsWith('SUPERSEDED BY')), 'negative control: an unrelated decision carries none');
});

test('orient lists the replacement under a superseded recent decision and drops it from the standing list', () => {
  const root = store();
  reviseDecision(root, 'SP-D065', { supersedes: 'SP-D063' });
  const views = decisionViews(root);
  assert.match(views.recentDecisions(10), /SP-D063 — Every test run needs sign-off\n {4}SUPERSEDED BY SP-D065 — Targeted tests are allowed/);
  const standing = views.standingDecisions('', []);
  assert.deepEqual(standing.shownIds, ['SP-D070'], 'the superseded standing decision is no longer shown as standing');
});

test('a dispatch brief citing a superseded decision gets a warning naming the replacement', () => {
  const root = store();
  reviseDecision(root, 'SP-D065', { supersedes: 'SP-D063' });
  const warning = supersededCitationWarning(root, 'Run only cargo check, per SP-D063.');
  assert.match(warning, /cites SP-D063, which is superseded by SP-D065/);
  assert.equal(supersededCitationWarning(root, 'Targeted tests per SP-D065.'), '', 'negative control: citing the live rule is quiet');
  assert.equal(supersededCitationWarning(root, 'SP-D065 supersedes SP-D063.'), '', 'a brief recording the replacement is quiet');
  const guard = fileURLToPath(new URL('../hooks/dispatch-guard.mjs', import.meta.url));
  const r = spawnSync(process.execPath, [guard], { cwd: root, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Agent', tool_input: { subagent_type: 'claude-kit:analyst', model: 'opus', description: 'x', prompt: 'read-only check per SP-D063 [job: fix]' } }) });
  assert.match(r.stderr, /cites SP-D063, which is superseded by SP-D065/, r.stderr.slice(0, 400));
});
