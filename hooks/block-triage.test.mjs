// block-triage (KIT-T920, KIT-D154): every gate block ends with the "process failure or kit bug?" line.
// The shared footers carry it, every hook source that can exit 2 reaches one of them, and two real gates
// print it on a live block.
// Run: node hooks/block-triage.test.mjs

import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { ENV, HOOKS, cleanup, git, identify, reporter, repo } from './test-harness.mjs';
import { TRIAGE_ANSWERS, TRIAGE_LINE, triageFooter } from './lib/block-triage.mjs';
import { excludeFooter } from './lib/exclusions.mjs';

const { ok, done } = reporter('block-triage');

// Hook sources that exit 2 without a gate block to annotate.
const NOT_A_GATE = new Map([
  ['lib/excluded-trees.mjs', 'refuses a kit CLI tool (q, cap, t) in an excluded tree; no hook block'],
]);
// A gate whose text is built by a helper module of its own.
const MESSAGE_MODULE = new Map([['question-brief-audit.mjs', 'lib/question-audit.mjs']]);
const REACHES_FOOTER = /\b(?:excludeFooter|triageFooter)\(|\bTRIAGE_LINE\b/; // a call, so a bare import or re-export does not count

try {
  ok('the line names all three answers and their remedies', TRIAGE_ANSWERS.every((a) => TRIAGE_LINE.includes(a)) && TRIAGE_ANSWERS.length === 3 && /KIT-D145/.test(TRIAGE_LINE) && /open ticket id and the agent/.test(TRIAGE_LINE));
  ok('every footer carries every answer', [triageFooter(), excludeFooter('store-grep')].every((f) => TRIAGE_ANSWERS.every((a) => f.includes(a))));
  ok('triageFooter carries the line', triageFooter().includes(TRIAGE_LINE));
  ok('excludeFooter carries the line for every check id', ['store-grep', 'file-length'].every((id) => excludeFooter(id).includes(TRIAGE_LINE)));

  const sources = [...readdirSync(HOOKS).map((f) => f), ...readdirSync(join(HOOKS, 'lib')).map((f) => `lib/${f}`)]
    .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'));
  const blockers = sources.filter((f) => /process\.exit\(2\)/.test(readFileSync(join(HOOKS, f), 'utf8')));
  ok('the scan finds the gates (more than a dozen sources exit 2)', blockers.length > 12);
  const textOf = (f) => { try { return readFileSync(join(HOOKS, f), 'utf8'); } catch { return ''; } };
  const reaches = (f) => REACHES_FOOTER.test(textOf(f)) || (MESSAGE_MODULE.has(f) && REACHES_FOOTER.test(textOf(MESSAGE_MODULE.get(f))));
  const missing = blockers.filter((f) => !NOT_A_GATE.has(f) && !reaches(f));
  ok(`every hook that can exit 2 reaches a triage footer${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`, missing.length === 0);
  ok('every exemption still exits 2 (no stale allowlist entry)', [...NOT_A_GATE.keys()].every((f) => blockers.includes(f)));

  const KIT = join(HOOKS, '..');
  const read = (f) => readFileSync(join(KIT, f), 'utf8');
  // The three answers, in order, in the text after `anchor`.
  const threeAnswers = (text, anchor) => {
    const tail = text.slice(Math.max(0, text.search(anchor)));
    return /process failure[\s\S]*?kit bug[\s\S]*?known kit bug[\s\S]*?fix in progress/i.test(tail.slice(0, 1200));
  };
  const base = read('user-config/CLAUDE.global.md');
  ok('the base contract states the triage rule with its decision id and all three answers', /Triage every block: [^\n]*\(KIT-D154/.test(base) && threeAnswers(base, /Triage every block/));
  const agentDefs = readdirSync(join(KIT, 'agents')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  ok('every agent definition carries the triage section with all three answers', agentDefs.length >= 10 && agentDefs.every((f) => threeAnswers(read(`agents/${f}`), /## Hook blocks — triage first \(KIT-D154\)/)));
  ok('the dispatching commands put the triage line, with all three answers, in every brief', ['commands/work.md', 'commands/drain.md'].every((f) => threeAnswers(read(f), /On ANY hook block, say in your next reply/)));

  const live = (name, dir, input) => spawnSync(process.execPath, [join(HOOKS, name)], { input: JSON.stringify(input), cwd: dir, encoding: 'utf8', env: ENV });
  const d = identify(repo());
  mkdirSync(join(d, '.ai'));
  git(['commit', '--allow-empty', '-q', '-m', 'seed'], d);
  const blockedQuery = live('query-gate.mjs', d, { tool_input: { command: 'grep -rn physics .ai/decisions/' } });
  ok('a live query-gate block prints the triage line', blockedQuery.status === 2 && blockedQuery.stderr.includes(TRIAGE_LINE));
  const blockedBranch = live('branch-guard.mjs', d, { tool_input: { command: 'git checkout -b feature/x' } });
  ok('a live branch-guard block prints the triage line', blockedBranch.status === 2 && blockedBranch.stderr.includes(TRIAGE_LINE));
  const allowed = live('query-gate.mjs', d, { tool_input: { command: 'npm run build' } });
  ok('control: an allowed command prints no triage line', allowed.status === 0 && !allowed.stderr.includes('BLOCK TRIAGE'));
} finally {
  cleanup();
}

done();
