// A Windows 8.3 short path (C:/Users/CHRISS~1/...) names the same file as its long form.
//
//   expandShortNames(path) -> string   the forward-slash path with short names expanded through its nearest existing
//                                      ancestor; the input unchanged when it holds none or cannot be resolved

import { existsSync, realpathSync } from 'node:fs';

const SHORT_NAME = /~\d/;
const slashed = (p) => String(p).replace(/\\/g, '/');

export function expandShortNames(p) {
  if (!SHORT_NAME.test(p)) return p;
  let head = p;
  const tail = [];
  while (head && !existsSync(head)) {
    const cut = head.lastIndexOf('/');
    if (cut <= 0) return p;
    tail.unshift(head.slice(cut + 1));
    head = head.slice(0, cut);
  }
  try { return [slashed(realpathSync.native(head)), ...tail].join('/'); } catch { return p; }
}
