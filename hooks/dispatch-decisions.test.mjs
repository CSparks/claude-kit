// brief-decisions (KIT-T1458): a plan, design, analyst-max or perf brief names the recorded decisions it overlaps most.
// The cases are a persistence plan that cites the persistence ruling but not the caching ruling, and a perf brief on
// startup cost that cites neither. Run: node hooks/dispatch-decisions.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, finish, ignoreFile, makeRepo, run, transcript } from './dispatch-guard-harness.mjs';
import { TRIAGE_LINE } from './lib/block-triage.mjs';
import { writeDecisions } from './question-gates-fixture.mjs';
import { briefDecisionMisses } from './lib/brief-grounding.mjs';
import { gateText } from './lib/gate-protocol.mjs';

const PLAN_BRIEF = 'Context: FQD-D146 (generated world data persists on disk and lives by cache age; a costlier first run on a new seed is accepted). Measured: the world build takes 32 s and the loading hold 18 s of cooks, none of it cached. The perf agent found that none of the cooked outputs serialize today: the road network, settlement plans, settlement meshes and ground. Plan how to cache them. Deliver: (1) for each cooked output the type and its size on disk once stored; (2) the cache key, the seed plus a hash of the world document bytes; (3) where a cache hit enters the stage order so a stored output is read back and whole stages are skipped; (4) the order of work, each step landable alone; (5) the risk of a stale cached output after a code change, and how a stored entry is read back safely.';
const PERF_BRIEF = 'Startup takes too long on every launch: the world build and the loading cooks run again for the same seed. Find which cooked outputs, the road network, the settlement plans and the meshes, could be cached on disk under a key of the seed and the world documents, stored once and read back instead of generated again, and measure what each cache would save. Report the cost of each cooked output, where a stored output is read back in the stage order, and the order to build the caches in.';
const UNRELATED = 'Summarise how the engine sound synthesis maps revolutions and load to pitch, and list the settings the audio panel exposes.';
const NAMED = '[rulings-checked: FQD-D031 (every deterministic output is cached on disk under a key and read back) governs; FQD-D146 sets the expiry by age]';
const NONE = '[rulings-checked: none apply: the inbox holds only bugs]';

const repo = writeDecisions(makeRepo());
const opus = transcript(repo, 'opus-session', 'claude-opus-4-8');
const planCall = (dir, prompt) => run(dir, { subagent_type: 'general-purpose', model: 'opus', prompt: `[job: plan] [model-override: fixture] [escalate: fixture] ${prompt}`, jobless: true }, opus);
const analystMax = (dir, prompt) => run(dir, { subagent_type: 'claude-kit:analyst-max', model: 'opus', prompt: `[job: plan] [model-override: fixture] [escalate: fixture] ${prompt}`, jobless: true }, opus);
const perf = (dir, prompt) => run(dir, { subagent_type: 'claude-kit:perf-tuner', model: 'sonnet', prompt: `[job: build] [model-override: fixture] ${prompt}`, jobless: true }, opus);

const planBlocked = planCall(repo, PLAN_BRIEF);
expect('the persistence plan citing FQD-D146 but not FQD-D031 is blocked, naming FQD-D031', planBlocked.code === 2 && /brief-decisions/.test(planBlocked.err) && planBlocked.err.includes('FQD-D031') ? 1 : 0, 1);
expect('the block does not name the decision the brief cites', planBlocked.err.includes('FQD-D146 (') ? 1 : 0, 0);
expect('the block carries the title in plain words, the matched words, the exact tag form and the triage footer', /every cooked output is stored by its fingerprint/.test(planBlocked.err) && /\d+ words of its title are central to the brief/.test(planBlocked.err) && planBlocked.err.includes('[rulings-checked:') && planBlocked.err.includes(TRIAGE_LINE) ? 1 : 0, 1);
expect('naming FQD-D031 in the rulings-checked tag passes', planCall(repo, `${PLAN_BRIEF} ${NAMED}`).code, 0);
expect('a none-apply tag clears no decision it does not name', planCall(repo, `${PLAN_BRIEF} ${NONE}`).code, 2);
expect('an analyst-max plan brief is judged the same way', analystMax(repo, PLAN_BRIEF).code, 2);

const perfBlocked = perf(repo, PERF_BRIEF);
expect('a perf brief on startup cost that names neither decision is blocked, naming FQD-D031', perfBlocked.code === 2 && perfBlocked.err.includes('FQD-D031') ? 1 : 0, 1);
expect('naming FQD-D031 passes the perf brief', perf(repo, `${PERF_BRIEF} FQD-D031 governs this.`).code, 0);

expect('negative control: an analyst-max brief on an unrelated subject passes', analystMax(repo, UNRELATED).code, 0);
const PASSING = 'Summarise the audio panel settings and how the engine sound maps revolutions to pitch; mention that the world cache is cleared on exit and that outputs are read once.';
expect('negative control: a brief that mentions caching in passing is not about it and passes', analystMax(repo, PASSING).code, 0);
expect('negative control: an implementer brief is not judged', run(repo, { subagent_type: 'claude-kit:implementer', model: 'sonnet', prompt: `[job: fix] ${PERF_BRIEF}`, jobless: true }, opus).code, 0);
expect('the ignore file lifts brief-decisions', planCall(ignoreFile(repo, 'brief-decisions'), PLAN_BRIEF).code, 0);
expect('the text inside a bracketed tag is never matched', briefDecisionMisses(repo, `[note: ${PERF_BRIEF}] Count the lines in the log.`).length, 0);

const game = makeRepo();
writeFileSync(join(game, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
mkdirSync(join(game, 'rapid-game', 'docs'), { recursive: true });
writeDecisions(join(game, 'rapid-game'));
const gameTx = transcript(game, 'opus-session', 'claude-opus-4-8');
const framework = run(game, { subagent_type: 'claude-kit:analyst-max', model: 'opus', prompt: `[job: plan] [model-override: fixture] [escalate: fixture] [framework-checked: none apply: fixture] ${PERF_BRIEF}`, jobless: true }, gameTx);
expect('a decision in the framework store is surfaced, named with its source', framework.code === 2 && /FQD-D031 \(rapid-game\)/.test(framework.err) ? 1 : 0, 1);

expect('q gates agent lists the check', gateText('agent').includes('brief-decisions') ? 1 : 0, 1);

finish();
