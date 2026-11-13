// args.mjs — the command line of move-lines, read by the script and by the shell gates alike.
//
//   parseMoveLinesArgs(argv, cwd) -> { source, specs: [{ ranges, dest }], append, dryRun }
//     source and every dest are absolute paths resolved against `cwd` (an MSYS /d/x form read as d:/x); throws on a malformed line

import { resolve } from 'node:path';
import { toPath } from '../../hooks/lib/shell-segments.mjs';
import { parseRanges } from './plan.mjs';

export const USAGE = 'usage: move-lines [--append] [--dry-run] <source> <ranges>=<dest> [<ranges>=<dest> ...]';

export function parseMoveLinesArgs(argv, cwd = process.cwd()) {
  const flags = new Set(argv.filter((a) => a === '--append' || a === '--dry-run'));
  const rest = argv.filter((a) => !flags.has(a));
  const [source, ...specTexts] = rest;
  if (!source || !specTexts.length) throw new Error(USAGE);
  const specs = specTexts.map((t) => {
    const at = t.indexOf('=');
    if (at < 1 || at === t.length - 1) throw new Error(`bad spec '${t}': use <ranges>=<dest>, e.g. 10-120=src/part.cpp`);
    return { ranges: parseRanges(t.slice(0, at)), dest: resolve(cwd, toPath(t.slice(at + 1))) };
  });
  return { source: resolve(cwd, toPath(source)), specs, append: flags.has('--append'), dryRun: flags.has('--dry-run') };
}
