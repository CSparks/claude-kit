// pin-cite.mjs — a commit that moves a submodule pointer names, in its message, the sha it records (KIT-T1363). A pin
// message written from memory once named a framework commit while the gitlink recorded another writer's.
//
//   pinCiteProblems({ root, paths, message, fromWorktree }) -> [{ path, recorded, previous }] for each gitlink of `paths`
//        whose pointer this commit moves and whose recorded sha no hex word of `message` (7 to 40 characters) begins.
//        `fromWorktree(path)` says the commit takes the path from the work tree (a pathspec or -a commit, or a `git add`
//        in the same command): the submodule's HEAD is recorded; otherwise the staged index entry is.
//   pinCiteMessage(problems, footer) -> the block message, printing the sha to cite

import { stagedPin, treePin, worktreePin } from './gitlinks.mjs';

const HEX_WORD = /\b[0-9a-f]{7,40}\b/gi;
const SHORT = 8;

export function pinCiteProblems({ root, paths, message, fromWorktree }) {
  const cited = String(message || '').match(HEX_WORD)?.map((w) => w.toLowerCase()) || [];
  return paths.flatMap((path) => {
    const previous = treePin(root, 'HEAD', path);
    const staged = stagedPin(root, path);
    if (!previous && !staged) return [];
    const recorded = (fromWorktree(path) ? worktreePin(root, path) : staged) || staged;
    if (!recorded || recorded === previous || cited.some((w) => recorded.startsWith(w))) return [];
    return [{ path, recorded, previous }];
  });
}

export function pinCiteMessage(problems, footer) {
  return [
    '',
    `BLOCKED: this commit moves ${problems.length} submodule pointer(s) and its message does not name the sha recorded (KIT-T1363).`,
    '',
    ...problems.map((p) => `  ${p.path}: records ${p.recorded.slice(0, SHORT)} (${p.recorded})${p.previous ? `, was ${p.previous.slice(0, SHORT)}` : ''}`),
    '',
    'A pin message names the commit the gitlink points at, read from git, never from memory: another writer may have',
    'committed in the submodule since. Put that sha in the message (e.g. "Pin <path> to <sha>: ..."), or stage the pointer',
    'you meant first (git -C <path> checkout <sha>, then git add <path>).',
    '',
    footer,
  ].join('\n');
}
