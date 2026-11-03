// question-brief.mjs — the content standard for the prose before a questionnaire (KIT-D129, KIT-T846): the options are
// short by design, so the brief carries the decision and why now, evidence with sources, each option's consequences,
// the recommendation's reason, and what is not being asked.
//
//   briefProblems(prose, questions) -> [{ part, wanted }] for every part the brief lacks; [] when it meets the standard
//   BRIEF_STANDARD                  -> the standard as lines, for a block message

import { stems } from './stems.mjs';

const MIN_WORDS = 120;
const MIN_SOURCES = 2;
const SOURCE = /(?:[\w.-]+[\\/])+[\w.-]+|\b[A-Z][A-Z0-9]+-[TDQ]\d{1,4}\b|\b[0-9a-f]{7,40}\b|\b[\w-]+\.(?:mjs|js|ts|rs|md|json|ya?ml|toml|cpp|h)\b(?::\d+)?|https?:\/\/\S+/g;
const DECISION = /\b(?:decision|decid(?:e|es|ed|ing)|choosing|the choice)\b/i;
const WHY_NOW = /\bwhy now\b|\bblocks?\b|\bblocking\b|\bwaiting on\b|\bneeded\b|\bbefore (?:i|we|the)\b|\bso that\b|\bbecause\b/i;
const DECISION_LINE = /^[ \t>*_-]*(?:\*\*|__)?decision(?:\*\*|__)?[ \t]*[:—-](?:\*\*|__)?[ \t]*(\S[^\n]*)$/im;
const MIN_DECISION_LINE_WORDS = 6;

// A plainly labelled `Decision:` line that states something is the decision statement; otherwise the prose must say
// what is being decided and why it is needed now.
function decisionStated(text) {
  const labelled = DECISION_LINE.exec(text);
  if (labelled && labelled[1].split(/\s+/).length >= MIN_DECISION_LINE_WORDS) return true;
  return DECISION.test(text) && WHY_NOW.test(text);
}
const CONSEQUENCE = /\b(?:costs?|risks?|means|leaves?|results? in|would|will|breaks?|saves?|keeps?|drops?|adds?|removes?|changes?)\b/gi;
const RECOMMEND = /\brecommend\w*\b[^\n]{0,300}?\b(?:because|since|reason|so that|as it|which)\b/i;
const NOT_ASKED = /\b(?:not (?:being )?asked|not asking|not deciding|out of scope|already settled|settled|stays? (?:open|as is)|left open|not part of)\b/i;
const OPTION_MARKER = /\(Recommended\)/gi;
const HALF = 2;

const STANDARD = {
  decision: 'decision: what is being decided and why it is needed now',
  evidence: `evidence: what you checked, with at least ${MIN_SOURCES} sources (file path, ticket or decision id, sha, URL, file:line)`,
  options: 'options: each option named, with what it does and what it costs (a sentence per option)',
  recommendation: 'recommendation: which option, and because why',
  notAsked: 'not asked: what this questionnaire leaves open or already treats as settled',
};
export const BRIEF_STANDARD = Object.values(STANDARD);

const optionLabels = (questions) => questions.flatMap((q) => (Array.isArray(q?.options) ? q.options : [])).map((o) => String(o?.label || '').replace(OPTION_MARKER, '').trim()).filter(Boolean);

function unnamedOptions(prose, questions) {
  const said = stems(prose);
  return optionLabels(questions).filter((label) => {
    const wanted = [...stems(label)];
    return wanted.length && wanted.filter((w) => said.has(w)).length < Math.ceil(wanted.length / HALF);
  });
}

export function briefProblems(prose, questions) {
  const text = String(prose || '');
  const words = text.split(/\s+/).filter(Boolean).length;
  const sources = new Set(text.match(SOURCE) || []).size;
  const labels = optionLabels(questions);
  const unnamed = unnamedOptions(text, questions);
  const missing = [];
  if (words < MIN_WORDS) missing.push({ part: 'length', wanted: `a brief of at least ${MIN_WORDS} words (this reply's prose has ${words}): the options cannot carry the context` });
  if (!decisionStated(text)) missing.push({ part: 'decision', wanted: STANDARD.decision });
  if (sources < MIN_SOURCES) missing.push({ part: 'evidence', wanted: `${STANDARD.evidence}; found ${sources}` });
  if (unnamed.length) missing.push({ part: 'options', wanted: `${STANDARD.options}; not named in the brief: ${unnamed.map((l) => `"${l}"`).join(', ')}` });
  else if ((text.match(CONSEQUENCE) || []).length < labels.length) missing.push({ part: 'options', wanted: `${STANDARD.options}; fewer consequence statements than options (${labels.length})` });
  if (!RECOMMEND.test(text)) missing.push({ part: 'recommendation', wanted: STANDARD.recommendation });
  if (!NOT_ASKED.test(text)) missing.push({ part: 'not asked', wanted: STANDARD.notAsked });
  return missing;
}
