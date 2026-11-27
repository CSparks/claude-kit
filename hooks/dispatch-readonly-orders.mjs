// readonly-orders — a dispatch check for dispatch-guard (KIT-T1488). The analyst, analyst-max, researcher and code-reviewer
// agents carry no build tool by their own limits: they never run cargo, a build, a test or restore-tree. A brief that orders one
// of them to run those is accepted today and the agent refuses under its own limits, returning an inference-only report: a wasted
// dispatch. The brief is refused up front and pointed at the writer-capable types (implementer, perf-tuner).
//
// An order is `cargo <verb>`, `builds --run`, `restore-tree`, "run the tests", `npm test`, `node x.test.mjs`. A clause that forbids
// it ("do not run cargo"), a clause that cites it as evidence or says another agent runs it, a command that is the subject of a
// describing verb ("cargo r builds these into the game", KIT-T1612) and a blockquote line are no order.
//
//   readOnlyOrders(prompt)                          -> the ordered commands found, [] when none
//   readOnlyOrdersBlock({ type, prompt, footer })   -> block message | null (check `readonly-orders`)

export const READONLY_ORDERS_CHECK = 'readonly-orders';

const NO_RUN_TYPES = new Set(['analyst', 'analyst-max', 'researcher', 'code-reviewer']);
const WRITER_TYPES = 'implementer or perf-tuner';
const NEGATION = /\b(?:never|don'?t|do not|must not|cannot|can'?t|not|no|without|avoid|skip|instead of|rather than)\b/i;
const NEGATION_REACH = 60;
const CLAUSE_END = /[.;\n]/;
const BLOCKQUOTE_LINE = /^[ \t]*>.*$/gm;
const ORDERS_SHOWN = 4;

const RUN_WORDS = String.raw`(?:run|re-?run|execute|launch)`;
const ORDERS = [
  /\bcargo(?:\.exe)?\s+(?:build|run|test|check|nextest|bench|clippy|doc|t|b|r)s?\b/gi,
  /\bbuilds\s+(?:--run|--result|--wait)\b/gi,
  /\brestore-tree\b/gi,
  new RegExp(String.raw`\b${RUN_WORDS}\s+(?:the|each|every|that|your|a|one|all|these|those)\s+(?:[\w'-]+\s+){0,2}(?:tests?|suites?|probes?|builds?)\b`, 'gi'),
  /\bnpm\s+(?:run\s+)?test\b/gi,
  /\bnode\s+\S+\.test\.mjs\b/gi,
];

const EVIDENCE = [
  /\bevidence\b/i,
  /\bfor reference\b/i,
  /\b(?:already|previously|earlier)\s+(?:ran|run)\b|\b(?:was|were|has been|have been|is being|are being)\s+run\b/i,
  /\b(?:run|runs|ran)\s+by\s+(?:another|someone|the (?:coordinator|orchestrator|implementer|perf-tuner|main thread|maintainer))\b/i,
  /\b(?:another agent|the (?:coordinator|orchestrator|implementer|perf-tuner|main thread|maintainer)|a writer)\s+(?:will\s+|already\s+|then\s+)?(?:run|runs|ran|has run)\b/i,
];

// A command that is the subject of a present-tense verb describes what it does ("cargo r builds these into the game",
// "cargo build -p x --release produces the exe"), unless a run word stands right before it or the clause asks the agent to
// verify it ("check that cargo r builds the game").
const DESCRIBING_VERBS = 'builds|compiles|runs|produces|prints|writes|makes|creates|emits|outputs|generates|bakes|packs|loads|starts|launches|opens|puts|turns|takes|reads|ships|links|does';
const DESCRIBED = new RegExp(String.raw`^(?:\s+-{1,2}[\w-]+(?:[= ][^\s-][^\s.,;]*)?)*\s+(?:${DESCRIBING_VERBS})\b`, 'i');
const RUN_WORD_BEFORE = new RegExp(String.raw`\b${RUN_WORDS}\s*$`, 'i');
const VERIFY_ORDER = /\b(?:check|confirm|verify|ensure|make sure|see (?:if|whether)|test (?:that|whether)|prove)\b/i;

const described = (text, m, before) => DESCRIBED.test(text.slice(m.index + m[0].length)) && !RUN_WORD_BEFORE.test(before) && !VERIFY_ORDER.test(before);

const clauseAround = (text, index, length) => {
  const before = text.slice(0, index).split(CLAUSE_END).pop();
  const after = text.slice(index + length).split(CLAUSE_END)[0];
  return { before, clause: `${before}${text.slice(index, index + length)}${after}` };
};

function ordered(text, m) {
  const { before, clause } = clauseAround(text, m.index, m[0].length);
  return !NEGATION.test(before.slice(-NEGATION_REACH)) && !EVIDENCE.some((re) => re.test(clause)) && !described(text, m, before);
}

export function readOnlyOrders(prompt) {
  const text = String(prompt || '').replace(BLOCKQUOTE_LINE, ' ');
  const found = ORDERS.flatMap((re) => [...text.matchAll(re)].filter((m) => ordered(text, m)).map((m) => m[0].trim().toLowerCase()));
  return [...new Set(found)];
}

export const noRunType = (type) => NO_RUN_TYPES.has(String(type || '').split(':').pop().trim().toLowerCase());

export function readOnlyOrdersBlock({ type, prompt, footer }) {
  if (!noRunType(type)) return null;
  const orders = readOnlyOrders(prompt);
  if (!orders.length) return null;
  const name = String(type).trim();
  return [
    `BLOCKED: this brief orders ${orders.slice(0, ORDERS_SHOWN).map((o) => `"${o}"`).join(', ')} for ${name}, an agent that cannot run them (KIT-T1488).`,
    `  ${name} carries no build tool by its own limits: it never runs cargo, builds, tests or restore-tree, refuses the order and returns a report`,
    '  built on inference alone, so the dispatch is wasted.',
    '',
    `Fix: dispatch a writer-capable type that can run them (${WRITER_TYPES}), adding [read-only: <reason>] when it changes no source; or drop the`,
    `  orders and brief ${name} on what it can read (cite the run output as evidence, or say the coordinator or another agent runs the command).`,
    '',
    footer,
  ].join('\n');
}
