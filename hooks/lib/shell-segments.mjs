// Quote-aware split of a shell line into segments, each tagged with the operator BEFORE it
// ('start', '|', '||', '&&', ';', '&'). A newline is a ';'. Operators inside strings don't
// split; `>&` / `&>` are redirections, not separators. Shared by the query gate and the
// search telemetry so both judge the same commands.

export function segments(cmd) {
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
  return out;
}
