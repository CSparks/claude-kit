// plan.mjs — the pure half of move-lines: split a file's text into lines, carve line ranges out of it for named
// destinations, and prove the carve verbatim.
//
//   splitLines(text)               -> { lines, eol, trailing }  the lines without their EOL; eol is '\r\n' when the first break is one; trailing = ends with a break
//   joinLines(lines, eol, trailing) -> text
//   parseRanges('1-10,20,30-35')   -> [[1,10],[20,20],[30,35]]  (1-based, inclusive); throws on a malformed list
//   planMoves(lines, specs)        -> { kept, moved: Map<dest, string[]> }  specs = [{ ranges, dest }]; ranges stay in the order given and
//                                    may not overlap or leave the file; throws on a violation
//   sortedDiff(before, after)      -> string[]  every line whose count differs between the two line lists, `+line` or `-line`; [] proves a verbatim move

const RANGE = /^(\d+)(?:-(\d+))?$/;

export function splitLines(text) {
  const firstBreak = text.indexOf('\n');
  const eol = firstBreak > 0 && text[firstBreak - 1] === '\r' ? '\r\n' : '\n';
  const trailing = text.endsWith('\n');
  const lines = text === '' ? [] : text.split(/\r?\n/);
  if (trailing) lines.pop();
  return { lines, eol, trailing };
}

export const joinLines = (lines, eol, trailing) => (lines.length ? lines.join(eol) + (trailing ? eol : '') : '');

export function parseRanges(text) {
  return String(text).split(',').map((part) => {
    const m = RANGE.exec(part.trim());
    if (!m) throw new Error(`bad line range '${part}': use N or N-M, comma separated`);
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < from) throw new Error(`bad line range '${part}': lines count from 1 and the end is not before the start`);
    return [from, to];
  });
}

export function planMoves(lines, specs) {
  const taken = new Array(lines.length).fill(false);
  const moved = new Map();
  for (const { ranges, dest } of specs) {
    const into = moved.get(dest) || [];
    for (const [from, to] of ranges) {
      if (to > lines.length) throw new Error(`range ${from}-${to} leaves the file (${lines.length} lines)`);
      for (let n = from; n <= to; n++) {
        if (taken[n - 1]) throw new Error(`line ${n} is in two ranges`);
        taken[n - 1] = true;
        into.push(lines[n - 1]);
      }
    }
    moved.set(dest, into);
  }
  return { kept: lines.filter((_, i) => !taken[i]), moved };
}

export function sortedDiff(before, after) {
  const a = [...before].sort();
  const b = [...after].sort();
  const diff = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] < b[j])) diff.push(`-${a[i++]}`);
    else if (i >= a.length || b[j] < a[i]) diff.push(`+${b[j++]}`);
    else { i++; j++; }
  }
  return diff;
}
