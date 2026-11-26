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
  'exploring: the newest maintainer message is not a question or a floated idea; answer those in prose and let the discussion converge, ask once the choice is his (a message that says "ask me" or invokes /decide invites the questionnaire; a message whose words after its last question sign off work ("let\'s do X", "sounds good") is ready; a turn whose prose says work waits on him ("waiting on you", "your call") also passes; prose in the same reply as the call is not on disk before the call, so an answer to his question goes in an earlier reply)',
  `stated: no question restates what his newest message already says (${Math.round(STATED_SHARE * 100)}% of a question's words, at least ${MIN_STATED_STEMS}); act on his words`,
];

function statedQuestions(lastUser, questions) {
  const said = stems(lastUser);
  return questions.filter((q) => {
    const wanted = [...stems(askText(q))];
    return wanted.length >= MIN_STATED_STEMS && wanted.filter((w) => said.has(w)).length / wanted.length >= STATED_SHARE;
  });
}

// A question mark in a yelled or profane message with no question word is anger, not a question to answer.
const QUESTION_WORD = /\b(?:what|which|how|why|who|where|when|should|could|would|can you|is it|are we|do we|do you)\b/i;
const PROFANE = /\b(?:fuck\w*|shit\w*|damn\w*|wtf|bullshit)\b/i;
const SHOUTING_SHARE = 0.6;
const MIN_SHOUTED_LETTERS = 8;

function rhetorical(tail) {
  if (QUESTION_WORD.test(tail)) return false;
  const letters = tail.replace(/[^A-Za-z]/g, '');
  const shouted = letters.length >= MIN_SHOUTED_LETTERS && letters.replace(/[^A-Z]/g, '').length / letters.length >= SHOUTING_SHARE;
  return PROFANE.test(tail) || shouted;
}

// Sign-off of named work after his last question settles the message: the questionnaire may ask about what he signed (KIT-T1594).
// A negation or hold in that trailer withholds the sign-off.
const SIGN_OFF = /\b(?:let['’]?s (?:do|go|ship|build|start|proceed|make)|go ahead|go with|just do it|ship it|sounds? (?:good|great|fine|right)|good plans?|approved|signed off|sign off on|agreed)\b/i;
const WITHHELD = /\b(?:not|no|never|until|unless|wait|hold off)\b|n['’]t\b/i;

function signedAfterQuestion(tail) {
  const trailer = tail.slice(tail.lastIndexOf('?') + 1);
  return tail.includes('?') && SIGN_OFF.test(trailer) && !WITHHELD.test(trailer) && !EXPLORING.test(trailer);
}

const isExploring = (tail) => {
  const asked = rhetorical(tail) ? tail.replace(/\?/g, '') : tail;
  return EXPLORING.test(asked) && !signedAfterQuestion(asked);
};

/** `answered`: an assistant prose reply already followed the message, so a question in it has its answer. */
export function readinessProblems(lastUser, questions, { answered = false } = {}) {
  const said = String(lastUser || '').trim();
  if (!said) return [];
  const quote = said.replace(/\s+/g, ' ').slice(0, QUOTE_CHARS);
  const tail = said.slice(-TAIL_CHARS).replace(/\s+/g, ' ');
  const missing = [];
  if (!answered && isExploring(said.slice(-TAIL_CHARS)) && !INVITES.test(said)) missing.push({ part: 'exploring', wanted: `his newest message ends in a question or a floated idea ("${tail}") and no earlier prose reply has answered it (prose in the same reply as this call is not on disk before the call): answer it in prose and let the discussion reach a conclusion before asking` });
  for (const q of statedQuestions(said, questions)) missing.push({ part: 'stated', wanted: `"${askText(q)}" restates what he already said ("${quote}"): act on his words, do not ask them back` });
  return missing;
}
