// shell-variables.mjs — the plain literal a variable holds when the command itself assigns it (KIT-T1075).
// A cp whose destination is `"$SCRATCH/a.cpp.bak"` is judged by where it lands; the gate cannot see the shell's
// environment, so it resolves a variable only from an assignment it can prove: one literal `NAME=value` (bash) or
// `$name = 'value'` (PowerShell) segment that runs unconditionally before the use, the only write to that name in the
// whole command. Every other variable stays unresolved and the copy stays fail-closed.
//
//   assignedValues(parts, shell) -> Map<segment, Map<name, value>>   the variables each segment of `parts` can read
//   expandVariables(text, values, shell) -> text   `$NAME` and `${NAME}` replaced where the shell would expand them
//
// A value is expanded unquoted only when the shell would not split or glob it (no whitespace, no glob character);
// inside double quotes any literal is safe; inside single quotes and behind an escape nothing expands.

import { shellTokens, dequoted } from './shell-segments.mjs';

const POWERSHELL = 'powershell';
const BASH_ASSIGN = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const BASH_DECLARE = /^(?:export|declare|typeset|readonly|local)$/;
const PS_ASSIGN = /^\s*\$([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("[^"$`]*"|'[^']*')\s*$/;
const IMPURE_VALUE = /^~|[$`\n]/;
const BASH_ESCAPE_IN_DOUBLE_QUOTES = /\\[\\"$`]|\\$/;
const PLAIN_VALUE = /^[\w@%+=:,./-]+$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const UNCONDITIONAL_BEFORE = new Set(['start', ';']);
const SEQUENTIAL_AFTER = new Set([';', '&&']);
// A rebinder is a whole word: never a piece of a path or filename (`hooks/source-x.mjs`, `eval-utils.cpp`).
// A backslash before the word joins a path only after a path character; at a command boundary it is the escape that
// still runs the builtin. A `$` after the word is an expansion that splits into the command, never a filename.
const PATH_BEFORE = String.raw`[\w./~$-]`;
const PATH_AFTER = String.raw`[\w./\\~-]`;
const WHOLE_WORD = (word) => String.raw`(?<!${PATH_BEFORE})(?<!${PATH_BEFORE}\\)(?<!:\\)(?:${word})(?!${PATH_AFTER})`;
const REBINDING_WORDS = 'eval|source|set-variable|new-variable|clear-variable|remove-variable|unset|-(?:out)?variable';
const DOT_COMMAND = String.raw`(?:^|[;&|(){\n\`'"!]|(?<![\w-])(?:then|do|else|elif|builtin|command))\s*\.(?=\s+\S)`;
const SHELL_REBINDERS = new RegExp(`${WHOLE_WORD(REBINDING_WORDS)}|\\[ref\\]|${DOT_COMMAND}`, 'i');

const isPowershell = (shell) => shell === POWERSHELL;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The literal a bash assignment's right side holds: single quotes keep every character, double quotes keep all but an
// escape pair, a bare word loses its backslashes (so one is refused). null when the value is not a plain literal.
function bashValue(raw) {
  const value = dequoted(raw);
  if (raw.startsWith("'")) return value;
  return raw.startsWith('"') ? (BASH_ESCAPE_IN_DOUBLE_QUOTES.test(value) ? null : value) : (value.includes('\\') ? null : value);
}

function bashAssignments(text) {
  const tokens = shellTokens(text);
  if (tokens.length && BASH_DECLARE.test(tokens[0])) tokens.shift();
  const found = [];
  for (const token of tokens) {
    const m = BASH_ASSIGN.exec(token);
    const value = m ? bashValue(m[2]) : null;
    if (value === null) return null;
    found.push([m[1], value]);
  }
  return found.length ? found : null;
}

function powershellAssignments(text) {
  const m = PS_ASSIGN.exec(text);
  return m ? [[m[1], m[2].slice(1, -1)]] : null;
}

const assignmentsOf = (text, shell) => (isPowershell(shell) ? powershellAssignments(text) : bashAssignments(text));

// How often the command writes to `name`: an assignment, a loop or read target, a PowerShell compound assignment.
function writesTo(text, name, shell) {
  const n = escapeRegex(name);
  const pattern = isPowershell(shell)
    ? String.raw`\$${n}\s*[-+*/%]?=|foreach\s*\(\s*\$${n}\b`
    : String.raw`(?<![\w$])${n}\+?=|\b(?:for|read|select|mapfile|readarray|getopts)\b[^\n;&|]*\b${n}\b|\bprintf\s+-v\s+${n}\b`;
  return [...text.matchAll(new RegExp(pattern, isPowershell(shell) ? 'gi' : 'g'))].length;
}

/**
 * The variables each segment of `parts` (segments() output; `parts.text` is the whole command) can read. Keys of a
 * PowerShell map are lower-case (names are case-insensitive there).
 */
export function assignedValues(parts, shell) {
  const reads = new Map();
  const known = new Map();
  const whole = parts.text;
  const rebinds = SHELL_REBINDERS.test(whole);
  parts.forEach((seg, i) => {
    reads.set(seg, new Map(known));
    const next = parts[i + 1];
    const visible = UNCONDITIONAL_BEFORE.has(seg.after) && next && SEQUENTIAL_AFTER.has(next.after);
    const found = visible && !rebinds ? assignmentsOf(seg.text, shell) : null;
    for (const [name, value] of found || []) {
      if (IMPURE_VALUE.test(value) || writesTo(whole, name, shell) !== 1) continue;
      known.set(isPowershell(shell) ? name.toLowerCase() : name, value);
    }
  });
  return reads;
}

/** `text` with `$NAME` / `${NAME}` replaced by their assigned literal wherever the shell would expand them to exactly that. */
export function expandVariables(text, values, shell) {
  if (!values || !values.size) return text;
  const power = isPowershell(shell);
  let out = '';
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== "'" && ch === (power ? '`' : '\\') && i + 1 < text.length) { out += ch + text[++i]; continue; }
    if (ch === '"' || ch === "'") {
      if (!quote) quote = ch; else if (quote === ch) quote = '';
    } else if (ch === '$' && quote !== "'") {
      const braced = text[i + 1] === '{';
      const start = i + (braced ? 2 : 1);
      const name = (NAME.exec(text.slice(start)) || [''])[0];
      const end = start + name.length;
      const closed = braced ? text[end] === '}' : !(power && text[end] === ':');
      const value = name && closed ? values.get(power ? name.toLowerCase() : name) : undefined;
      if (value !== undefined && (quote === '"' || PLAIN_VALUE.test(value))) {
        out += value;
        i = braced ? end : end - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}
