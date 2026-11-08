// gate-protocol — every requirement and accepted tag form of the gates a session meets before its first call to a
// gated tool (KIT-T898, KIT-D147). `q gates <gate>` prints gateText(name); check ids come from the modules that
// enforce them, tag forms from gate-tokens.mjs, the brief standard from question-brief.mjs.
//   GATES -> { agent, question }: { title, hooks, checks: [{ check, wants[], tokens[] }] }
//   gateText(name) -> the printable protocol, or null for an unknown name;  gateNames() -> the gate names

import { LABEL_CHECK, LABEL_REQUIREMENTS } from './dispatch-label.mjs';
import { TOKENS } from './gate-tokens.mjs';
import { BRIEF_CHECK as BRIEF_GROUNDED_CHECK } from '../dispatch-brief.mjs';
import { BROKER_OWNED_CHECK } from '../dispatch-broker.mjs';
import { CONFORMANCE_CHECK } from '../dispatch-conformance.mjs';
import { HANDOFF_CHECK } from '../dispatch-context.mjs';
import { ESCALATION_CHECK } from '../dispatch-escalation.mjs';
import { HOLDER_CHECK } from '../dispatch-holder.mjs';
import { JOB_CHECK } from '../dispatch-job.mjs';
import { LESSONS_CHECK } from '../dispatch-lessons.mjs';
import { UI_CHECK } from '../dispatch-ui.mjs';
import { WORKER_CHECK, DEFAULT_WRITER_CAP } from '../dispatch-worker.mjs';
import { BRIEF_CHECK, READY_CHECK, REASK_CHECK, IDS_CHECK, RECOMMENDED_MARKER, IDS_MIN_HITS, REASK_WINDOW_DAYS } from './question-checks.mjs';
import { BRIEF_STANDARD, BRIEF_MIN_WORDS } from './question-brief.mjs';
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
      { check: ESCALATION_CHECK, wants: ['a job no dearer than the default of the ticket type the brief names'], tokens: [T.escalate] },
      { check: COLD_BUILD_CHECK, wants: ['no worktree, clone or second checkout: one checkout, on main'], tokens: [T.maintainerWorktree] },
      { check: SHARED_TREE_CHECK, wants: ['one read/write agent per checkout; research agents are read-only types or carry the read-only tag'], tokens: [T.readOnly, T.tree, T.maintainerParallel] },
      { check: HOLDER_CHECK, wants: ['no writer into a checkout another session holds with a live writer (read from the holder registry; dirty files are never a writer)'], tokens: [T.readOnly, T.maintainerParallel] },
      { check: BROKER_OWNED_CHECK, wants: ['a writer-capable agent never edits a lane a broker daemon owns: use the read-only patch-worker, or declare paths in another lane'], tokens: [T.paths, T.maintainerParallel] },
      { check: WORKER_CHECK, wants: [`at most ${DEFAULT_WRITER_CAP} live patch workers (broker.writer_cap) and declared, non-overlapping paths`], tokens: [T.paths, T.pathsUnknown, T.maintainerParallel] },
      { check: LESSONS_CHECK, wants: ['rendering, performance, asset or streaming work cites the framework lessons ledger ids it checked'], tokens: [T.lessonsChecked] },
      { check: CONFORMANCE_CHECK, wants: ['the same work names the framework conformance test in the brief'], tokens: [T.conformanceNotAffected] },
      { check: UI_CHECK, wants: ['UI sizing or layout work goes to claude-kit:rg-ui-engineer or names the framework mechanism it reuses'], tokens: [T.uiFrameworkChecked] },
      { check: BRIEF_GROUNDED_CHECK, wants: ['a feature or request ticket brief quotes the maintainer; a variant also names what it reuses'], tokens: [T.maintainerWords, T.reuses] },
      { check: HANDOFF_CHECK, wants: ['a dispatch that replaces a past-ceiling agent waits until that agent wrote its Handoff block in the ticket Notes'], tokens: [T.handoffWaived, T.writeHandoff] },
    ],
  },
  question: {
    title: 'AskUserQuestion / request_user_input',
    hooks: ['question-gate', 'reask-gate', 'ids-described-gate', 'question-brief-gate'],
    checks: [
      { check: RECOMMENDATION_CHECK, wants: [`every question marks its recommended option on the LABEL with ${RECOMMENDED_MARKER} as the prefix (a suffix for request_user_input), and a single-select recommendation is the first option; the description never carries it`], tokens: [] },
      { check: REASK_CHECK, wants: [`no question another session asked and left unresolved within ${REASK_WINDOW_DAYS} days`], tokens: [T.reAsk] },
      { check: IDS_CHECK, wants: [`a ticket, decision or question id comes with at least ${IDS_MIN_HITS} distinctive words of its title`], tokens: [] },
      { check: BRIEF_CHECK, wants: [`prose of at least ${BRIEF_MIN_WORDS} words in an earlier reply of the turn (text or narration; one cheap tool call between the brief and the questionnaire):`, ...BRIEF_STANDARD], tokens: [] },
      { check: READY_CHECK, wants: READINESS_STANDARD, tokens: [] },
    ],
  },
};

export const gateNames = () => Object.keys(GATES);

function checkLines({ check, wants, tokens }) {
  const [first, ...rest] = wants;
  const indent = ' '.repeat(CHECK_COLUMN);
  return [
    `  ${check}`.padEnd(CHECK_COLUMN) + first,
    ...rest.map((line) => `${indent}${line}`),
    ...tokens.map((t) => `${indent}tag: ${t.form}`),
  ];
}

export function gateText(name) {
  const gate = GATES[name];
  if (!gate) return null;
  const tags = [...new Map(gate.checks.flatMap((c) => c.tokens).map((t) => [t.form, t])).values()];
  return [
    `GATE ${name}: ${gate.title}`,
    `hooks: ${gate.hooks.join(', ')}`,
    'A rejection lists every requirement that failed; satisfy all of them, then resend once. A block is satisfied, never routed around.',
    '',
    'REQUIREMENTS',
    ...gate.checks.flatMap(checkLines),
    ...(tags.length ? ['', 'ACCEPTED TAG FORMS (exact; in the prompt unless noted)', ...tags.map((t) => `  ${t.form}  `.padEnd(TAG_COLUMN) + t.meaning)] : []),
    '',
  ].join('\n');
}
