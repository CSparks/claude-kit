// framework-checked (KIT-T1095): a plan or design brief, and a plan leaving plan mode, cite the framework crates read.
// Run: node hooks/dispatch-framework.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, finish, ignoreFile, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { frameworkSection } from './lib/frameworks.mjs';
import { gateText } from './lib/gate-protocol.mjs';

const PLAN_HOOK = fileURLToPath(new URL('./plan-exit-gate.mjs', import.meta.url));
const INDEX = ['# Crates', '', '| Crate | What it is |', '| --- | --- |', '| `rg-chunk-stream` | Stage ladder and per-stage rings. |', '| `rg-landform` | Far, mid and near rings. |', ''].join('\n');

function game({ index = true } = {}) {
  const dir = makeRepo();
  writeFileSync(join(dir, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  mkdirSync(join(dir, 'rapid-game', 'docs'), { recursive: true });
  if (index) writeFileSync(join(dir, 'rapid-game', 'docs', 'CRATES.md'), INDEX);
  return dir;
}

const repo = game();
const noIndex = game({ index: false });
const plain = makeRepo();
const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
const MASTER = 'produce the master plan for the flyover ring layout [job: plan] [model-override: fixture] [escalate: fixture]';
const plan = (dir, text) => run(dir, { subagent_type: 'general-purpose', model: 'opus', prompt: `${MASTER} ${text}`.trim(), jobless: true }, opus);
const exitPlan = (dir, text) => spawnSync(process.execPath, [PLAN_HOOK], { cwd: dir, input: JSON.stringify({ tool_name: 'ExitPlanMode', tool_input: { plan: text } }), encoding: 'utf8' });

const blocked = plan(repo, '');
expect('a plan dispatch citing no framework crate is blocked', blocked.code, 2);
expect('the block names the check, the index, an indexed crate and the exact tag', /framework-checked/.test(blocked.err) && blocked.err.includes('rapid-game/docs/CRATES.md') && blocked.err.includes('rg-chunk-stream') && blocked.err.includes('[framework-checked: <crate rows or surfaces read, per mechanism') ? 1 : 0, 1);
expect('the block carries the BLOCK TRIAGE footer', blocked.err.includes(TRIAGE_LINE) ? 1 : 0, 1);
expect('a tag naming an indexed crate passes', plan(repo, '[framework-checked: rg-landform far, mid and near rings read for the ring mechanism]').code, 0);
expect('a tag naming only an unknown crate is blocked', plan(repo, '[framework-checked: rg-flora tier reach]').code, 2);
expect('the none-apply form with a reason passes', plan(repo, '[framework-checked: none apply: a UI-only change]').code, 0);
expect('the none-apply form without a reason is blocked', plan(repo, '[framework-checked: none apply]').code, 2);
expect('an analyst briefed with design words is asked too', run(repo, { subagent_type: 'claude-kit:analyst', model: 'sonnet', prompt: 'design the ring layout for far terrain' }, opus).code, 2);
expect('negative control: an implementer brief naming no design passes', run(repo, { subagent_type: 'claude-kit:implementer', model: 'sonnet', prompt: 'fix the off-by-one in the exporter' }, opus).code, 0);
expect('negative control: a repo without the framework passes a plan dispatch', plan(plain, '').code, 0);
expect('negative control: a framework repo without an index file passes', plan(noIndex, '').code, 0);
expect('the ignore file lifts framework-checked', plan(ignoreFile(game(), 'framework-checked'), '').code, 0);

const exited = exitPlan(repo, 'Plan: add a per-tier reach inside rg-flora and a view-detail resource.');
expect('a plan leaving plan mode with no citation is blocked', exited.status, 2);
expect('the plan-exit block names q gates plan and the tag', /q gates plan/.test(exited.stderr) && exited.stderr.includes('[framework-checked:') ? 1 : 0, 1);
expect('the plan with an indexed-crate citation passes', exitPlan(repo, 'Plan: rings via rg-landform. [framework-checked: rg-landform far/mid/near rings, rg-chunk-stream ladder]').status, 0);
expect('the plan with none apply and a reason passes', exitPlan(repo, 'Plan: rename a menu label. [framework-checked: none apply: no mechanism proposed]').status, 0);
expect('negative control: a plan in a repo without the framework passes', exitPlan(plain, 'Plan: anything').status, 0);
expect('negative control: an empty plan passes', exitPlan(repo, '').status, 0);
expect('the ignore file lifts the plan-exit gate', exitPlan(ignoreFile(game(), 'framework-checked'), 'Plan: anything').status, 0);

const section = frameworkSection(repo);
expect('orient prints the framework-first line with the index path and the tag', /--- FRAMEWORK FIRST: rapid-game/.test(section) && section.includes('rapid-game/docs/CRATES.md (crate index)') && section.includes('[framework-checked:') ? 1 : 0, 1);
expect('negative control: no index file, no framework-first line', /FRAMEWORK FIRST/.test(frameworkSection(noIndex)) ? 1 : 0, 0);
expect('q gates plan and q gates agent print the tag form', gateText('plan').includes('[framework-checked:') && gateText('agent').includes('[framework-checked:') ? 1 : 0, 1);

finish();
