// escaped-quote-gate.mjs — whether a command's quoting leaves a gh or git submission unreadable to the upstream gate (KIT-T1564).
//
//   quotingHidesSubmission(command, shell) -> boolean
//     True when the line is ambiguous under the tool's shell, when a segment opens a function definition or a compound command
//     the gate does not walk (for, case, select, function, name() { ... }), or when the line is ambiguous without a shell (an
//     escaped quote opens no string in bash, but a lexer that honours no escape opens one) and a segment holding an escaped quote
//     is anything other than a kit verb with no substitution. The verb is the first word of the segment past leading
//     assignments, read with the shell-aware lexer with every redirection and its target dropped; an escaped quote in an
//     assignment, a redirection or the verb word itself keeps the refusal. A kit verb's quoted arguments are data
//     (kit-led.mjs); every other segment with an escaped quote, a nested `bash -c` or `eval` string included, keeps the refusal.

import { fromCommandWord } from './command-lead.mjs';
import { KIT_TOOL } from './kit-led.mjs';
import { words } from './shell-lexer.mjs';
import { segments } from './shell-segments.mjs';

const ESCAPED_QUOTE = /\\["']|\$["']/;
const SUBSTITUTION = /\$\(|`|[<>]\(/;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const PROGRAM_NAME = /^[A-Za-z][\w.-]*$/;
const UNWALKED_COMPOUND = /^\s*(?:(?:for|case|select|function|coproc)\b|[\w.-]+\s*\(\s*\))/;
const unwalked = (text) => UNWALKED_COMPOUND.test(fromCommandWord(text));

// A segment led by a kit verb whose redirections, assignments and verb hold no escaped quote.
function kitVerbLeads(text, shell) {
  const tokens = words(text, { shell });
  const verbAt = tokens.findIndex((t) => !t.redirect && !ASSIGNMENT.test(t.value));
  if (verbAt < 0) return false;
  const lead = tokens.slice(0, verbAt + 1);
  const verb = lead[verbAt];
  return !lead.some((t) => ESCAPED_QUOTE.test(t.raw)) && PROGRAM_NAME.test(verb.raw) && KIT_TOOL.test(verb.value);
}

export function quotingHidesSubmission(command, shell) {
  const parts = segments(command, { shell });
  if (parts.ambiguous) return true;
  if ([...parts].some(({ text }) => unwalked(text))) return true;
  if (!segments(command).ambiguous) return false;
  return [...parts].some(({ text }) => ESCAPED_QUOTE.test(text) && !(kitVerbLeads(text, shell) && !SUBSTITUTION.test(text)));
}
