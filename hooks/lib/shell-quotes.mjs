// shell-quotes.mjs — blank the quoted strings of a shell line that are provably DATA, so a write shape that only
// appears inside an `echo '{…"cat > hooks/x.mjs"…}' | node hook.mjs` probe is not read as a hand write
// (KIT-T701). Fails closed: any doubt returns the text unchanged, and the gates scan it raw.
//
//   maskInertStrings(text) -> text with the content of inert quoted strings blanked to an empty pair
//
// A quoted string is blanked only when ALL hold:
//   - it is an argument of an `echo` / `printf` segment (never bash -c, eval, powershell -Command, su -c, wsl,
//     ssh, xargs, node -e …: those run their string, so the raw scan sees it);
//   - the segment's output goes nowhere that runs it: no pipe, or a pipe into a data tool or an interpreter
//     given a script file (`| node hook.mjs`), never into a shell or `node -`;
//   - it is single-quoted, or double-quoted with no `$(`, backtick or backslash; it spans no newline;
//   - it is not a redirect target (`> 'out.mjs'`).
// Ambiguity returns the text raw: unbalanced quotes, a backslash or backtick outside quotes, `$'…'`, a `#`
// comment, or a heredoc operator.

const INERT = new Set(['echo', 'printf']);
const DATA_TOOLS = new Set(['cat', 'grep', 'egrep', 'fgrep', 'rg', 'head', 'tail', 'wc', 'sort', 'uniq', 'jq', 'tr', 'cut', 'diff', 'cmp']);
const INTERPRETERS = new Set(['node', 'python', 'python3', 'py', 'ruby', 'perl']);
const CODE_ARG = /^(?:-e|-p|-c|--eval|--print|-)$/;
const SCRIPT_ARG = /\.(?:m?js|cjs|py|rb|pl)$/i;
const UNSAFE_IN_DOUBLE = /\$\(|`|\\|\n/;
const COMMENT_BOUNDARY = /[\s;&|(]/;
const LEADER = /^\s*(?:[A-Za-z_]\w*=\S*\s+)*([^\s'"`$()<>|&;]+)/;
const REDIRECT_BEFORE = /[<>]\s*$/;
const stem = (path) => path.replace(/.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();

function operatorAt(text, i) {
  const ch = text[i];
  if (ch === '\n' || ch === ';') return ch;
  if (ch === '|') return text[i + 1] === '|' ? '||' : '|';
  if (ch === '&') {
    if (text[i + 1] === '&') return '&&';
    return text[i - 1] === '>' || text[i + 1] === '>' ? '' : '&';
  }
  return '';
}

/** The simple commands of `text` with their quoted spans, or null when the quoting is ambiguous. */
function scan(text) {
  const segs = [];
  let seg = { from: 0, op: 'start', spans: [] };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' || ch === '`') return null;
    if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      if (end < 0 || text[i - 1] === '$') return null;
      seg.spans.push({ start: i, end, plain: !text.slice(i, end).includes('\n') });
      i = end;
    } else if (ch === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      if (end >= text.length) return null;
      seg.spans.push({ start: i, end, plain: !UNSAFE_IN_DOUBLE.test(text.slice(i, end)) });
      i = end;
    } else if (ch === '#' && (i === 0 || COMMENT_BOUNDARY.test(text[i - 1]))) {
      return null;
    } else if (ch === '<' && text[i + 1] === '<' && text[i - 1] !== '<' && text[i + 2] !== '<') {
      return null;
    } else {
      const op = operatorAt(text, i);
      if (!op) continue;
      segs.push({ ...seg, to: i });
      seg = { from: i + op.length, op, spans: [] };
      i += op.length - 1;
    }
  }
  segs.push({ ...seg, to: text.length });
  return segs;
}

function feedsData(next, text) {
  if (!next) return true;
  const words = text.slice(next.from, next.to).trim().split(/\s+/);
  const leader = stem(words[0] || '');
  if (DATA_TOOLS.has(leader)) return true;
  const args = words.slice(1);
  return INTERPRETERS.has(leader) && !args.some((a) => CODE_ARG.test(a)) && args.some((a) => SCRIPT_ARG.test(a.replace(/^["']|["']$/g, '')));
}

export function maskInertStrings(text) {
  const source = String(text);
  const segs = scan(source);
  if (!segs) return source;
  const blank = [];
  segs.forEach((seg, i) => {
    const leader = LEADER.exec(source.slice(seg.from, seg.to));
    if (!leader || !INERT.has(stem(leader[1]))) return;
    const next = segs[i + 1];
    if (next && next.op === '|' && !feedsData(next, source)) return;
    for (const span of seg.spans) if (span.plain && !REDIRECT_BEFORE.test(source.slice(0, span.start))) blank.push(span);
  });
  let out = source;
  for (const { start, end } of blank.sort((a, b) => b.start - a.start)) out = `${out.slice(0, start + 1)}${out.slice(end)}`;
  return out;
}
