// Quote-aware split of a shell line into segments, each tagged with the operator BEFORE it
// ('start', '|', '||', '&&', ';', '&'). A newline is a ';'. Operators inside strings don't
// split; `>&` / `&>` are redirections, not separators. Shared by the query gate and the
// search telemetry so both judge the same commands.
//
// A backslash (bash) or backtick (PowerShell) before a quote escapes it, and the shells disagree, so the
// line is split three ways: no escapes, backslash escapes, backtick escapes. When the splits differ, or a
// quote never closes, the quoting is ambiguous: the result is every distinct segment of every split, then
// the whole command as a last segment flagged `ambiguous` (a gate judges it with no leader exemption).
// The whole command comes last so a `cd` in it cannot disturb the directory a consumer tracks.

const ESCAPED_QUOTE = /[\\`]["']/;
const ESCAPES = ['\\', '`'];

function split(cmd, esc) {
  const out = [];
  let cur = '';
  let op = 'start';
  let q = '';
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (esc && ch === esc && q !== "'" && (cmd[i + 1] === '"' || cmd[i + 1] === "'" || cmd[i + 1] === esc)) {
      cur += ch + cmd[i + 1];
      i++;
      continue;
    }
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

const fingerprint = (s) => `${s.after}\u0000${s.text}`;
const fingerprints = (out) => out.map(fingerprint).join('\u0001');

export function segments(cmd) {
  const base = split(cmd, '');
  const variants = ESCAPED_QUOTE.test(cmd) ? ESCAPES.map((esc) => split(cmd, esc)) : [];
  const ambiguous = base.open || variants.some((v) => v.open || fingerprints(v.out) !== fingerprints(base.out));
  if (!ambiguous) return base.out;
  const seen = new Set(base.out.map(fingerprint));
  const extra = variants.flatMap((v) => v.out).filter((s) => !seen.has(fingerprint(s)) && seen.add(fingerprint(s)));
  return [...base.out, ...extra, { text: cmd, after: 'start', ambiguous: true }];
}

// A shell path argument as a native path: quotes stripped, MSYS `/d/x` drive form turned into `d:/x`.
export const toPath = (p) => String(p).replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');

// The directory a `cd [/d] <dir>` segment moves to, or '' when the segment is not a cd.
export const cdTarget = (seg) => { const m = seg.match(/^cd\s+(?:\/d\s+)?(\S.*)$/s); return m ? toPath(m[1].trim()) : ''; };