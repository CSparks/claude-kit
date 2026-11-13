// gate-protocol: `q gates <gate>` prints every requirement and exact tag form of a gated tool, read from the gate
// code (KIT-T898, KIT-D147), and a rejection lists every requirement that failed on its first pass.
// Run: node hooks/gate-protocol.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV, ROOT, adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';
import { GATES, gateText } from './lib/gate-protocol.mjs';
import * as protocol from './lib/gate-protocol.mjs';
import * as capabilityStale from './lib/capability-stale.mjs';
import * as brief from './dispatch-brief.mjs';
import * as broker from './dispatch-broker.mjs';
import * as conformance from './dispatch-conformance.mjs';
import { conformanceTestsFor } from './dispatch-conformance.mjs';
import * as context from './dispatch-context.mjs';
import * as escalation from './dispatch-escalation.mjs';
import * as framework from './dispatch-framework.mjs';
import * as holder from './dispatch-holder.mjs';
import * as job from './dispatch-job.mjs';
import * as lessons from './dispatch-lessons.mjs';
import * as rulings from './dispatch-rulings.mjs';
import * as treeProject from './dispatch-tree-project.mjs';
import * as ui from './dispatch-ui.mjs';
import * as worker from './dispatch-worker.mjs';
import { REAL_QUESTIONS, SHORT_QUESTIONS } from './question-brief-real-fixtures.mjs';

const { ok, done } = reporter('gate-protocol');
const dir = tmpDir('gate-protocol-');
const WARN_ONLY = new Set(['WASTE_CHECK', 'AGENT_LOADED_CHECK']);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const q = (...args) => spawnSync(process.execPath, [join(ROOT, 'scripts', 'q.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', env: ENV });

try {
  for (const t of Object.values(TOKENS)) {
    ok(`tag form ${t.form} satisfies its own pattern`, t.pattern.test(t.form));
  }

  const ids = new Set(GATES.agent.checks.map((c) => c.check));
  const exported = {};
  for (const mod of [capabilityStale, brief, broker, conformance, context, escalation, framework, holder, job, lessons, rulings, treeProject, ui, worker, protocol]) {
    for (const [name, value] of Object.entries(mod)) if (name.endsWith('_CHECK') && typeof value === 'string') exported[name] = value;
  }
  const guardNames = [...new Set([...read('hooks/dispatch-guard.mjs').matchAll(/pathExcluded\(root, ([A-Z_]+_CHECK), root\)/g)].map((m) => m[1]))];
  const unlisted = guardNames.filter((name) => !WARN_ONLY.has(name) && !ids.has(exported[name]));
  ok(`every check dispatch-guard runs is listed by q gates agent (${guardNames.length} names)`, guardNames.length > 10 && unlisted.length === 0);
  if (unlisted.length) console.log(`  unlisted: ${unlisted.join(', ')}`);

  const copies = ['dispatch-brief', 'dispatch-broker', 'dispatch-conformance', 'dispatch-context', 'dispatch-escalation', 'dispatch-framework', 'plan-exit-gate', 'dispatch-job', 'dispatch-lessons',
    'dispatch-readonly', 'dispatch-rulings', 'dispatch-target', 'dispatch-ui', 'dispatch-worker', 'dispatch-guard', 'agent-outcome', 'reask-gate', 'lib/agent-context']
    .filter((f) => read(`hooks/${f}.mjs`).split('\n').some((l) => !l.trim().startsWith('//') && /\/\\\[[a-z-]+/.test(l)));
  ok('no gate keeps its own copy of a tag pattern: gate-tokens.mjs is the one definition', copies.length === 0);
  if (copies.length) console.log(`  local tag patterns: ${copies.join(', ')}`);

  const agent = q('gates', 'agent');
  ok('q gates agent prints every check id', agent.status === 0 && [...ids].every((id) => agent.stdout.includes(id)));
  ok('q gates agent prints every tag form exactly', Object.values(TOKENS).filter((t) => GATES.agent.checks.some((c) => c.tokens.includes(t))).every((t) => agent.stdout.includes(t.form)));
  ok('q gates agent states the canonical description form', agent.stdout.includes('[Sonnet 5.5]'));
  const game = tmpDir('gate-game-');
  writeFileSync(join(game, '.gitmodules'), '[submodule "rapid-game"]\n\tpath = rapid-game\n');
  const plain = tmpDir('gate-plain-');
  const expected = conformanceTestsFor(game);
  const conformanceRow = (root) => gateText('agent', { root }).split('\n').filter((l) => /in this project: name/.test(l));
  ok('q gates agent in a framework checkout names the conformance test the check matches',
    expected.length > 0 && conformanceRow(game).length === 1 && expected.every((n) => conformanceRow(game)[0].includes(`\`${n}\``)));
  ok('negative control: a checkout with no framework conformance test prints no name', conformanceRow(plain).length === 0 && conformanceRow(undefined).length === 0);
  ok('q gates agent run from that checkout prints the name', spawnSync(process.execPath, [join(ROOT, 'scripts', 'q.mjs'), 'gates', 'agent', '--root', game], { cwd: game, encoding: 'utf8', env: ENV }).stdout.includes(`\`${expected[0]}\``));
  const fixtureKit = (family) => {
    const kit = tmpDir('gate-jobs-kit-');
    mkdirSync(join(kit, '.ai'));
    writeFileSync(join(kit, '.ai', 'config.yml'), `dispatch:\n  jobs:\n    probe:\n      family: ${family}\n      fallback: haiku\n      use: "fixture job; second sentence"\n    research:\n      family: ${family}\n      use: "read-only investigation"\n  default_job:\n    "*": probe\n`);
    return kit;
  };
  const withLadder = (kit, fn) => {
    const prior = process.env.CLAUDE_KIT_LADDER_ROOT;
    process.env.CLAUDE_KIT_LADDER_ROOT = kit;
    try { return fn(); } finally { if (prior === undefined) delete process.env.CLAUDE_KIT_LADDER_ROOT; else process.env.CLAUDE_KIT_LADDER_ROOT = prior; }
  };
  const agentRoot = tmpDir('gate-jobs-root-');
  mkdirSync(join(agentRoot, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(agentRoot, '.claude', 'agents', 'zz-fixture-agent.md'), '---\nname: zz-fixture-agent\njob: probe\n---\nbody\n');
  const jobLines = (kit) => withLadder(kit, () => gateText('agent', { root: agentRoot })).split('\n');
  const rowOf = (lines, id) => lines.find((l) => l.startsWith(`  ${id} `)) || '';
  const sonnetKit = jobLines(fixtureKit('sonnet'));
  ok('q gates agent lists a job with its family, fallback and one-line use from the capability table',
    /^ {2}probe\s+sonnet \(fallback haiku\)\s+fixture job$/.test(rowOf(sonnetKit, 'probe')));
  ok('q gates agent lists an agent type with its default job and that job\'s family',
    sonnetKit.some((l) => /^ {2}claude-kit:visual-reviewer\s+research -> sonnet$/.test(l)) && sonnetKit.some((l) => /^ {2}zz-fixture-agent\s+probe -> sonnet \(fallback haiku\)$/.test(l)));
  const opusKit = jobLines(fixtureKit('opus'));
  ok('a capability table change changes the printout: family of the job and of the types defaulting to it',
    /probe\s+opus \(fallback haiku\)/.test(rowOf(opusKit, 'probe')) && opusKit.some((l) => /claude-kit:visual-reviewer\s+research -> opus$/.test(l)) && opusKit.some((l) => /zz-fixture-agent\s+probe -> opus/.test(l)));
  ok('the jobs section names the resolver in the form a project session runs', sonnetKit.some((l) => l.includes('resolve --job <job>') && l.includes('claude-kit-runtime/current/scripts/dispatch-ladder.mjs')));
  ok('no second copy of the table: gate-jobs.mjs and gate-protocol.mjs name no job id or family row', !/\b(targeted-change|greenfield|forensic|ui-creative)\b/.test(read('hooks/lib/gate-jobs.mjs') + read('hooks/lib/gate-protocol.mjs')));
  ok('q gates plan and q gates question carry no jobs section', !gateText('plan').includes('JOBS (') && !gateText('question').includes('JOBS ('));
  const question = q('gates', 'question');
  ok('q gates question prints the summary-first rule, the readiness rules and the re-ask tag',
    question.status === 0 && question.stdout.includes('summary first, then the questionnaire') && question.stdout.includes('exploring:') && question.stdout.includes(TOKENS.reAsk.form));
  ok('q gates question lists the prose-ask check and its Stop hook (KIT-T1151)',
    question.stdout.includes('prose-ask-gate (Stop') && /^ {2}prose-ask\s+no closing reply says or implies that work waits on the maintainer/m.test(question.stdout));
  ok('q gates with no name lists the gates', q('gates').stdout.includes('agent, plan, question'));
  const unknown = q('gates', 'nope');
  ok('an unknown gate exits 1 and names the valid ones', unknown.status === 1 && unknown.stderr.includes('agent, plan, question'));
  ok('gateText of an unknown name is null', gateText('nope') === null);
  ok('q --help lists the gates verb', q('--help').stdout.includes('gates [agent|plan|question|source]'));
  const source = q('gates', 'source');
  ok('q gates source names the check and the move-lines verb for a file split (KIT-T1155)',
    source.status === 0 && /^ {2}source-shell-write\s+source changes through Edit and Write/m.test(source.stdout) && source.stdout.includes('move-lines <source> <ranges>=<dest>'));
  ok('the source-shell-write block message points at move-lines (KIT-T1155)', hook('source-shell-gate.mjs', { tool_name: 'Bash', tool_input: { command: 'echo x > src/a.rs' } }, adopted(false)).out.includes('move-lines'));

  const orient = hook('orient.mjs', { hook_event_name: 'SessionStart' }, adopted(false));
  ok('orient points at q gates in the identity block', orient.out.includes('q gates agent|plan|question'));

  const repo = adopted(false);
  const twoWrong = hook('dispatch-guard.mjs', { tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'sonnet', isolation: 'worktree', description: 'x', prompt: 'do a thing' } }, repo);
  ok('a dispatch with no job, a worktree and an untagged description is rejected once with every cause',
    twoWrong.code === 2 && twoWrong.out.includes('names no job') && twoWrong.out.includes('worktree / separate-checkout') && twoWrong.out.includes('resend description as "[Sonnet 5.5] x"'));
  const labelOnly = hook('dispatch-guard.mjs', { tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', model: 'sonnet', description: 'x', prompt: 'do a thing [job: fix]' } }, repo);
  ok('a label-only problem is the dispatch-label hook\'s block, not the guard\'s', labelOnly.code === 0);

  const file = join(dir, 'turn.jsonl');
  const entry = (type, content) => JSON.stringify({ type, message: { role: type, content } });
  writeFileSync(file, [entry('user', 'Should we maybe change the radar?'), entry('assistant', [{ type: 'text', text: 'Short note.' }]), entry('assistant', [{ type: 'tool_use', id: 'toolu_01G', name: 'AskUserQuestion', input: {} }])].join('\n'));
  const ask = hook('question-brief-gate.mjs', { tool_name: 'AskUserQuestion', tool_use_id: 'toolu_01G', tool_input: { questions: REAL_QUESTIONS }, transcript_path: file }, repo);
  ok('a questionnaire failing readiness is rejected before the call; the summary is judged after it', ask.code === 2 && ask.out.includes('- exploring:') && !ask.out.includes('- length:'));
  const audit = hook('question-brief-audit.mjs', { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_use_id: 'toolu_01G', tool_input: { questions: SHORT_QUESTIONS }, transcript_path: file }, repo, { CLAUDE_KIT_REAP_STAMP_DIR: tmpDir('audit-state-') });
  ok('the audit then reports the missing summary', audit.out.includes('- summary:') && !audit.out.includes('- decision:'));
  const note = ask.out.includes('q gates question');
  ok('the question rejection points at q gates question', note);

  const sessions = spawnSync(process.execPath, [join(ROOT, 'scripts', 'q.mjs'), 'said', 'zzqqnothing'], { cwd: ROOT, encoding: 'utf8', env: ENV });
  ok('q said runs (no use-before-initialisation crash in the sessions branch, KIT-T899)', !/before initialization/.test(sessions.stderr));
} finally {
  cleanup();
}

done();
