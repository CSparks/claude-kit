// red-by-design-match — which red-test reports of a closing reply name a listed test (lib/red-by-design.mjs), so the
// red-test-dispatch gate exempts them and nothing else.
//
//   namesListedTest(text, entries) -> true when `text` names a listed test
//   unlistedReports(reports, rawText, entries) -> the reports that name no listed test; on any error, every report
//
// A test is named by its identifier (file name, path or a snake_case or kebab-case stem, matched exactly) or by its stem
// in words followed within a few words by a test noun ("the road geometry test", "frontage census access-ramp tests").
// A stem in words with no test noun after it ("the junction tests fail on the new road geometry") names nothing.
// A reply is read in its own voice, which drops backticked names, so a report's own sentence is looked up in the raw
// reply and read with its backticks open. A sentence naming a listed test is exempt whatever else it says: name an
// unlisted red in its own sentence.

import { ownVoice } from './prose-ask.mjs';

const SENTENCE_BREAK = /(?<=[.!?])\s+|\n+/;
const NOUN_REACH = 3;
const TEST_NOUNS = 'tests?|specs?|suites?|probes?|assertions?';
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const words = (s) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stemOf = (test) => test.replace(/\\/g, '/').split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/\.(?:test|spec)$/i, '');

const identifier = (text, stem) => /[_-]/.test(stem) && new RegExp(`(?<![a-z0-9])${escaped(stem.toLowerCase())}(?![a-z0-9])`).test(text.toLowerCase());
const inWords = (text, stem) => new RegExp(`${escaped(words(stem))}(?:[a-z0-9]+ ){0,${NOUN_REACH}}(?:${TEST_NOUNS}) `).test(words(text));

export function namesListedTest(text, entries) {
  return entries.some((entry) => {
    const stem = stemOf(entry.test);
    return stem && (identifier(text, stem) || inWords(text, stem));
  });
}

function openedSentences(rawText, report) {
  const aligned = String(rawText).split(SENTENCE_BREAK).filter((s) => squash(ownVoice(s)) === report.sentence);
  return aligned.length ? aligned.map((s) => s.replace(/`/g, ' ')) : [report.sentence];
}

export function unlistedReports(reports, rawText, entries) {
  if (!entries.length) return reports;
  try {
    return reports.filter((report) => !openedSentences(rawText, report).some((s) => namesListedTest(s, entries)));
  } catch {
    return reports;
  }
}
