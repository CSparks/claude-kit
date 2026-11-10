// path-overlap.mjs — do two path lists touch the same file or directory.
//
//   overlaps(a, b)  -> true when any path of `a` equals, contains or lies inside any path of `b` ('*' touches everything)
//   sameFiles(a, b) -> overlaps with '*' (unknown paths) set aside: unknown paths are not shown to touch anything

const norm = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '');
const touches = (a, b) => a === '*' || b === '*' || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const known = (paths) => (paths || []).filter((p) => p !== '*');

export function overlaps(a, b) {
  const left = (a || []).map(norm);
  const right = (b || []).map(norm);
  return left.some((x) => right.some((y) => touches(x, y)));
}

export const sameFiles = (a, b) => overlaps(known(a), known(b));
