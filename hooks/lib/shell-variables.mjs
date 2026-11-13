// shell-variables.mjs — the plain literal a variable holds when the command itself assigns it (KIT-T1075).
// A cp whose destination is `"$SCRATCH/a.cpp.bak"` is judged by where it lands; the gate cannot see the shell's
// environment, so it resolves a variable only from an assignment it can prove: one literal `NAME=value` (bash) or
// `$name = 'value'` (PowerShell) segment that runs unconditionally before the use, the only write to that name in the
// whole command, in a command whose every segment is known to leave variables alone (KIT-T1082). Anything the allowlist
// does not recognise leaves every variable unresolved and the copy stays fail-closed.
//
//   assignedValues(parts, shell) -> Map<segment, Map<name, value>>   the variables each segment of `parts` can read
//   precedingValues(parts, shell) -> Map<segment, Map<name, value>>  the same, judged leniently for naming a file (not a write)
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
const PLAIN_VALUE = /^(?!~)[\w@%+=:,./~-]+$/;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;
const UNCONDITIONAL_BEFORE = new Set(['start', ';']);
const SEQUENTIAL_AFTER = new Set([';', '&&']);

// Commands that read, write or delete files, or run as a child process, and never bind a shell variable (a child cannot
// reach its parent's variables; what a delete or a child's script writes is judged by the write scan, not here). The word
// is judged after its quotes are removed; bash matches it case-sensitively, PowerShell case-insensitively. A
// path-qualified or variable-named command is not here.
const SAFE_COMMANDS = new Set(['cp', 'copy', 'copy-item', 'mv', 'move-item', 'rm', 'rmdir', 'remove-item', 'install', 'touch', 'mkdir', 'md', 'echo', 'cd', 'set-location', 'ls', 'dir', 'get-childitem', 'pwd', 'true', 'bash', 'sh', 'node', 'cargo', 'rg', 'grep', 'head', 'tail', 'cat', 'wc']);
const WHOLE_SUBSHELL = /^\s*\(([^()]*)\)\s*$/;
// Text that evaluates code or assigns while it expands: command, process and arithmetic substitution and
// `${NAME:=x}` in bash; in PowerShell a parenthesis, brace, backtick escape or splat.
const BASH_EVALUATING = /\$\(|`|[<>]\(|\$\[|\$\{[^}]*=/;
const POWERSHELL_EVALUATING = /[({`]|\s@/;
const DASH = '-–—―';
const POWERSHELL_PARAMETER = new RegExp(`^[${DASH}]([a-z]+)`, 'i');
const POWERSHELL_PARAMETER_BINDING = new RegExp(`^[${DASH}][a-z]+:`, 'i');
const DRIVE_LETTER = /^[A-Za-z]:/;
const SCOPE_QUALIFIER = /\$\w+:/g;
const POWERSHELL_VARIABLE_PARAMETERS = ['errorvariable', 'warningvariable', 'informationvariable', 'outvariable', 'pipelinevariable'];
const POWERSHELL_VARIABLE_ALIASES = new Set(['ev', 'wv', 'iv', 'ov', 'pv']);
// Names that change how a later word expands or which program a command word runs.
const COMMAND_CONTROL_NAMES = new Set(['IFS', 'PATH']);
// Variables the shell rewrites itself (`cd` moves PWD) are never resolved from an assignment.
const SHELL_OWNED_NAMES = /^(?:pwd|oldpwd|random|srandom|seconds|lineno|bashpid|reply|optind|optarg|shlvl|_)$|^(?:epoch|bash_|comp_)/i;

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

// A PowerShell common parameter that stores a stream in a variable: the alias, the full name or any prefix of it.
function bindsVariable(token) {
  const m = POWERSHELL_PARAMETER.exec(dequoted(token));
  const name = m ? m[1].toLowerCase() : '';
  return POWERSHELL_VARIABLE_ALIASES.has(name) || (name.length > 1 && POWERSHELL_VARIABLE_PARAMETERS.some((p) => p.startsWith(name)));
}

// A PowerShell token that names a provider path (`variable:sp`, `Var*:`, `Variable::sp`): a colon that is no parameter
// binding, one-letter drive or `$scope:` qualifier. The colon cannot be quoted away, so the drive name never matters.
function namesProviderPath(token) {
  const rest = dequoted(token).replace(POWERSHELL_PARAMETER_BINDING, '').replace(DRIVE_LETTER, '').replace(SCOPE_QUALIFIER, '');
  return rest.includes(':');
}

const controlsCommands = (assignments) => assignments.some(([name]) => COMMAND_CONTROL_NAMES.has(name));

// True when the segment is blank, a literal assignment, or a safe command whose text evaluates nothing.
function leavesVariablesAlone(text, shell) {
  if (!text.trim()) return true;
  const power = isPowershell(shell);
  if ((power ? POWERSHELL_EVALUATING : BASH_EVALUATING).test(text)) return false;
  const assigned = assignmentsOf(text, shell);
  if (assigned) return !controlsCommands(assigned);
  const tokens = shellTokens(power ? text : (WHOLE_SUBSHELL.exec(text) || [, text])[1]);
  const at = power ? 0 : tokens.findIndex((t) => !BASH_ASSIGN.test(t));
  if (at < 0) return false;
  const command = dequoted(tokens[at]);
  if (!SAFE_COMMANDS.has(power ? command.toLowerCase() : command)) return false;
  if (power) return !tokens.some((t) => bindsVariable(t) || namesProviderPath(t));
  return !controlsCommands(tokens.slice(0, at).map((t) => BASH_ASSIGN.exec(t).slice(1)));
}

// How often the command writes to `name`: a bash assignment or declaration, a PowerShell assignment.
function writesTo(text, name, shell) {
  const n = escapeRegex(name);
  const power = isPowershell(shell);
  const pattern = power ? String.raw`\$${n}\s*[-+*/%]?=` : String.raw`(?<![\w$])${n}\+?=`;
  return [...text.matchAll(new RegExp(pattern, power ? 'gi' : 'g'))].length;
}

// Records each provable assignment of `found` into `known`: a plain literal, not a name the shell rewrites, the only
// write to that name in the whole command.
function remember(known, found, whole, shell) {
  for (const [name, value] of found || []) {
    if (IMPURE_VALUE.test(value) || SHELL_OWNED_NAMES.test(name) || writesTo(whole, name, shell) !== 1) continue;
    known.set(isPowershell(shell) ? name.toLowerCase() : name, value);
  }
}

/**
 * The variables each segment of `parts` (segments() output; `parts.text` is the whole command) can read. Keys of a
 * PowerShell map are lower-case (names are case-insensitive there).
 */
export function assignedValues(parts, shell) {
  const reads = new Map();
  const known = new Map();
  const trusted = !parts.ambiguous && parts.every((seg) => leavesVariablesAlone(seg.text, shell));
  parts.forEach((seg, i) => {
    reads.set(seg, new Map(known));
    const next = parts[i + 1];
    const visible = UNCONDITIONAL_BEFORE.has(seg.after) && next && SEQUENTIAL_AFTER.has(next.after);
    remember(known, visible && trusted ? assignmentsOf(seg.text, shell) : null, parts.text, shell);
  });
  return reads;
}

/**
 * Like assignedValues, for judging what a command NAMES (a commit message file), never what it may write: every
 * provable bare assignment in an earlier segment counts, whatever connector or command surrounds it. A skipped
 * assignment can only leave the named file unreadable, so the judge errs toward "unread", never toward a write.
 */
export function precedingValues(parts, shell) {
  const reads = new Map();
  const known = new Map();
  for (const seg of parts) {
    reads.set(seg, new Map(known));
    remember(known, assignmentsOf(seg.text, shell), parts.text, shell);
  }
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
