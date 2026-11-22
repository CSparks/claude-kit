// red-test-report — the sentences of a reply or a capture that report failing tests (KIT-T1484). A red test is a fault to
// fix, so a turn that relays one dispatches a fix agent or says why one already runs; the red-test-dispatch Stop hook
// uses this.
//
//   redTestReports(text, { raw }) -> [{ sentence, phrase }] the sentences that name a test and say it fails, oldest first
//   explainsFix(text)             -> true when the reply says a fix agent already runs or the failure is already owned
//
// A reply is read in its own voice (lib/prose-ask.mjs ownVoice): fenced and inline code, blockquotes and double-quoted
// text never count. A capture command is read raw (its text sits inside quotes). A sentence that describes a fix
// ("fixed", "now passes", "green"), a negated count ("0 failed", "no failures") or test-writing talk ("write the failing
// test first", "should fail") is no report.

import { ownVoice } from './prose-ask.mjs';

const TEST_NOUN = /\b(?:tests?|test files?|test suites?|suites?|specs?|assertions?|probes?)\b|\.test\.[a-z]+\b|\btests\/|\btest_\w+|\b\w+_tests?\b|\bcargo test\b/i;

const COUNT_FAIL = /\b[1-9]\d*\s*(?:(?:of|out of|\/)\s*\d+\s+)?(?:\w+\s+)?(?:fail(?:ed|ing|s)?|red)\b/i;
const RED_PHRASES = [
  COUNT_FAIL,
  /\b\d+\s*\/\s*\d+\s+(?:\w+\s+)?(?:fail\w*|red)\b/i,
  /\bfail\w*\s+\d+\s*(?:\/|of|out of)\s*\d+/i,
  /\b(?:fail(?!-)|failing|fails|failed|broken|red)\b/i,
  /\bpre-?existing\b/i,
  /\btest failures?\b/i,
];

const NOT_A_REPORT = [
  /\b(?:fixed|fixes|repaired|resolved|green|no longer|stopped failing|now pass\w*|all pass\w*|passes now)\b/i,
  /\b(?:no|zero|none|nothing|without|never|not|0)\s+(?:\w+\s+){0,2}(?:fail\w*|red)\b/i,
  /\b(?:write|wrote|writing|add|added|adding|watch|watched)\s+(?:the |a |an )?(?:failing|red)\b/i,
  /\b(?:should|would|must|will|expected to|to) fail\b/i,
  /\bfail(?:s|ing)? first\b/i,
  /\bnegative control\b/i,
];

const FIX_EXPLANATIONS = [
  /\b(?:fix|repair)\w*\s+agent\b[^.!?\n]*\b(?:running|dispatched|working|in flight|queued|on it|owns|already)\b/i,
  /\b(?:already|currently)\s+(?:running|dispatched|being fixed|in flight|owned|has an? (?:fix|owner))\b/i,
  /\b(?:being|is) (?:fixed|repaired)\b/i,
  /\bagent\b[^.!?\n]*\b(?:is|are) (?:fixing|repairing)\b/i,
];

const SENTENCE_BREAK = /(?<=[.!?])\s+|\n+/;
const squash = (s) => s.replace(/\s+/g, ' ').trim();

const phraseOf = (sentence) => {
  for (const re of RED_PHRASES) {
    const m = re.exec(sentence);
    if (m) return m[0];
  }
  return null;
};

export function redTestReports(text, { raw = false } = {}) {
  if (typeof text !== 'string' || !text) return [];
  const body = raw ? text : ownVoice(text);
  return body.split(SENTENCE_BREAK).map(squash).filter(Boolean).flatMap((sentence) => {
    if (!TEST_NOUN.test(sentence) || NOT_A_REPORT.some((re) => re.test(sentence))) return [];
    const phrase = phraseOf(sentence);
    return phrase ? [{ sentence, phrase }] : [];
  });
}

export const explainsFix = (text) => typeof text === 'string' && FIX_EXPLANATIONS.some((re) => re.test(ownVoice(text)));
