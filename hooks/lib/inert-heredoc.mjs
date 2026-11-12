// inert-heredoc.mjs — drops the bodies of quoted heredocs from a shell line (KIT-T784).
//
//   inertText(cmd) -> cmd with the body and terminator lines of each `<<'WORD'` / `<<"WORD"` removed
//
// A heredoc whose delimiter is quoted is literal data: no expansion, no command runs from it. Its text (a
// commit message with an apostrophe, a markdown draft) must not be parsed as shell. A body stays when its
// reader could run it as code or pass it on. A PowerShell single-quoted here-string (`@'` … `'@`) given to a data
// consumer (`git commit -m @'…'@`) is cut the same way and left as an empty string.
// A heredoc body stays when:
//   - the reading command is not a known data consumer (`bash <<'EOF'`, `node - <<'EOF'`, `ssh host <<'EOF'`)
//   - the line pipes the reader's output on (`cat <<'EOF' | bash`)
//   - the opener sits in a comment, behind a backslash, inside a quote, or has no terminator line
//   - the text left after the cut is still ambiguous: the opener may not be one in a real shell (KIT-D117)

import { isDataCommand } from './data-command.mjs';

const AMBIGUOUS =/\$['"]|[\\`]["']/;
const OPENER = /^<<(-?)[ \t]*(?:'([^'\n]+)'|"([^"\n]+)")(?=[\s;|&)<>]|$)/;

const HERE_OPEN = /^@'[ \t]*\r?\n/;
const HERE_CLOSE = /(?:^|\n)'@/;

const readsAsData = (lineSoFar) => isDataCommand(lineSoFar.split(/&&|\|\||[|;&]/).pop().trim().split(/\s+/).filter(Boolean));

function unclosedQuote(text) {
  let q = '';
  for (const ch of text) { if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; }
  return q !== '';
}

// A PowerShell single-quoted here-string `@'` + newline … newline + `'@` is literal text; returns the index after its
// closing `'@`, or -1 when `at` opens none or it never closes. A double-quoted one expands `$(...)` and stays.
function hereStringEnd(cmd, at) {
  const opener = HERE_OPEN.exec(cmd.slice(at));
  if (!opener) return -1;
  const bodyStart = at + opener[0].length;
  const closer = HERE_CLOSE.exec(cmd.slice(bodyStart));
  return closer ? bodyStart + closer.index + closer[0].length : -1;
}

function cut(cmd) {
  let out = '';
  let q = '';
  let lineStart = 0;
  const pending = [];
  let i = 0;
  while (i < cmd.length) {
    const ch = cmd[i];
    if (q) { out += ch; if (ch === q) q = ''; i++; continue; }
    if (ch === '\\') { out += cmd.slice(i, i + 2); i += 2; continue; }
    if (ch === '"' || ch === "'") { q = ch; out += ch; i++; continue; }
    if (ch === '#' && /[\s;|&(]/.test(cmd[i - 1] || ' ')) {
      const end = cmd.indexOf('\n', i);
      const stop = end < 0 ? cmd.length : end;
      out += cmd.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '@' && /\s/.test(cmd[i - 1] || ' ')) {
      const end = hereStringEnd(cmd, i);
      if (end > 0 && readsAsData(out.slice(lineStart))) { out += "''"; i = end; continue; }
    }
    if (ch === '<' && cmd[i + 1] === '<' && cmd[i - 1] !== '<' && cmd[i + 2] !== '<') {
      const m = OPENER.exec(cmd.slice(i));
      const lineEnd = cmd.indexOf('\n', i);
      const rest = cmd.slice(i + (m ? m[0].length : 0), lineEnd < 0 ? cmd.length : lineEnd);
      if (m && !rest.includes('|') && readsAsData(out.slice(lineStart))) {
        pending.push({ word: m[2] ?? m[3], dash: m[1] === '-' });
        out += m[0];
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i++;
    if (ch === '\n') {
      lineStart = out.length;
      if (!pending.length) continue;
      for (const { word, dash } of pending) {
        let found = false;
        while (i < cmd.length && !found) {
          const end = cmd.indexOf('\n', i);
          const line = cmd.slice(i, end < 0 ? cmd.length : end);
          i = end < 0 ? cmd.length : end + 1;
          found = (dash ? line.replace(/^\t+/, '') : line) === word;
        }
        if (!found) return null;
      }
      pending.length = 0;
      lineStart = out.length;
    }
  }
  return pending.length ? null : out;
}

export function inertText(cmd) {
  const text = String(cmd || '');
  if (!text.includes('<<') && !text.includes("@'")) return text;
  const cutText = cut(text);
  if (cutText === null || cutText === text || AMBIGUOUS.test(cutText) || unclosedQuote(cutText)) return text;
  return cutText;
}
