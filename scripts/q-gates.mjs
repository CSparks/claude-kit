// q-gates.mjs — `q gates [<gate>]`: every requirement and exact tag form of a gated tool, read from the gate code
// (hooks/lib/gate-protocol.mjs), so a session reads the protocol before its first call (KIT-T898, KIT-D147).
// The conformance row names the test of the checkout at `root` (the cwd by default). Returns the process exit code.
//   q gates question --draft <file.json>   dry run of EVERY questionnaire gate on a draft (KIT-T1451): all failures at once, each with its fix;
//     the draft is { "summary": "<the text above the call>", "questions": [...] } or the questions array alone. Exit 2 when a gate refuses.
//   q gates question --check "<label>" ["<label>" ...]   dry run of the question-grounded gate (KIT-T1101): per label,
//     the decisions and open tickets the gate's own matcher finds, so the citations are written before the call.
//   q gates question --check-text "<question text>" [...]   dry run of the clause rule (KIT-T1215): per text, the
//     decisions whose Decision clause the text restates, with the clause, its score and the rare stems matched.

import { readFileSync } from 'node:fs';
import { gateNames, gateText } from '../hooks/lib/gate-protocol.mjs';
import { consolidatedBlock, runQuestionGates } from '../hooks/lib/question-gates-run.mjs';
import { briefProblems } from '../hooks/lib/question-brief.mjs';
import { groundingMatches } from '../hooks/lib/question-grounding.mjs';
import { clauseMatches } from '../hooks/lib/question-clause-grounding.mjs';
import { GROUNDED_CLAUSE_SCORE, GROUNDED_CLAUSE_SHOWN } from '../hooks/lib/question-checks.mjs';
import { storeDocs } from '../hooks/lib/store-docs.mjs';

const DRAFT_FLAG = '--draft';
const CHECK_FLAG = '--check';
const CHECK_TEXT_FLAG = '--check-text';
const MAX_TITLE_SHOWN = 90;

function checkLabels(labels, root, { out, err }) {
  if (!labels.length) {
    err.write('q gates question --check: give at least one option label, e.g. q gates question --check "Share meshes across cells"\n');
    return 1;
  }
  const docs = storeDocs(root);
  for (const label of labels) {
    out.write(`${label}\n`);
    const matches = groundingMatches(docs, label);
    if (!matches.length) out.write('  none: the gate finds no decision or open ticket for this label\n');
    for (const m of matches) out.write(`  ${m.id} (${m.kind}) "${m.title.slice(0, MAX_TITLE_SHOWN)}"\n`);
  }
  return 0;
}

function checkTexts(texts, root, { out, err }) {
  if (!texts.length) {
    err.write('q gates question --check-text: give the question text, e.g. q gates question --check-text "Should a scene render read the Song tempo?"\n');
    return 1;
  }
  const docs = storeDocs(root);
  for (const text of texts) {
    out.write(`${text}\n`);
    const matches = clauseMatches(docs, text);
    if (!matches.length) out.write('  none: no decision clause shares enough words with this text\n');
    for (const m of matches) {
      out.write(`  ${m.id} (decision) "${m.title.slice(0, MAX_TITLE_SHOWN)}"\n    clause: "${m.clause.slice(0, GROUNDED_CLAUSE_SHOWN)}"\n    score ${m.score} (gate blocks at ${GROUNDED_CLAUSE_SCORE}), rare stems: ${m.rare.join(', ')}; all matched: ${m.stems.join(', ')}\n`);
    }
  }
  return 0;
}

const SUMMARY_FIX = 'write 40+ words of plain summary in the SAME message as the AskUserQuestion call, directly above it (no tool call between): what is being decided, what each option does and costs, your recommendation';

// The dry run of every PreToolUse questionnaire gate on a draft (KIT-T1451): the same gates the hook runs, every failure at
// once. The draft is `{ "summary": "<the text you will write above the call>", "questions": [...] }` or the questions array alone.
async function checkDraft(file, root, { out, err }) {
  let draft;
  try {
    draft = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    err.write(`q gates question --draft: cannot read ${file} as JSON (${e.message}). Give a file of { "summary": "...", "questions": [ { header, question, options: [{ label, description }] } ] }\n`);
    return 1;
  }
  const questions = Array.isArray(draft) ? draft : draft?.questions;
  if (!Array.isArray(questions) || !questions.length) {
    err.write('q gates question --draft: the file holds no questions array\n');
    return 1;
  }
  const { blocks, context } = await runQuestionGates({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions }, cwd: root }, { cwd: root });
  const summary = Array.isArray(draft) ? null : draft.summary;
  if (summary !== null && summary !== undefined) {
    const problems = briefProblems(summary);
    if (problems.length) blocks.push({ gate: 'question-brief (summary above the call)', text: `${problems[0].wanted}\nFix: ${SUMMARY_FIX}.` });
  }
  if (blocks.length) {
    out.write(consolidatedBlock(blocks));
    return 2;
  }
  out.write('PASS: every PreToolUse questionnaire gate accepts this draft.\n');
  if (summary === null || summary === undefined) out.write(`NOTE: the draft has no "summary". The audit after the call judges it: ${SUMMARY_FIX}. Add "summary" to the draft to check its length now.\n`);
  out.write('NOTE: question-ready (is the topic ready to ask) reads the live transcript and is not judged here.\n');
  for (const c of context) out.write(`\n${c}\n`);
  return 0;
}

export async function runGates(args, { out = process.stdout, err = process.stderr, root = process.cwd() } = {}) {
  const name = String(args[0] || '').toLowerCase();
  if (!name) {
    out.write(`gates: ${gateNames().join(', ')}\nq gates <gate> prints the requirements and accepted tag forms of one.\n`);
    return 0;
  }
  const text = gateText(name, { root });
  if (!text) {
    err.write(`q gates: unknown gate '${name}'. Gates: ${gateNames().join(', ')}\n`);
    return 1;
  }
  if (args[1] === DRAFT_FLAG) {
    if (name !== 'question') {
      err.write('q gates: --draft is the dry run of the question gates: q gates question --draft <file.json>\n');
      return 1;
    }
    if (!args[2]) {
      err.write('q gates question --draft: give the draft file, e.g. q gates question --draft draft.json\n');
      return 1;
    }
    return checkDraft(args[2], root, { out, err });
  }
  if (args[1] === CHECK_FLAG || args[1] === CHECK_TEXT_FLAG) {
    if (name !== 'question') {
      err.write(`q gates: ${args[1]} is the dry run of the question gate: q gates question ${args[1]} "<${args[1] === CHECK_FLAG ? 'label' : 'question text'}>"\n`);
      return 1;
    }
    return (args[1] === CHECK_FLAG ? checkLabels : checkTexts)(args.slice(2), root, { out, err });
  }
  out.write(text);
  return 0;
}
