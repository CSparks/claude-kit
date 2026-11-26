// Split of a shell line into segments at the operators shell-lexer.mjs finds, each tagged with the operator BEFORE it
// ('start', '|', '||', '&&', ';', '&'). A newline is a ';'. Operators inside strings or escaped don't split; `>|`, `>&`,
// `<&`, `&>` and `&>>` are redirections, not separators; an operator inside a substitution or group splits too. Shared by
// the query gate and the search telemetry so both judge the same commands.
//
// A line whose quoting the lexer cannot resolve is ambiguous: the returned array carries `ambiguous: true` and
// `ambiguity: { reason, at, span }` (what, where, the text around it) and its segments cannot be trusted. A deny gate
// that sees the flag skips per-segment parsing and tests the raw command for its own target words anywhere (KIT-T705,
// KIT-D117), or judges the pieces from `blindSegments`, which split on every operator whatever the quoting.
//
// A caller passes the tool's `{ shell }` ('bash', 'powershell'; shellOfTool). Under bash a backslash escapes the next
// character outside single quotes (KIT-T941); under PowerShell a backtick does, and a backslash or backtick before a quote
// stays ambiguous. A `$'` or `$"` string, a backtick before a quote, an unclosed quote and, under PowerShell or an
// unknown shell, a typographic quote stay ambiguous. Without `shell` no escape is honoured and an escape before a quote
// anywhere is ambiguous.
//
// The bodies of quoted heredocs read by a data consumer are cut first (inert-heredoc.mjs, KIT-T784); the
// returned array carries the cut text as `.text` for gates that also test the raw command.

import { inertText } from './inert-heredoc.mjs';
import { msysToNative } from './msys-path.mjs';
import { lex } from './shell-lexer.mjs';

export { inertText };
export { readsTypographicQuote, TYPOGRAPHIC_QUOTE } from './shell-lexer.mjs';

export const AMBIGUOUS_MESSAGE = 'Ambiguous shell quoting: rewrite the command without escaped quotes, or put the code in a scratchpad file.';

// The text between the operator tokens, each piece tagged with the operator before it.
function pieces(text, tokens) {
  const out = [];
  let from = 0;
  let after = 'start';
  for (const token of tokens) {
    if (token.kind !== 'op') continue;
    out.push({ text: text.slice(from, token.start), after });
    from = token.end;
    after = token.op;
  }
  out.push({ text: text.slice(from), after });
  return out;
}

export function segments(cmd, { shell = '' } = {}) {
  const text = inertText(cmd);
  const { tokens, ambiguity } = lex(text, { shell });
  const out = pieces(text, tokens);
  out.ambiguous = ambiguity !== null;
  out.ambiguity = ambiguity;
  out.text = text;
  return out;
}

/** The escape-rule name `segments` takes for a hook payload's tool: PowerShell has its own, every other shell tool is bash. */
export const shellOfTool = (toolName) => (/powershell/i.test(String(toolName || '')) ? 'powershell' : 'bash');

/** Operator split that ignores quoting: the pieces a command leads with when quote pairing cannot be trusted. */
export const blindSegments = (cmd) => pieces(String(cmd), lex(cmd, { blind: true }).tokens);

const ARG = /(?:"[^"]*"|'[^']*'|[^\s"'])+/g;
export const WHOLLY_QUOTED = /^(?:"[^"]*"|'[^']*')$/;
const QUOTES = /["']/g;

/** Whitespace-split tokens with every quoted span kept whole and its quotes in place. */
export const shellTokens = (text) => [...String(text).matchAll(ARG)].map((m) => m[0]);

/** One token without its quotes: only the outer pair when the token is one quoted span, so an inner quote survives. */
export const dequoted = (token) => (WHOLLY_QUOTED.test(token) ? token.slice(1, -1) : token.replace(QUOTES, ''));

const QUOTED_SPAN = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g;

/** A token with each quoted span replaced by its content: `'it'"'"'s'` and `'it''s'` read back as the words they spell. */
export const unquoteSpans = (token) => String(token).replace(QUOTED_SPAN, (_, double, single) => double ?? single);

/** Whitespace-split arguments with a quoted span kept whole and its quotes dropped. */
export const shellArgs = (text) => shellTokens(text).map((t) => t.replace(QUOTES, '')).filter(Boolean);

// A shell path argument as a native path: quotes stripped, MSYS `/d/x` and `/tmp/x` turned into their Windows paths.
export const toPath = (p) => msysToNative(String(p).replace(/^["']|["']$/g, ''));

// The directory a `cd [/d] <dir>` segment moves to, or '' when the segment is not a cd.
export const cdTarget = (seg) => { const m = seg.match(/^cd\s+(?:\/d\s+)?(\S.*)$/s); return m ? toPath(m[1].trim()) : ''; };

// How a segment moves the directory of the shell that runs it, for the push gates (KIT-T1601):
//   locationMove(seg, shell) -> { to, push } | { pop: true } | null
// Only the verbs that shell runs count: PowerShell `cd`, `chdir`, `pushd`, `Set-Location`, `sl`, `Push-Location` (with `-Path`
// or `-LiteralPath`, any case) and `popd`, `Pop-Location`; bash `cd`, `pushd`, `popd`; an unknown shell `cd` alone, as
// cdTarget. A verb the shell lacks fails there, and the next segment runs where the last one was. cdTarget's other callers keep
// reading only `cd` until the one-lexer job (KIT-T1585).
const LOCATION_VERBS = {
  powershell: { move: /^(cd|chdir|pushd|set-location|sl|push-location)\s+(?:-(?:path|literalpath)\s+)?(\S.*)$/is, pop: /^(?:popd|pop-location)$/i, push: /^(?:pushd|push-location)$/i },
  bash: { move: /^(cd|pushd)\s+(?:\/d\s+)?(\S.*)$/s, pop: /^popd$/, push: /^pushd$/ },
  unknown: { move: /^(cd)\s+(?:\/d\s+)?(\S.*)$/s, pop: null, push: null },
};
export function locationMove(seg, shell = '') {
  const verbs = LOCATION_VERBS[shell] || LOCATION_VERBS.unknown;
  if (verbs.pop && verbs.pop.test(seg)) return { pop: true };
  const m = seg.match(verbs.move);
  return m ? { to: toPath(m[2].trim()), push: Boolean(verbs.push && verbs.push.test(m[1])) } : null;
}
