// question-ready.mjs — is the topic ready for a questionnaire (KIT-T846)? A floated idea or a question is discussion: it
// is answered in prose and allowed to converge before any choice is put to the maintainer. Two refusals:
//   exploring  the end of the newest maintainer message is a question or a floated idea and does not invite a questionnaire
//   stated     a question restates what the newest maintainer message already says (the answer is in his words)
//
//   readinessProblems(lastUser, questions) -> [{ part, wanted }]; [] when the topic is ready

import { stems } from './stems.mjs';

const EXPLORING = /\?|\b(?:should we|should i|what if|maybe|perhaps|thoughts|wondering|could we|how about|what do you think|what about|trade-?offs?)\b/i;
const INVITES = /\b(?:ask me|questionnaire|AskUserQuestion|\/decide|let'?s decide|pick (?:what|the|one)|what'?s next|which (?:one )?(?:do|should) (?:we|you)|your recommendation)\b/i;
const MIN_STATED_STEMS = 4;
const STATED_SHARE = 0.75;
const QUOTE_CHARS = 140;
const TAIL_CHARS = 240;

const askText = (q) => [q?.header, q?.question].filter(Boolean).join(' ');

export const READINESS_STANDARD = [
  'exploring: the newest maintainer message is not a question or a floated idea; answer those in prose and let the discussion converge, ask once the choice is his (a message that says "ask me" or invokes /decide invites the questionnaire)',
  `stated: no question restates what his newest message already says (${Math.round(STATED_SHARE * 100)}% of a question's words, at least ${MIN_STATED_STEMS}); act on his words`,
];

function statedQuestions(lastUser, questions) {
  const said = stems(lastUser);
  return questions.filter((q) => {
    const wanted = [...stems(askText(q))];
    return wanted.length >= MIN_STATED_STEMS && wanted.filter((w) => said.has(w)).length / wanted.length >= STATED_SHARE;
  });
}

export function readinessProblems(lastUser, questions) {
  const said = String(lastUser || '').trim();
  if (!said) return [];
  const quote = said.replace(/\s+/g, ' ').slice(0, QUOTE_CHARS);
  const missing = [];
  if (EXPLORING.test(said.slice(-TAIL_CHARS)) && !INVITES.test(said)) missing.push({ part: 'exploring', wanted: `his newest message is a question or a floated idea ("${quote}"): answer it in prose and let the discussion reach a conclusion before asking` });
  for (const q of statedQuestions(said, questions)) missing.push({ part: 'stated', wanted: `"${askText(q)}" restates what he already said ("${quote}"): act on his words, do not ask them back` });
  return missing;
}
