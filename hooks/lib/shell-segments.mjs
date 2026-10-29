// Quote-aware split of a shell line into segments, each tagged with the operator BEFORE it
// ('start', '|', '||', '&&', ';', '&'). A newline is a ';'. Operators inside strings don't
// split; `>&` / `&>` are redirections, not separators. Shared by the query gate and the
// search telemetry so both judge the same commands.
//
// The split follows plain quote pairing only. Shells disagree about escapes (a backslash before a quote in
// bash, a backtick in PowerShell, `$'…'` strings), so a line with an escape character directly before a
// quote, a `$'` or `$"` string or a quote that never closes is ambiguous: the segments are followed by one
// segment per word of the command (the text from that word to the end), each flagged `ambiguous`. A consumer
// that reads a segment's first word as its leader thus sees every word that could start a command, and one
// that scans the text position-free sees the whole command first. The flagged segments come last so a `cd` in
// them cannot disturb the directory a consumer tracks before them.

const AMBIGUOUS_QUOTING = /\$['"]|[\\`]["']/;
const CANDIDATE_WORD = /[^\s'"`;|&()<>]+/g;
const MAX_CANDIDATE_STARTS = 2000;

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

/**
 * Every position in `cmd` where a command could start when the quoting is ambiguous: the start of each
 * word. Capped so a huge heredoc stays cheap; the whole command is always a candidate.
 */
export function candidateStarts(cmd) {
  const starts = [0];
  for (const m of cmd.matchAll(CANDIDATE_WORD)) {
    if (starts.length >= MAX_CANDIDATE_STARTS) break;
    if (m.index > 0) starts.push(m.index);
  }
  return starts;
}

export function segments(cmd) {
  const { out, open } = split(cmd);
  if (!open && !AMBIGUOUS_QUOTING.test(cmd)) return out;
  return [...out, ...candidateStarts(cmd).map((at) => ({ text: cmd.slice(at), after: 'start', ambiguous: true }))];
}

// A shell path argument as a native path: quotes stripped, MSYS `/d/x` drive form turned into `d:/x`.
export const toPath = (p) => String(p).replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');

// The directory a `cd [/d] <dir>` segment moves to, or '' when the segment is not a cd.
export const cdTarget = (seg) => { const m = seg.match(/^cd\s+(?:\/d\s+)?(\S.*)$/s); return m ? toPath(m[1].trim()) : ''; };
