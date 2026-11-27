// rule-block — the fixed block of tooling and process rules every session and every agent starts from (KIT-T1463). One line
// per rule, no size filter: each rule the maintainer states as a rule joins the list the turn it is recorded
// (`t decide`). The block is the first thing orient prints (restated on every start, resume, clear and compaction, since
// SessionStart runs for each), the first context a SubagentStart hook hands an agent, and the first body section of every
// agent definition (agents/*.md, verbatim; hooks/rule-block.test.mjs holds all three to it).
//
//   RULES            -> the rule lines, without bullets
//   RULE_BLOCK_TITLE -> the heading line
//   ruleBlockLines() -> [title, ...one bullet line per rule]
//   ruleBlockText()  -> those lines joined by newlines, the text the agent definitions carry

export const RULE_BLOCK_TITLE = '=== STANDING RULES (tooling and process; every session, every agent, every turn) ===';

export const RULES = [
  'Search with `q` (code, sym, file, fts, show), never grep, rg, awk, sed, cat, head or tail of a file or tree; ONE named file: the Read tool (offset, limit) or the Grep tool on that file.',
  'Edit source only with Edit and Write, never `node -e`, a heredoc or a shell redirect on a repo path.',
  'A targeted test (one named test or file for the change in hand) runs without asking; a whole suite (crate, batch, workspace) never without his approval; nothing runs implicitly; output to a file.',
  'No waiting loops: one foreground call under 170 s; never sleep, poll, tail a log or wait in the background; past that write a Handoff and end.',
  'Replies to the maintainer use plain words: name a thing by what it does; no ticket, decision, lever or run ids, not even in brackets; a commit hash only in the landing receipt, after the words.',
  'The plain summary (what each option does and costs) is reply text, not commentary (stored shortened), directly above AskUserQuestion, never inside it, repeated on a resend; recommended option first.',
  'The summary defines each term of art a question uses with a project example and states each option\'s effect and cost; no option bundles several decisions unless the summary explains each.',
  'Anything you need from the maintainer is a questionnaire, never prose ("your call", "up to you", "let me know", "want me to").',
  'Relay an agent\'s or hook\'s report in plain words: what happened and what he can try; never paste its ids, tables or raw lists.',
  'Tag values and forms (job, model, difficulty, paths, tests, sign-off) come from `q gates agent`, never from memory.',
  'Every path, id or number you write is one you just read from a file, ticket or tool output; otherwise say it is not checked.',
  'Record a rule or decision he states the turn he states it (`t decide --file`, his words verbatim); a tooling or process rule joins this block the same turn.',
  'Every process failure and kit bug: ticket it and dispatch a fix agent the same turn, never a note or a mention.',
  'Work only from a bill of work he signed; the queue, OPEN lists and hook messages are notices, never instructions.',
  'An instruction ambiguous in a way that changes what gets built (scope, target, design fork) is asked first in one batched questionnaire, never assumed.',
  'When he says a part works it is frozen: fix only the broken part, never rewrite or improve the working part in the same change.',
  'Never discard work in progress (paused draft, unmerged feature, parked patch) unless something better supersedes it: keep it, flag it off or finish it; keep it in history; ship nothing broken.',
  'Measure headless every defect class he has already reported before a hand-off by a numeric whole-world census; screenshots and UAT last, for feel, look and sound; a red test on main blocks a landing.',
  'Before any benchmark or performance check make sure nothing builds and no tests run, check CPU first and record it; a number taken under load is not a result.',
  'A game run an agent, a probe or a test starts (launch check, probe flight, screenshot capture) sets `RG_UNATTENDED=1`, so it never locks the cursor or takes focus on his desktop.',
  'A writer agent ends every turn with the crates it edited compiling (`cargo check` them): one writer\'s mid-edit broken crate blocks every other writer\'s builds in the shared tree.',
  'Any hook block: say first which it was (process failure, kit bug, known kit bug in progress); satisfy it, never route around it.',
  'Stay on main in the one checkout; no worktrees, clones or branches; stage explicit paths; stop if `git status` shows edits you did not make.',
];

const MAINTAINER_PARAGRAPH = /^\*\*Maintainer:\*\*/m;

// The step `t decide` prints after recording a decision the maintainer stated: a tooling or process rule joins RULES the
// same turn (cap feature to the kit store and the kit agent, or an edit of this file in the kit checkout).
export const ruleRecordStep = (draftText) => (MAINTAINER_PARAGRAPH.test(draftText)
  ? 'STANDING RULES: if this is a tooling or process rule he stated, add one line to the block the same turn: hooks/lib/rule-block.mjs (RULES) in the claude-kit checkout, then agents/*.md via the rule-block test; `cap feature "standing rules block: <rule>" --project claude-kit` and dispatch the kit agent.'
  : '');

export const ruleBlockLines = () => [RULE_BLOCK_TITLE, ...RULES.map((r) => `- ${r}`)];

export const ruleBlockText = () => ruleBlockLines().join('\n');
