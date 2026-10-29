// heredoc.mjs — where a shell heredoc body lives inside a command string.
//
//   heredocAfter(command, from) -> null | { delimiter, body, at, start, end }
//     Finds the first `<<[-]DELIM` operator at or after `from`. The body starts on the line after the
//     command line that ends (quote-aware) past the operator and runs to the delimiter line; `at` is the operator offset, `start`/`end`
//     are its character offsets. A missing terminator makes the body run to the end of the command.

const OPERATOR = /<<(-?)\s*(?:'([^']*)'|"([^"]*)"|([A-Za-z_][\w]*))/g;

function unquotedNewline(command, from) {
  let quote = '';
  for (let i = from; i < command.length; i++) {
    const ch = command[i];
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '\n') return i;
  }
  return -1;
}

export function heredocAfter(command, from = 0) {
  OPERATOR.lastIndex = from;
  for (let m = OPERATOR.exec(command); m; m = OPERATOR.exec(command)) {
    if (command[m.index - 1] === '<') continue;
    const delimiter = m[2] ?? m[3] ?? m[4];
    const eol = unquotedNewline(command, m.index + m[0].length);
    if (eol < 0) return { delimiter, body: "", at: m.index, start: command.length, end: command.length };
    const lines = command.slice(eol + 1).split('\n');
    const strip = (l) => (m[1] ? l.replace(/^\t+/, '') : l).replace(/\r$/, '');
    const stop = lines.findIndex((l) => strip(l) === delimiter);
    const bodyLines = stop < 0 ? lines : lines.slice(0, stop);
    const body = bodyLines.join('\n');
    return { delimiter, body, at: m.index, start: eol + 1, end: eol + 1 + body.length };
  }
  return null;
}
