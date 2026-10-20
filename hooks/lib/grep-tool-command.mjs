// The Grep tool is `rg` with a JSON input. query-gate judges it with the same rules as a shell
// `rg`, so the tool is no way around the retrieval gate: this renders a Grep tool input as the
// equivalent `rg` command line. The pattern is always quoted (it may hold `|`); a path is quoted
// only when it needs it, so a plain file path still reads as a concrete file.
//
//   grepToolCommand(input) -> 'rg [-t T] [--glob G] [-i] <pattern> [<path>]'

const SAFE = /^[\w@%+=:,./\\-]+$/;
const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const bare = (s) => (SAFE.test(String(s)) ? String(s) : quote(s));

export function grepToolCommand(input) {
  const i = input || {};
  const parts = ['rg'];
  if (i.type) parts.push('-t', bare(i.type));
  if (i.glob) parts.push('--glob', quote(i.glob));
  if (i['-i']) parts.push('-i');
  parts.push(quote(i.pattern ?? ''));
  if (i.path) parts.push(bare(i.path));
  return parts.join(' ');
}
