// gate-protocol — every requirement and accepted tag form of the gates a session meets before its first call to a
// gated tool (KIT-T898, KIT-D147). `q gates <gate>` prints gateText(name); check ids come from the modules that
// enforce them, tag forms from gate-tokens.mjs, the summary rule from question-brief.mjs.
//   GATES -> { agent, question }: { title, hooks, checks: [{ check, wants[], tokens[] }] }
//   gateText(name, { root }) -> the printable protocol, or null for an unknown name; with a root, the conformance row
//     names the test the check matches in that checkout (KIT-T1098); the agent gate ends with the capability table's jobs
//     and each agent type's default job (KIT-T1105);  gateNames() -> the gate names
//   gateDigest(gates?) -> the few lines a compaction start prints: per gate, each check's tag form (KIT-T1053)

import { LABEL_CHECK, LABEL_REQUIREMENTS } from './dispatch-label.mjs';
import { TOKENS } from './gate-tokens.mjs';
import { jobsSection } from './gate-jobs.mjs';
import { STALE_TABLE_CHECK } from './capability-stale.mjs';
import { BRIEF_CHECK as BRIEF_GROUNDED_CHECK } from '../dispatch-brief.mjs';
import { BROKER_OWNED_CHECK } from '../dispatch-broker.mjs';
import { CONFORMANCE_CHECK, conformanceTestsFor } from '../dispatch-conformance.mjs';
import { HANDOFF_CHECK } from '../dispatch-context.mjs';
import { ESCALATION_CHECK } from '../dispatch-escalation.mjs';
import { HOLDER_CHECK } from '../dispatch-holder.mjs';
import { JOB_CHECK } from '../dispatch-job.mjs';
import { LESSONS_CHECK } from '../dispatch-lessons.mjs';
import { RULINGS_CHECK } from '../dispatch-rulings.mjs';
import { FRAMEWORK_CHECK } from '../dispatch-framework.mjs';
import { UI_CHECK } from '../dispatch-ui.mjs';
import { TREE_PROJECT_CHECK } from '../dispatch-tree-project.mjs';
import { WORKER_CHECK, DEFAULT_WRITER_CAP } from '../dispatch-worker.mjs';
import { BRIEF_CHECK, GROUNDED_CHECK, GROUNDED_MIN_SHARED, GROUNDED_MIN_TITLE, GROUNDED_MIN_WORD, GROUNDED_PER_OPTION, READY_CHECK, REASK_CHECK, IDS_CHECK, RECOMMENDED_MARKER, IDS_MIN_HITS, REASK_WINDOW_DAYS } from './question-checks.mjs';
import { BRIEF_RULE } from './question-brief.mjs';
import { READINESS_STANDARD } from './question-ready.mjs';

export const LADDER_CHECK = 'dispatch-ladder';
export const COLD_BUILD_CHECK = 'cold-worktree-build';
export const SHARED_TREE_CHECK = 'shared-tree-dispatch';
export const RECOMMENDATION_CHECK = 'question-recommendation';

const CHECK_COLUMN = 30;
const TAG_COLUMN = 60;
const T = TOKENS;

export const GATES = {
  agent: {
    title: 'Agent / Task dispatch',
    hooks: ['dispatch-label (every repo)', 'dispatch-guard (adopted repos)'],
    checks: [
      { check: LABEL_CHECK, wants: LABEL_REQUIREMENTS.map((r) => `${r.part}: ${r.wants}`), tokens: [] },
      { check: LADDER_CHECK, wants: ["a model resolvable to a known family: pass model:'sonnet' | 'opus' | 'haiku' | 'fable' on every call; a model-less call that would inherit a fable session is refused"], tokens: [T.allowFable] },
      { check: JOB_CHECK, wants: ["a job: [job: <id>] in the prompt or description (an agent definition may carry a default job:); a model outside the job row's families needs the override tag"], tokens: [T.job, T.modelOverride] },
      { check: STALE_TABLE_CHECK, wants: ['no dispatch while a capability table row is older than dispatch.refresh_days (a reminder prints from 2 days before); the weekly reassessment is exempt: [job: research], a brief naming research/models-capability-<date>.md, [paths:] only under research/, .ai/config.yml, .ai/decisions/, .ai/model-lineup.json'], tokens: [T.modelRefresh] },
      { check: ESCALATION_CHECK, wants: ['a job no dearer than the default of the ticket type the brief names'], tokens: [T.escalate] },
      { check: COLD_BUILD_CHECK, wants: ['no worktree, clone or second checkout: one checkout, on main'], tokens: [T.maintainerWorktree] },
      { check: SHARED_TREE_CHECK, wants: ['any number of writers share a checkout (KIT-T1114); a writer dispatched while another is in flight there declares [paths:] (alone it needs none), and is refused only when its paths overlap an in-flight writer\'s', 'two things are guarded at write time, per file and per build: one file, one writer; no write into the files a running build compiles', 'research agents are read-only types or carry the read-only tag'], tokens: [T.paths, T.pathsUnknown, T.readOnly, T.tree, T.maintainerParallel] },
      { check: TREE_PROJECT_CHECK, wants: ['a [tree:] that is another registered project\'s checkout needs a brief that cites a ticket of that project (a checkout inside the session\'s own is never judged)'], tokens: [T.tree, T.maintainerTree] },
      { check: HOLDER_CHECK, wants: ['other live sessions are normal in any checkout (KIT-D155, KIT-T1114): a writer\'s declared [paths:] or an edit is refused only when it touches a file another live session or agent changed and has not committed, or the crate a running build of another writer compiles'], tokens: [T.paths, T.readOnly, T.maintainerParallel] },
      { check: BROKER_OWNED_CHECK, wants: ['a writer-capable agent never edits a lane a broker daemon owns: use the read-only patch-worker, or declare paths in another lane'], tokens: [T.paths, T.maintainerParallel] },
      { check: WORKER_CHECK, wants: [`at most ${DEFAULT_WRITER_CAP} live patch workers (broker.writer_cap) and declared, non-overlapping paths`], tokens: [T.paths, T.pathsUnknown, T.maintainerParallel] },
      { check: LESSONS_CHECK, wants: ['rendering, performance, asset or streaming work cites the framework lessons ledger ids it checked'], tokens: [T.lessonsChecked] },
      { check: CONFORMANCE_CHECK, wants: ['the same work names the framework conformance test in the brief'], tokens: [T.conformanceNotAffected] },
      { check: UI_CHECK, wants: ['UI sizing or layout work goes to claude-kit:rg-ui-engineer or names the framework mechanism it reuses'], tokens: [T.uiFrameworkChecked] },
      { check: BRIEF_GROUNDED_CHECK, wants: ['a feature or request ticket brief quotes the maintainer; a variant also names what it reuses'], tokens: [T.maintainerWords, T.reuses] },
      { check: RULINGS_CHECK, wants: ['a design or plan brief (job plan, or an analyst or researcher briefed with design words) cites the inbox search for maintainer rulings while the inbox holds un-triaged notes'], tokens: [T.rulingsChecked] },
      { check: FRAMEWORK_CHECK, wants: ['in a repo that uses a framework with a crate index (rapid-game: docs/CRATES.md), a plan or design brief names the indexed crates it read for each mechanism it proposes, or says none apply and why'], tokens: [T.frameworkChecked] },
      { check: HANDOFF_CHECK, wants: ['a dispatch that replaces an agent flagged for waste waits until that agent wrote its Handoff block in the ticket Notes'], tokens: [T.handoffWaived, T.writeHandoff] },
    ],
  },
  plan: {
    title: 'ExitPlanMode',
    hooks: ['plan-exit-gate (adopted repos)'],
    checks: [
      { check: FRAMEWORK_CHECK, wants: ['the plan text, in a repo that uses a framework with a crate index (rapid-game: docs/CRATES.md), names the indexed crates read for each mechanism the plan proposes, or says none apply and why'], tokens: [T.frameworkChecked] },
    ],
  },
  question: {
    title: 'AskUserQuestion / request_user_input',
    hooks: ['question-gate', 'reask-gate', 'ids-described-gate', 'question-grounded-gate', 'question-brief-gate (readiness)', 'question-brief-audit (after the call)'],
    checks: [
      { check: RECOMMENDATION_CHECK, wants: [`every question marks its recommended option on the LABEL with ${RECOMMENDED_MARKER} as the prefix (a suffix for request_user_input), and a single-select recommendation is the first option; the description never carries it`], tokens: [] },
      { check: REASK_CHECK, wants: [`no question another session asked and left unresolved within ${REASK_WINDOW_DAYS} days`], tokens: [T.reAsk] },
      { check: IDS_CHECK, wants: [`a ticket, decision or question id comes with at least ${IDS_MIN_HITS} distinctive words of its title`], tokens: [] },
      { check: GROUNDED_CHECK, wants: [`an option label is matched (words of ${GROUNDED_MIN_WORD}+ letters, stems, stopwords dropped) against the project's decisions and open tickets; a document sharing ${GROUNDED_MIN_SHARED}+ stems with the label, ${GROUNDED_MIN_TITLE}+ in its title (best ${GROUNDED_PER_OPTION} per option), must be cited by id with what it is in plain words, in the question text or an option description (the same-reply summary is unreadable before the call). Fails open on a store error.`, 'dry run before the call, with the gate\'s own matcher: q gates question --check "<label>" ["<label>" ...] prints per label the decisions and open tickets it matches (id and title)'], tokens: [T.optionsChecked] },
      { check: BRIEF_CHECK, wants: [`summary first, then the questionnaire (KIT-D153): ${BRIEF_RULE}. Text or narration of the turn before the call counts, as does the questionnaire's own question text; no wording or labels are required. Judged AFTER the call by a PostToolUse audit (Stop is the backstop): a missing summary is reported to you and you re-ask.`], tokens: [] },
      { check: READY_CHECK, wants: READINESS_STANDARD, tokens: [] },
    ],
  },
};

export const gateNames = () => Object.keys(GATES);

function projectWants(check, root) {
  if (check !== CONFORMANCE_CHECK || !root) return [];
  const names = conformanceTestsFor(root).map((n) => `\`${n}\``);
  return names.length ? [`in this project: name ${names.length > 1 ? 'one of ' : ''}${names.join(', ')} in the brief (the exact string the check matches)`] : [];
}

function checkLines({ check, wants, tokens }, root) {
  const [first, ...rest] = [...wants, ...projectWants(check, root)];
  const indent = ' '.repeat(CHECK_COLUMN);
  return [
    `  ${check}`.padEnd(CHECK_COLUMN) + first,
    ...rest.map((line) => `${indent}${line}`),
    ...tokens.map((t) => `${indent}tag: ${t.form}`),
  ];
}

const DIGEST_WIDTH = 110;
const MODEL_HINT = /pass (model:[^;]*?) on every call/;

function wrapWords(words, width, indent) {
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && line.length + 1 + w.length > width) { lines.push(line); line = indent + w; } else line = line ? `${line} ${w}` : w;
  }
  return line ? [...lines, line] : lines;
}

// One entry per distinct first tag form, as `check/check: form` for the checks that take it; the ladder entry also names the model parameter.
function digestEntries(gate) {
  const byForm = new Map();
  for (const { check, wants, tokens } of gate.checks) {
    if (!tokens.length) continue;
    const model = check === LADDER_CHECK ? (MODEL_HINT.exec(wants[0]) || [])[1] : null;
    const form = `${model ? `${model} or ` : ''}${tokens[0].form}`;
    byForm.set(form, [...(byForm.get(form) || []), check]);
  }
  return [...byForm].map(([form, checks]) => `${checks.join('/')}: ${form}`);
}

/**
 * The few lines orient prints at a compaction (KIT-T1053): per gated tool, the tag each check takes, derived from the gate
 * definitions above so it never drifts from them. `q gates <name>` prints the full requirements.
 */
export function gateDigest(gates = GATES) {
  return [
    `GATE DIGEST (after a compaction the per-type tags are not remembered; read q gates ${Object.keys(gates).join('|')} before the first call):`,
    ...Object.entries(gates).flatMap(([name, gate]) => {
      const entries = digestEntries(gate);
      return entries.length ? wrapWords([`${name}:`, ...entries.map((e, i) => (i < entries.length - 1 ? `${e};` : e))], DIGEST_WIDTH, '  ') : [];
    }),
  ];
}

export function gateText(name, { root } = {}) {
  const gate = GATES[name];
  if (!gate) return null;
  const tags = [...new Map(gate.checks.flatMap((c) => c.tokens).map((t) => [t.form, t])).values()];
  return [
    `GATE ${name}: ${gate.title}`,
    `hooks: ${gate.hooks.join(', ')}`,
    'A rejection lists every requirement that failed; satisfy all of them, then resend once. A block is satisfied, never routed around.',
    '',
    'REQUIREMENTS',
    ...gate.checks.flatMap((c) => checkLines(c, root)),
    ...(tags.length ? ['', 'ACCEPTED TAG FORMS (exact; in the prompt unless noted)', ...tags.map((t) => `  ${t.form}  `.padEnd(TAG_COLUMN) + t.meaning)] : []),
    ...(name === 'agent' ? ['', ...jobsSection({ root })] : []),
    '',
  ].join('\n');
}
