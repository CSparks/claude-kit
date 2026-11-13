// The files a `git commit` would include, from `git status --porcelain -uall -- <paths>` (KIT-T1020, KIT-T1158).
//   pathspecFiles(porcelain, { staged })  -> string[]  the entries a pathspec commit takes; untracked entries only when `staged`
//   sameCommandAdds(command)              -> string[]  the pathspecs of every `git add` in the command ('.' for a bare or -A add)
// A commit with a pathspec (`--only`) takes the named paths that git already knows. An untracked file under a named
// directory (`target/`, or the `.` of `git commit -- .`) is never part of it, unless a `git add` earlier in the SAME
// command stages it: then it is the commit's, and `status -uall` lists it as a file, never as a collapsed `dir/`.

const UNTRACKED = '??';
const STATUS_COLUMNS = 'XY '.length;
const ADD = /\bgit\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+)?add\b([^;&|\n]*)/g;
const ALL_FLAGS = new Set(['-A', '--all', '.']);

export function pathspecFiles(porcelain, { staged = false } = {}) {
  return [...new Set(String(porcelain).split('\n').filter(Boolean)
    .filter((line) => staged || line.slice(0, 2) !== UNTRACKED)
    .map((line) => {
      const path = line.slice(STATUS_COLUMNS);
      return (path.includes(' -> ') ? path.split(' -> ').pop() : path).replace(/^"|"$/g, '');
    }))];
}

export function sameCommandAdds(command) {
  const specs = [];
  for (const m of String(command).matchAll(ADD)) {
    const toks = [...m[1].matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);
    const dashAt = toks.indexOf('--');
    const paths = dashAt === -1 ? toks.filter((t) => !t.startsWith('-') || ALL_FLAGS.has(t)) : toks.slice(dashAt + 1);
    specs.push(...(paths.length ? paths.map((t) => (ALL_FLAGS.has(t) ? '.' : t)) : ['.']));
  }
  return specs;
}
