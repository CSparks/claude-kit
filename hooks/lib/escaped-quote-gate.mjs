// escaped-quote-gate.mjs — whether a command's quoting leaves a gh or git submission unreadable to the upstream gate (KIT-T1564).
//
//   quotingHidesSubmission(command, shell) -> boolean
//     True when the line is ambiguous under the tool's shell, or ambiguous without one (an escaped quote opens no string in
//     bash, but the regex tokenizer that reads each operand opens one) and a segment holding an escaped quote is anything other
//     than a kit verb with no substitution. A kit verb's quoted arguments are data (kit-led.mjs); every other segment with an
//     escaped quote, a nested `bash -c` or `eval` string included, keeps the blanket refusal until one lexer reads every operand.

import { kitLed } from './kit-led.mjs';
import { segments } from './shell-segments.mjs';

const ESCAPED_QUOTE = /\\["']|\$["']/;
const SUBSTITUTION = /\$\(|`|[<>]\(/;

export function quotingHidesSubmission(command, shell) {
  const parts = segments(command, { shell });
  if (parts.ambiguous) return true;
  if (!segments(command).ambiguous) return false;
  return [...parts].some(({ text }) => ESCAPED_QUOTE.test(text) && !(kitLed(text) && !SUBSTITUTION.test(text)));
}
