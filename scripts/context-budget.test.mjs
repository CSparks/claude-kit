// Tests for the session-start context budget (KIT-T420, KIT-D089).
// Run: node scripts/context-budget.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  estimateTokens, verdict, staticItems, measureProject, trimAdvice, docsHome, contextLine,
  registeredProjects, record, lastReviewed, WARN_TOKENS, FAIL_TOKENS,
} from './context-budget.mjs';
import { ROOT, tmpDir, hook, cleanup, reporter, homeEnv, adopted } from '../hooks/test-harness.mjs';

const { ok, done } = reporter('context-budget');
const words = (tokens) => 'x'.repeat(tokens * 4);

function fixture({ global = 0, project = 0, session = 0, memory = 0 }) {
  const home = tmpDir('cb-home-');
  const root = adopted(false);
  const kit = tmpDir('cb-kit-');
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', 'CLAUDE.md'), words(global));
  writeFileSync(join(root, 'CLAUDE.md'), words(project));
  writeFileSync(join(root, '.ai', 'SESSION.md'), words(session));
  if (memory) {
    const dir = join(home, '.claude', 'projects', root.replace(/[:\\/ ]/g, '-'), 'memory');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'MEMORY.md'), words(memory));
  }
  return { home, root, kit };
}

try {
  ok('4 chars estimate one token', estimateTokens('abcd') === 1 && estimateTokens('abcde') === 2 && estimateTokens('') === 0);
  ok('verdict: ok to 20k, warn above, fail above 25k', verdict(WARN_TOKENS) === 'ok' && verdict(WARN_TOKENS + 1) === 'warn' && verdict(FAIL_TOKENS) === 'warn' && verdict(FAIL_TOKENS + 1) === 'fail');

  const lean = fixture({ global: 1000, project: 500, session: 300, memory: 200 });
  const items = staticItems(lean);
  const by = (label) => items.find((i) => i.label.startsWith(label));
  ok('static items measure each file', by('global').tokens === 1000 && by('project').tokens === 500 && by('memory').tokens === 200);
  ok('SESSION.md is shown but not double-counted (it is inside orient)', by('SESSION.md').tokens === 300 && by('SESSION.md').counted === false);
  const leanProject = measureProject({ name: 'lean', ...lean, runHooks: false });
  ok('a lean project is ok and gets no trim advice', leanProject.verdict === 'ok' && leanProject.total === 1700 && trimAdvice(leanProject).length === 0);

  const fat = fixture({ global: 14000, project: 9000, session: 6000, memory: 3000 });
  const fatProject = measureProject({ name: 'fat', ...fat, runHooks: false });
  ok('a project over 25k fails', fatProject.total === 26000 + fatProject.items.find((i) => i.label.startsWith('kit skill')).tokens && fatProject.verdict === 'fail');
  const advice = trimAdvice(fatProject);
  ok('the advice names the biggest items first, each with its docs home', advice[0].startsWith('trim global CLAUDE.md') && /docs\//.test(advice[0]) && advice.some((a) => /project CLAUDE\.md.*docs\//.test(a)));
  ok('SESSION.md advice is the one-screen rule', advice.some((a) => /SESSION\.md.*one screen/.test(a)));
  ok('every named item has a docs home', ['global CLAUDE.md', 'project CLAUDE.md', 'memory index', 'orient output', 'housekeeping output', 'kit skill + agent listings', 'SESSION.md', 'other'].every((l) => docsHome(l).length > 10));

  const line = contextLine({ orientTokens: 2000, ...lean });
  ok('orient cost line: tokens, ceiling, no alarm when lean', /^context: orient 2000 \+ files 1700 = 3700 tokens of 25000/.test(line));
  ok('orient cost line alarms over the warn line', /^!! context: /.test(contextLine({ orientTokens: 2000, ...fat })));

  const reg = { projects: { real: ROOT, tmp: lean.root, ghost: join(ROOT, 'missing'), wt: join(ROOT, '.claude', 'worktrees', 'agent-x') } };
  ok('registered projects skip temp dirs, missing paths and worktrees', registeredProjects(reg).map((p) => p.name).join() === 'real');

  process.env.CLAUDE_KIT_BUDGET_STAMP = join(tmpDir('cb-stamp-'), 'budget.json');
  ok('never recorded reads as empty', lastReviewed() === '');
  record([leanProject], '2026-10-10');
  ok('record stamps the review date', lastReviewed() === '2026-10-10');

  const run = hook('housekeeping.mjs', { hook_event_name: 'SessionStart' }, lean.root, { CLAUDE_KIT_BUDGET_STAMP: join(tmpDir('cb-none-'), 'none.json'), ...homeEnv(lean.home) });
  ok('a never-run review is a dispatch directive, not a nag', /WEEKLY CONTEXT-BUDGET REVIEW DUE \(never run\)/.test(run.out) && /DISPATCH NOW/.test(run.out) && /\[job: wiring\]/.test(run.out) && /25k/.test(run.out));
  const stampNow = join(tmpDir('cb-now-'), 'now.json');
  process.env.CLAUDE_KIT_BUDGET_STAMP = stampNow;
  record([leanProject]);
  const quiet = hook('housekeeping.mjs', { hook_event_name: 'SessionStart' }, lean.root, { CLAUDE_KIT_BUDGET_STAMP: stampNow, ...homeEnv(lean.home) });
  ok('a review done today is quiet', !/CONTEXT-BUDGET/.test(quiet.out));

  const orient = hook('orient.mjs', { hook_event_name: 'SessionStart' }, lean.root, homeEnv(lean.home));
  ok('orient prints its own cost on one line', /\ncontext: orient \d+ \+ files \d+ = \d+ tokens of 25000/.test(orient.out));
} finally {
  cleanup();
}
done();
