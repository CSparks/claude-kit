// Quote-aware split of a shell line into segments, each tagged with the operator BEFORE it
// ('start', '|', '||', '&&', ';', '&'). A newline is a ';'. Operators inside strings don't
// split; `>&` / `&>` are redirections, not separators. Shared by the query gate and the
// search telemetry so both judge the same commands.
//
// The split follows plain quote pairing only. Shells disagree about escapes (a backslash before a quote in
// bash, a backtick in PowerShell, `$'…'` strings), so a line with an escape character directly before a
// quote, a `$'` or `$"` string or a quote that never closes is ambiguous: the returned array carries
// `ambiguous: true` and its segments cannot be trusted. A deny gate that sees the flag skips per-segment
// parsing and tests the raw command for its own target words anywhere (KIT-T705, KIT-D117).

const AMBIGUOUS_QUOTING = /\$['"]|[\\`]["']/;

export const AMBIGUOUS_MESSAGE = 'Ambiguous shell quoting: rewrite the command without escaped quotes, or put the code in a scratchpad file.';

function split(cmd) {
  const out = [];
  let cur = '';
  let op = 'start';
  let q = '';
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (q) { cur += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
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
  return { out, open: q !== '' };
}

export function segments(cmd) {
  const { out, open } = split(cmd);
  out.ambiguous = open || AMBIGUOUS_QUOTING.test(cmd);
  return out;
}

// A shell path argument as a native path: quotes stripped, MSYS `/d/x` drive form turned into `d:/x`.
export const toPath = (p) => String(p).replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');

// The directory a `cd [/d] <dir>` segment moves to, or '' when the segment is not a cd.
export const cdTarget = (seg) => { const m = seg.match(/^cd\s+(?:\/d\s+)?(\S.*)$/s); return m ? toPath(m[1].trim()) : ''; };
