// The files a `git commit -- <paths>` would include, from `git status --porcelain -- <paths>` (KIT-T1020).
//   pathspecFiles(porcelain) -> string[]    the tracked entries only
// A commit with a pathspec (`--only`) takes the named paths that git already knows: an untracked file under a named
// directory (`target/`, or the `.` of `git commit -- .`) is never part of it, so it is never judged as part of it.

const UNTRACKED = '??';
const STATUS_COLUMNS = 'XY '.length;

export function pathspecFiles(porcelain) {
  return [...new Set(String(porcelain).split('\n').filter(Boolean)
    .filter((line) => line.slice(0, 2) !== UNTRACKED)
    .map((line) => {
      const path = line.slice(STATUS_COLUMNS);
      return (path.includes(' -> ') ? path.split(' -> ').pop() : path).replace(/^"|"$/g, '');
    }))];
}
