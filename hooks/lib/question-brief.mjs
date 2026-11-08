// question-brief.mjs — the content standard for the prose before a questionnaire (KIT-D129, KIT-T846): the options are
// short by design, so the brief carries the decision and why now, evidence with sources, each option's consequences,
// the recommendation's reason, and what is not being asked.
//
//   briefProblems(prose, questions) -> [{ part, wanted }] for every part the brief lacks; [] when it meets the standard.
//                                      `wanted` is the exact phrase to write.
//   BRIEF_STANDARD                  -> the standard as lines, for a block message

import { stems } from './stems.mjs';
import { sectionBody, sentences } from './brief-sections.mjs';

const MIN_WORDS = 120;
const MIN_SOURCES = 2;
const MIN_DECISION_WORDS = 6;
const MIN_REASON_WORDS = 5;
const SOURCE = /(?:[\w.-]+[\\/])+[\w.-]+|\b[A-Z][A-Z0-9]+-[TDQ]\d{1,4}\b|\b[0-9a-f]{7,40}\b|\b[\w-]+\.(?:mjs|js|ts|rs|md|json|ya?ml|toml|cpp|h)\b(?::\d+)?|https?:\/\/\S+/g;
const DECISION = /\b(?:decision|decid(?:e|es|ed|ing)|choosing|the choice)\b/i;
const WHY_NOW = /\bwhy now\b|\bblocks?\b|\bblocking\b|\bwaiting on\b|\bneeded\b|\bbefore (?:i|we|the)\b|\bso that\b|\bbecause\b/i;
const DECISION_LABELS = 'decision|the choice|choice|sign-?off|needs your (?:sign-?off|decision|call|answer|choice|approval)|what i am asking';
const RECOMMEND_LABELS = 'recommend(?:ation|ed)?';
const CONSEQUENCE = /\b(?:costs?|risks?|means|leaves?|results? in|would|will|breaks?|saves?|keeps?|drops?|adds?|removes?|changes?)\b/gi;
const REASON_WORDS = 'because|since|reason|so that|as it|which|given|due to|why';
const RECOMMEND = new RegExp(`\\brecommend\\w*\\b(?:(?!\\n[ \\t]*\\n)[\\s\\S]){0,300}?\\b(?:${REASON_WORDS})\\b`, 'i');
const NOT_ASKED = /\b(?:not (?:being )?asked|not asking|not deciding|out of scope|already settled|settled|stays? (?:open|as is)|left open|not part of)\b/i;
const OPTION_MARKER = /\(Recommended\)/gi;
const HALF = 2;

const STANDARD = {
  decision: 'decision: write "Decision: <what is being decided>, needed now because <why>." (or a line labelled "Needs your sign-off:" that says what he signs)',
  evidence: `evidence: write "Evidence: <what you checked>" with at least ${MIN_SOURCES} sources (file path, KIT-T### or KIT-D### id, sha, URL, file:line)`,
  options: 'options: one sentence per option, naming it as its label reads: "<option label> <what it does and what it costs>."',
  recommendation: 'recommendation: write "Recommendation: <option label>, because <reason>." (or a Recommendation paragraph: the pick as its first sentence, the reason in the next)',
  notAsked: 'not asked: write "Not asked: <what this leaves open or already treats as settled>."',
};
export const BRIEF_STANDARD = Object.values(STANDARD);

export const wordCount = (text) => String(text).split(/\s+/).filter(Boolean).length;
const optionLabels = (questions) => questions.flatMap((q) => (Array.isArray(q?.options) ? q.options : [])).map((o) => String(o?.label || '').replace(OPTION_MARKER, '').trim()).filter(Boolean);

const namedIn = (said, label) => {
  const wanted = [...stems(label)];
  return wanted.length > 0 && wanted.filter((w) => said.has(w)).length >= Math.ceil(wanted.length / HALF);
};

function unnamedOptions(prose, questions) {
  const said = stems(prose);
  return optionLabels(questions).filter((label) => stems(label).size > 0 && !namedIn(said, label));
}

// A plainly labelled decision section that states something is the decision statement; otherwise the prose must say
// what is being decided and why it is needed now.
function decisionStated(text) {
  if (wordCount(sectionBody(text, DECISION_LABELS)) >= MIN_DECISION_WORDS) return true;
  return DECISION.test(text) && WHY_NOW.test(text);
}

// An option labelled "A: ..." is picked by its key after a picking verb: "Take A", "Option B".
const pickedByKey = (body, label) => {
  const key = /^(?:[A-Z]|\d{1,2})(?=[:.)])/.exec(label)?.[0];
  return !!key && new RegExp(`\\b(?:[Tt]ake|[Pp]ick|[Cc]hoose|[Gg]o with|[Uu]se|[Oo]ption|[Cc]hoice)\\s+${key}\\b`).test(body);
};

// '' when the recommendation names its reason; else what the brief lacks. A Recommendation section passes when its first
// sentence is the pick (it names an option) and the sentences after it carry the reason.
function recommendationGap(text, questions) {
  if (RECOMMEND.test(text)) return '';
  const body = sectionBody(text, RECOMMEND_LABELS);
  if (!body) return STANDARD.recommendation;
  const said = stems(body);
  const lacks = [
    ...(optionLabels(questions).some((label) => namedIn(said, label) || pickedByKey(body, label)) ? [] : ['names no option']),
    ...(wordCount(sentences(body).slice(1).join(' ')) >= MIN_REASON_WORDS ? [] : [`gives no reason sentence of at least ${MIN_REASON_WORDS} words after the pick`]),
  ];
  return lacks.length ? `${STANDARD.recommendation}; found a Recommendation section, but it ${lacks.join(' and ')}` : '';
}

export function briefProblems(prose, questions) {
  const text = String(prose || '');
  const words = wordCount(text);
  const sources = new Set(text.match(SOURCE) || []).size;
  const labels = optionLabels(questions);
  const unnamed = unnamedOptions(text, questions);
  const recommendation = recommendationGap(text, questions);
  const missing = [];
  if (words < MIN_WORDS) missing.push({ part: 'length', wanted: `a brief of at least ${MIN_WORDS} words (the text counted from this turn has ${words}): the options cannot carry the context` });
  if (!decisionStated(text)) missing.push({ part: 'decision', wanted: STANDARD.decision });
  if (sources < MIN_SOURCES) missing.push({ part: 'evidence', wanted: `${STANDARD.evidence}; found ${sources}` });
  if (unnamed.length) missing.push({ part: 'options', wanted: `${STANDARD.options}; not named in the brief: ${unnamed.map((l) => `"${l}"`).join(', ')}` });
  else if ((text.match(CONSEQUENCE) || []).length < labels.length) missing.push({ part: 'options', wanted: `${STANDARD.options}; fewer consequence statements than options (${labels.length})` });
  if (recommendation) missing.push({ part: 'recommendation', wanted: recommendation });
  if (!NOT_ASKED.test(text)) missing.push({ part: 'not asked', wanted: STANDARD.notAsked });
  return missing;
}
