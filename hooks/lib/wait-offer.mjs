// wait-offer — text that offers the maintainer a wait over WAIT_MAX_SECONDS to accept (KIT-T1480): a duration ("3 minutes",
// "three-minute", "180 s", "1m30s", "a minute and a half") in the same unit as a cue to accept or keep it. A unit that cuts
// the duration down is no offer; milliseconds and bare metres are never durations. [wait-checked: ...] text is cut first.
//
//   waitOffers(text)         -> offers in the sentences of `text` (summary prose): [{ seconds, phrase, unit }]
//   optionWaitOffers(option) -> offers in one option, its label and description read as one unit
//   stripWaitChecked(text)   -> the text with every [wait-checked: ...] tag cut
//   hasWaitChecked(text)     -> true when the text carries the tag

import { WAIT_MAX_SECONDS } from './question-checks.mjs';
import { TOKENS } from './gate-tokens.mjs';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const HALF = 0.5;

const WORD_NUMBERS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, couple: 2, few: 3, several: 3,
};
const UNIT_SECONDS = { s: 1, sec: 1, second: 1, min: SECONDS_PER_MINUTE, minute: SECONDS_PER_MINUTE, h: SECONDS_PER_HOUR, hr: SECONDS_PER_HOUR, hour: SECONDS_PER_HOUR };
const SYMBOL_UNITS = new Set(['s', 'h']);

const NUMBER = `\\d+(?:\\.\\d+)?|${Object.keys(WORD_NUMBERS).join('|')}`;
const QUANTITY = new RegExp(`\\b(?<number>${NUMBER})(?:\\s+of)?(?<lead>\\s+and\\s+a\\s+half)?[\\s-]*(?<unit>seconds?|secs?|minutes?|mins?|hours?|hrs?|s|h)\\b(?<tail>\\s+and\\s+a\\s+half)?`, 'gi');
const COMPOUND = /\b(?<minutes>\d+)\s?m\s?(?<rest>\d+)\s?s\b/gi;

const ACCEPT_CUE = /\b(?:accept\w*|keep\w*|kept|live[sd]? with|living with|tolerat\w*|put(?:s|ting)? up with|settle[sd]? for|stay\w*|leave\w*|left|as[- ]is|unchanged|ship\w* with|okay|ok|fine with|acceptable|absorb\w*|endure|bear with|wait\w*)\b/i;
const CUTS_DURATION = /\b(?:cut\w*|reduc\w*|shorten\w*|shrink\w*|speed\w*|eliminat\w*|remov\w*|avoid\w*|under|below|within|less than|down to)\b/i;
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z(])|\n+|;/;
const TAG = new RegExp(TOKENS.waitChecked.pattern.source, 'gi');
const DIGIT = /^\d/;

const quantitySeconds = ({ number, lead, unit, tail }) => {
  const count = DIGIT.test(number) ? Number(number) : WORD_NUMBERS[number.toLowerCase()];
  const name = unit.toLowerCase();
  return (count + (lead || tail ? HALF : 0)) * (UNIT_SECONDS[name] ?? UNIT_SECONDS[name.replace(/s$/, '')]);
};

function durations(text) {
  const found = [];
  for (const m of text.matchAll(COMPOUND)) found.push({ seconds: Number(m.groups.minutes) * SECONDS_PER_MINUTE + Number(m.groups.rest), phrase: m[0] });
  for (const m of text.matchAll(QUANTITY)) {
    if (SYMBOL_UNITS.has(m.groups.unit.toLowerCase()) && !DIGIT.test(m.groups.number)) continue;
    found.push({ seconds: quantitySeconds(m.groups), phrase: m[0].trim() });
  }
  return found.filter((d) => d.seconds > WAIT_MAX_SECONDS);
}

function offersIn(unit) {
  if (!ACCEPT_CUE.test(unit) || CUTS_DURATION.test(unit)) return [];
  return durations(unit).map((d) => ({ ...d, unit: unit.replace(/\s+/g, ' ').trim() }));
}

export const stripWaitChecked = (text) => String(text ?? '').replace(TAG, ' ');
export const hasWaitChecked = (text) => TOKENS.waitChecked.pattern.test(String(text ?? ''));

export const waitOffers = (text) => stripWaitChecked(text).split(SENTENCE_BREAK).flatMap(offersIn);

export const optionWaitOffers = (option) => offersIn(stripWaitChecked(`${option?.label || ''} — ${option?.description || ''}`));
