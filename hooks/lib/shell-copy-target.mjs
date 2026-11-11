// The paths a cp, mv, Copy-Item or Move-Item call WRITES: the destination, never the sources it reads.
//   copyDestinations(args) -> string[]
//     args: the call's operands as shellArgs reads them (a quoted span kept whole, quotes dropped)
// `-t DIR` / `--target-directory=DIR` name a destination directory and `-Destination X` names the destination;
// otherwise it is the last operand. A destination directory (a -t value, or an operand ending in a slash)
// receives each source under its own file name, so that is the path judged.

const DIR_FLAG = /^(?:-t|--target-directory)$/i;
const DIR_JOINED = /^--target-directory=(.+)$/i;
const DEST_FLAG = /^-destination$/i;
const REDIRECT = /\d*>>?(?:&\d+|\s*(?:"[^"]*"|'[^']*'|\S+))/g;
const ENDS_IN_SLASH = /[\\/]$/;

const baseName = (p) => String(p).replace(ENDS_IN_SLASH, '').replace(/.*[\\/]/, '');
const into = (dir, sources) => (sources.length
  ? sources.map((s) => `${dir.replace(ENDS_IN_SLASH, '')}/${baseName(s)}`)
  : [dir]);

/** The argument text of a call with every redirect (`> file`, `2>&1`, `>> "a b"`) cut out, so no redirect target reads as an operand. */
export const withoutRedirects = (text) => String(text).replace(REDIRECT, ' ');

export function copyDestinations(args) {
  const operands = args.filter(Boolean);
  const dirAt = operands.findIndex((a) => DIR_FLAG.test(a));
  const destAt = operands.findIndex((a) => DEST_FLAG.test(a));
  const joined = operands.map((a) => a.match(DIR_JOINED)).find(Boolean);
  const dir = joined ? joined[1] : dirAt >= 0 ? operands[dirAt + 1] || '' : '';
  const named = destAt >= 0 ? operands[destAt + 1] || '' : '';
  const flagValues = new Set([dirAt, destAt].filter((i) => i >= 0).map((i) => i + 1));
  const plain = operands.filter((a, i) => !a.startsWith('-') && !flagValues.has(i));
  if (dir) return into(dir, plain);
  const dest = named || plain.at(-1) || '';
  if (!dest) return [];
  const sources = named ? plain : plain.slice(0, -1);
  return ENDS_IN_SLASH.test(dest) ? into(dest, sources) : [dest];
}
