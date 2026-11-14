// The Grep tool is `rg` with a JSON input. query-gate judges it with the same rules as a shell
// `rg`, so the tool is no way around the retrieval gate: this renders a Grep tool input as the
// equivalent `rg` command line. Every field is rendered as one token that plain quote pairing reads
// back whole, whatever it holds: a pattern is single-quoted with an apostrophe written as the regex
// escape `\x27`, a path is single-quoted only when it needs it (double-quoted when it holds an
// apostrophe), and a glob's apostrophe becomes the wildcard `?`. A plain file path still reads as a
// concrete file.
//
//   grepToolCommand(input) -> 'rg [-t T] [--glob G] [-i] <pattern> [<path>]'

const SAFE = /^[\w@%+=:,./\\-]+$/;
const APOSTROPHE = /'/g;
const single = (s) => `'${s}'`;
const pattern = (s) => single(String(s).replace(APOSTROPHE, '\\x27'));
const glob = (s) => single(String(s).replace(APOSTROPHE, '?'));
const bare = (s) => {
  const text = String(s);
  if (SAFE.test(text)) return text;
  return text.includes("'") ? `"${text}"` : single(text);
};

export function grepToolCommand(input) {
  const i = input || {};
  const parts = ['rg'];
  if (i.type) parts.push('-t', bare(i.type));
  if (i.glob) parts.push('--glob', glob(i.glob));
  if (i['-i']) parts.push('-i');
  parts.push(pattern(i.pattern ?? ''));
  if (i.path) parts.push(bare(i.path));
  return parts.join(' ');
}
