// commit-spec.mjs — which files a `git commit` takes, from the words after `commit` (KIT-T052).
//
//   commitSpec(call) -> { mode: 'paths', paths } | { mode: 'all' } | { mode: 'staged' } | { mode: 'tree' }
//     call: a parsed commit (git-calls.mjs commitCall) or null
//     paths:  an explicit pathspec           all:  -a / --all (tracked changes and the staged set)
//     staged: a bare commit                  tree: a call the words of which were not read: the whole dirty tree, the strict side
// The command's own words come quote-aware from the parser, so a message holding `->` or `>` never reaches the pathspec.

const VALUE_OPTIONS = new Set(['-m', '-F', '-t', '-c', '-C', '--message', '--file', '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--reuse-message', '--reedit-message', '--trailer', '--pathspec-from-file']);
const VALUE_SHORT_LETTER = /[mFtcC]$/;
const PATHSPEC_SEPARATOR = '--';

export function commitSpec(call) {
  if (!call || call.unparsed) return { mode: 'tree' };
  const words = call.args;
  const paths = [];
  let all = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === PATHSPEC_SEPARATOR) { paths.push(...words.slice(i + 1)); break; }
    if (word === '-a' || word === '--all') { all = true; continue; }
    if (word.startsWith('--')) { if (VALUE_OPTIONS.has(word)) i++; continue; }
    if (word.startsWith('-')) {
      if (word.includes('a')) all = true;
      if (VALUE_SHORT_LETTER.test(word)) i++;
      continue;
    }
    paths.push(word);
  }
  if (paths.length) return { mode: 'paths', paths };
  return { mode: all ? 'all' : 'staged' };
}
