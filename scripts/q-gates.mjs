// q-gates.mjs — `q gates [<gate>]`: every requirement and exact tag form of a gated tool, read from the gate code
// (hooks/lib/gate-protocol.mjs), so a session reads the protocol before its first call (KIT-T898, KIT-D147).
// The conformance row names the test of the checkout at `root` (the cwd by default). Returns the process exit code.
//   q gates question --check "<label>" ["<label>" ...]   dry run of the question-grounded gate (KIT-T1101): per label,
//     the decisions and open tickets the gate's own matcher finds, so the citations are written before the call.
//   q gates question --check-text "<question text>" [...]   dry run of the clause rule (KIT-T1215): per text, the
//     decisions whose Decision clause the text restates, with the clause.

import { gateNames, gateText } from '../hooks/lib/gate-protocol.mjs';
import { groundingMatches } from '../hooks/lib/question-grounding.mjs';
import { clauseMatches } from '../hooks/lib/question-clause-grounding.mjs';
import { GROUNDED_CLAUSE_SHOWN } from '../hooks/lib/question-checks.mjs';
import { storeDocs } from '../hooks/lib/store-docs.mjs';

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
      out.write(`  ${m.id} (decision) "${m.title.slice(0, MAX_TITLE_SHOWN)}"\n    clause: "${m.clause.slice(0, GROUNDED_CLAUSE_SHOWN)}"\n`);
    }
  }
  return 0;
}

export function runGates(args, { out = process.stdout, err = process.stderr, root = process.cwd() } = {}) {
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
