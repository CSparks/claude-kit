// question-explain-audit — the check that the summary above a questionnaire explains the questions (RDG-D176, KIT-T1515). The
// same-reply summary is unreadable before the call, so the dry run (q gates question --draft, summary field) and the
// after-the-call audit (question-brief-audit.mjs) judge it; the pre-call question-bundle-gate judges the questionnaire alone.
//
//   summaryBundleProblems(prose, questions) -> [{ ...bundle, found, unnamed }] bundles whose parts the summary does not all name;
//                                              a question carrying [bundle-checked: ...] is skipped
//   bundleAuditMessage(problems)            -> the text sent to the model ('' when none)
//   summaryTermWarnings(prose, questions, docs) -> [string] terms of art no sentence of the summary mentions (advisory)
//   termWarningMessage(terms)               -> the advisory text ('' when none)
//   termDocs(root)                          -> the store documents the term check weighs rarity by ([] on a store error)

import { bundledOptions, bundleShortfalls, hasBundleChecked, unnamedParts } from './question-bundle.mjs';
import { unexplainedTerms } from './question-terms.mjs';
import { BUNDLE_CHECK } from './question-checks.mjs';
import { TOKENS } from './gate-tokens.mjs';
import { excludeFooter } from './exclusions.mjs';
import { storeDocs } from './store-docs.mjs';

const rawText = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.flatMap((o) => [o?.label, o?.description]) : [])].filter(Boolean).join(' ');

export function summaryBundleProblems(prose, questions) {
  const open = (Array.isArray(questions) ? questions : []).filter((q) => !hasBundleChecked(rawText(q)));
  const unlisted = new Set(bundleShortfalls(bundledOptions(open)).map((b) => b.label));
  return bundledOptions(open)
    .map((b) => ({ ...b, found: b.parts.length, unnamed: unnamedParts(b, prose) }))
    .filter((b) => b.unnamed.length || unlisted.has(b.label));
}

export function bundleAuditMessage(problems) {
  if (!problems.length) return '';
  return [
    'Question-bundle audit (RDG-D176): an option bundles several decisions and the summary above the questionnaire does not explain each part.',
    ...problems.map((b) => `  "${b.label}" (${b.header}): ${b.unnamed.length ? `the summary never names: ${b.unnamed.join(' | ')}` : `its parts cannot be told apart (${b.found} listed${b.count ? `, the label says ${b.count}` : ''})`}`),
    'Say again, in the summary, what each part is in plain words, what it does and costs, then re-ask; or split the bundle into one question per decision.',
    `When the label is one decision on purpose, add ${TOKENS.bundleChecked.form} to the question text.`,
    excludeFooter(BUNDLE_CHECK),
  ].join('\n');
}

export function termDocs(root) {
  try { return storeDocs(root); } catch { return []; }
}

export const summaryTermWarnings =(prose, questions, docs) => unexplainedTerms(prose, questions, docs);

export function termWarningMessage(terms) {
  if (!terms.length) return '';
  return `Question-terms note (RDG-D176, advisory): the questions use these terms and no sentence of the summary mentions them: ${terms.join(', ')}. If the maintainer has not been told what one means, define it in the summary with a project example and re-ask.`;
}
