// q-multiline.mjs — `q code --multiline` (KIT-T1369): a regex matched against a whole file, so a pattern can span lines
// (`.collect::<Vec<_>>();\n\s*for x in &v`). `.` matches a newline, `^` and `$` match at each line, and a match that spans
// more than MULTILINE_MAX_LINES lines is dropped, so a greedy `.*` cannot swallow a file. Hits carry line ranges.
//
//   multilineRegex(text, flags)              -> RegExp (flags gms, i with -i, \b...\b with -w) | null when it does not compile
//   multilineSpans(body, re)                 -> [{ start, end, text }] zero-based first and last line of each match
//   renderSpans(perFile, flags, { clip, splitLines }) -> rows: `path:12-14` on a match's first line, `path:13` on the rest,
//        `path-11` on -A/-B/-C context lines; -o prints each match on one row with its newlines shown as ⏎

export const MULTILINE_MAX_LINES = 50;
const NEWLINE_MARK = ' ⏎ ';

export function multilineRegex(text, flags) {
  try {
    const src = flags.word ? `\\b(?:${text})\\b` : text;
    return new RegExp(src, `gms${flags.ignoreCase ? 'i' : ''}`);
  } catch {
    return null;
  }
}

// Line starts, so a match offset maps to its line by binary search.
function lineStarts(body) {
  const starts = [0];
  for (let i = body.indexOf('\n'); i !== -1; i = body.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

function lineOf(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function multilineSpans(body, re) {
  const starts = lineStarts(body);
  const spans = [];
  re.lastIndex = 0;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m[0] === '') { re.lastIndex++; continue; }
    const start = lineOf(starts, m.index);
    const end = lineOf(starts, m.index + m[0].length - 1);
    if (end - start < MULTILINE_MAX_LINES) spans.push({ start, end, text: m[0] });
  }
  return spans;
}

export function renderSpans(perFile, flags, { clip, splitLines }) {
  const rows = [];
  let shown = 0;
  let total = 0;
  for (const f of perFile) {
    total += f.spans.length;
    const lines = splitLines(f.text);
    const emitted = new Set();
    for (const s of f.spans) {
      if (flags.limit && shown >= flags.limit) continue;
      shown++;
      const range = s.end > s.start ? `${s.start + 1}-${s.end + 1}` : `${s.start + 1}`;
      if (flags.only) { rows.push({ loc: `${f.path}:${range}`, text: clip(s.text.replace(/\r?\n\s*/g, NEWLINE_MARK)) }); continue; }
      for (let j = Math.max(0, s.start - flags.before); j <= Math.min(lines.length - 1, s.end + flags.after); j++) {
        if (emitted.has(j)) continue;
        emitted.add(j);
        const inMatch = j >= s.start && j <= s.end;
        const loc = j === s.start ? `${f.path}:${range}` : `${f.path}${inMatch ? ':' : '-'}${j + 1}`;
        rows.push({ loc, text: clip(lines[j].trimEnd()) });
      }
    }
  }
  if (flags.limit && total > shown) rows.push({ loc: '', text: `+${total - shown} more match(es) in ${perFile.length} file(s) — --limit 0 for all` });
  return rows;
}
