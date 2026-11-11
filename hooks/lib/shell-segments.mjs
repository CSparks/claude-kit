// Quote-aware split of a shell line into segments, each tagged with the operator BEFORE it
// ('start', '|', '||', '&&', ';', '&'). A newline is a ';'. Operators inside strings don't
// split; `>&` / `&>` are redirections, not separators. Shared by the query gate and the
// search telemetry so both judge the same commands.
//
// The split follows plain quote pairing only. Shells disagree about escapes (a backslash before a quote in
// bash, a backtick in PowerShell, `$'…'` strings), so a line with an escape character directly before a
// quote, a `$'` or `$"` string or a quote that never closes is ambiguous: the returned array carries
// `ambiguous: true` and its segments cannot be trusted. A deny gate that sees the flag skips per-segment
// parsing and tests the raw command for its own target words anywhere (KIT-T705, KIT-D117), or judges the
// pieces from `blindSegments`, which split on every operator whatever the quoting.
//
// A caller that knows the shell passes `{ shell }` and gets that shell's escape rules instead: under 'bash' a backslash
// escapes the next character outside single quotes, so `\"` inside a double-quoted argument is no ambiguity (KIT-T941);
// under 'powershell' a backslash or backtick before a quote outside single quotes still is. Single-quoted spans are
// literal in both. A `$'` or `$"` string, a backtick before a quote and an unclosed quote stay ambiguous. Without
// `shell` the legacy test applies: an escape before a quote anywhere.
//
// The bodies of quoted heredocs read by a data consumer are cut first (inert-heredoc.mjs, KIT-T784); the
// returned array carries the cut text as `.text` for gates that also test the raw command.

import { inertText } from './inert-heredoc.mjs';

export { inertText };

const AMBIGUOUS_QUOTING = /\$['"]|[\\`]["']/;

export const AMBIGUOUS_MESSAGE = 'Ambiguous shell quoting: rewrite the command without escaped quotes, or put the code in a scratchpad file.';

const QUOTE = /["']/;
const DOLLAR_QUOTE = /\$['"]/;

function split(cmd, blind = false, shell = '') {
  const out = [];
  let cur = '';
  let op = 'start';
  let q = '';
  let escaped = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (shell === 'bash' && !blind && ch === '\\' && q !== "'" && i + 1 < cmd.length) { cur += ch + cmd[++i]; continue; }
    const escapeChar = ch === '`' || (shell === 'powershell' && ch === '\\');
    if (shell && escapeChar && q !== "'" && QUOTE.test(cmd[i + 1] || '')) escaped = true;
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (!blind && (ch === '"' || ch === "'")) { q = ch; cur += ch; continue; }
    if (ch === '&' && (cmd[i - 1] === '>' || cmd[i + 1] === '>')) { cur += ch; continue; }
    if (ch === '|' || ch === '&' || ch === ';' || ch === '\n') {
      const pair = ch + (cmd[i + 1] || '');
      const sep = pair === '||' || pair === '&&' ? pair : ch === '\n' ? ';' : ch;
      if (sep.length === 2) i++;
      out.push({ text: cur, after: op });
      cur = '';
      op = sep;
      continue;
    }
    cur += ch;
  }
  out.push({ text: cur, after: op });
  return { out, open: q !== '', escaped };
}

export function segments(cmd, { shell = '' } = {}) {
  const text = inertText(cmd);
  const { out, open, escaped } = split(text, false, shell);
  out.ambiguous = open || (shell ? escaped || DOLLAR_QUOTE.test(text) : AMBIGUOUS_QUOTING.test(text));
  out.text = text;
  return out;
}

/** The escape-rule name `segments` takes for a hook payload's tool: PowerShell has its own, every other shell tool is bash. */
export const shellOfTool = (toolName) => (/powershell/i.test(String(toolName || '')) ? 'powershell' : 'bash');

/** Operator split that ignores quoting: the pieces a command leads with when quote pairing cannot be trusted. */
export const blindSegments = (cmd) => split(cmd, true).out;

// A shell path argument as a native path: quotes stripped, MSYS `/d/x` drive form turned into `d:/x`.
export const toPath = (p) => String(p).replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');

// The directory a `cd [/d] <dir>` segment moves to, or '' when the segment is not a cd.
export const cdTarget = (seg) => { const m = seg.match(/^cd\s+(?:\/d\s+)?(\S.*)$/s); return m ? toPath(m[1].trim()) : ''; };
