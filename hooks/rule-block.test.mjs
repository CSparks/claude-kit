// rule-block (KIT-T1463): the fixed block of tooling and process rules is the FIRST thing orient prints (bounded and
// unbounded), the first context a SubagentStart hand gives an agent, and the first body section of every agent definition,
// verbatim; the orient budget trims listings, never the block; `t decide` prints the step that adds a stated rule to it.
// Run: node hooks/rule-block.test.mjs

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adopted, cleanup, hook, reporter, tmpDir } from './test-harness.mjs';
import { fitOrientation } from './lib/orient-budget.mjs';
import { RULES, RULE_BLOCK_TITLE, ruleBlockText, ruleRecordStep } from './lib/rule-block.mjs';

const { ok, done } = reporter('rule-block');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BLOCK_MAX_CHARS = 3700;
const REQUIRED = [
  /Search with `q`/, /never grep/, /ONE named file/, /targeted test.*runs without asking.*whole suite.*never without his approval.*nothing runs implicitly/, /No waiting loops/, /plain words/,
  /no ticket, decision, lever or run ids/, /commit hash only in the landing receipt/, /plain summary.*directly above AskUserQuestion, never inside it/,
  /Anything you need from the maintainer is a questionnaire/, /Record a rule or decision/, /process failure and kit bug.*dispatch a fix agent/,
  /ambiguous in a way that changes what gets built.*asked first in one batched questionnaire, never assumed/, /When he says a part works it is frozen/, /Never discard work in progress.*ship nothing broken/,
  /Measure headless every defect class he has already reported.*red test on main blocks a landing/, /Before any benchmark or performance check make sure nothing builds and no tests run.*not a result/,
  /Relay an agent's or hook's report in plain words/, /Tag values and forms.*come from `q gates agent`/, /Every path, id or number you write is one you just read/,
  /game run an agent, a probe or a test starts.*sets `RG_UNATTENDED=1`.*never locks the cursor or takes focus/,
  /writer agent ends every turn with the crates it edited compiling.*`cargo check` them.*blocks every other writer's builds/,
  /summary defines each term of art a question uses with a project example.*states each option's effect and cost.*no option bundles several decisions unless the summary explains each/,
];
const RULE_MAX_CHARS = 200;
const block = ruleBlockText();

try {
  ok('every rule is one line', RULES.every((r) => !r.includes('\n')));
  ok(`every rule is at most ${RULE_MAX_CHARS} characters`, RULES.every((r) => r.length <= RULE_MAX_CHARS));
  const globalSource = readFileSync(join(ROOT, 'user-config', 'CLAUDE.global.md'), 'utf8');
  ok('the global source carries one tests rule: targeted allowed, whole suite needs his approval, no "Run suites AND"', /One tests rule/.test(globalSource) && /TARGETED TESTS are allowed/.test(globalSource) && !/Run suites AND/.test(globalSource) && !/RDG-D063, KIT-T1353/.test(globalSource));
  ok(`the block stays short (${block.length} of ${BLOCK_MAX_CHARS} chars)`, block.length <= BLOCK_MAX_CHARS);
  ok('the block carries every named tooling and process rule', REQUIRED.every((re) => re.test(block)));

  const agents = readdirSync(join(ROOT, 'agents')).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const bodyOf = (text) => text.replace(/^---\n[\s\S]*?\n---\n\s*/, '');
  ok('there are agent definitions to check', agents.length >= 10);
  for (const a of agents) ok(`agents/${a}: the block opens the body, verbatim`, bodyOf(readFileSync(join(ROOT, 'agents', a), 'utf8')).startsWith(`${block}\n`));

  const repo = adopted(false);
  const orient = hook('orient.mjs', {}, repo);
  ok('orient prints the block as its very first lines', orient.out.startsWith(`${block}\n`));
  ok('the block precedes the project header', orient.out.indexOf(RULE_BLOCK_TITLE) === 0 && orient.out.indexOf('PROJECT ORIENTATION') > block.length);

  const unbounded = tmpDir('rule-block-unbounded-');
  mkdirSync(join(unbounded, '.ai'), { recursive: true });
  writeFileSync(join(unbounded, '.ai', 'config.yml'), 'key: UB\n');
  const bare = tmpDir('rule-block-bare-');
  const free = hook('orient.mjs', {}, bare, { CLAUDE_KIT_UNBOUNDED_AI: join(unbounded, '.ai') });
  ok('an unbounded session prints the block first too', free.out.startsWith(`${block}\n`));

  const listing = Array.from({ length: 300 }, (_, i) => `  open item ${i} with a long line of listing text to push the output over the budget`);
  const over = fitOrientation([block, '=== PROJECT ORIENTATION ===', '--- Open work ---', ...listing].join('\n'));
  ok('over budget, the listings are trimmed and the block survives whole and first', over.demoted.length > 0 && over.text.startsWith(`${block}\n`));

  const guide = hook('subagent-gate-guide.mjs', { hook_event_name: 'SubagentStart', agent_type: 'general-purpose', cwd: repo }, repo);
  const added = JSON.parse(guide.out).hookSpecificOutput.additionalContext;
  ok('SubagentStart hands every agent the block first', added.startsWith(`${block}\n`));

  const compact = hook('gate-digest.mjs', { hook_event_name: 'SessionStart', source: 'compact' }, repo);
  ok('after a compaction the restatement carries the tag-forms digest and closes with the standing-rules block', /q gates agent/.test(compact.out) && compact.out.trim().endsWith(block));
  ok('a startup prints no restatement', hook('gate-digest.mjs', { hook_event_name: 'SessionStart', source: 'startup' }, repo).out.trim() === '');

  ok('a decision with his words prints the step that adds the rule to the block', /rule-block\.mjs/.test(ruleRecordStep('**Maintainer:** "never grep"\n\n**Decision:** x')));
  ok('a decision with no maintainer paragraph prints no step', ruleRecordStep('**Decision:** x\n\n**Why:** y') === '');
  ok('the decision flow docs name the block', /standing-rules block/.test(readFileSync(join(ROOT, 'commands', 'decide.md'), 'utf8')) && /standing-rules block/.test(readFileSync(join(ROOT, 'user-config', 'CLAUDE.global.md'), 'utf8')));
} finally {
  cleanup();
}
done();
