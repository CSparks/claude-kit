// agent-gate-guide.mjs — what a subagent does INSTEAD of the shell forms two gates refuse, in one place (KIT-T1439): the
// one-file-search gate (a pattern search of one named file) and the source-shell-write gate (a shell write of source, a git
// call that stashes the shared work tree). The SubagentStart hook hands GATE_GUIDE to every subagent whatever its type, so
// a `general-purpose` writer, which has no agent definition, still learns it before its first call; the block texts reuse
// the pieces at the moment of the mistake.
//
//   GATE_GUIDE        lines handed to a subagent at start
//   BASELINE_ROUTE    the ways to learn "does this fail without my change?" in a checkout other writers share
//   grepToolCall(files, pattern) -> the exact Grep tool call that answers a one-file search
//   editToolLine(path)           -> the Edit tool line that replaces a shell write of an existing `path`
//   writeToolLine(path)          -> the Write tool line that replaces a shell write that creates `path`

export const BASELINE_ROUTE = [
  'A baseline (does it fail without my change?) is never a stash of the shared tree:',
  '  1. take it before your first edit, or read the number the last commit message or the ticket Notes already records;',
  '  2. read the old code with `git show HEAD:<path>` (a read);',
  '  3. stash only files you wrote: `git stash push -m <note> -- <each file you wrote>`, run the check, `git stash pop` (a bare stash, a directory or a glob is refused while another writer is live);',
  '  4. otherwise raise it to the coordinator, who runs it when no other writer is live.',
];

export const GATE_GUIDE = [
  'Shell forms the kit refuses, and what to call instead (check ids one-file-search, source-shell-write):',
  '- One named file: Read (file_path, offset, limit) shows it; the Grep tool (pattern, path = that one file) searches it. Never `grep`, `rg`, `awk \'/x/\'` or `sed -n \'/x/p\'` on it in Bash.',
  '- A directory, tree or glob: `q code <text> [--path <dir>] [--lang <l>] [--regex -i -w -C 2]`, `q sym <name>`, `q file <glob>`. A log or build output: Read it, or `q code <text> --dir <path>`.',
  '- Filtering a command\'s own output stays allowed: `cargo test 2>&1 | grep -E \'test result|FAILED\' | tail -20`.',
  '- Changing source: the Edit tool (old_string, new_string; replace_all for a rename) or the Write tool. Never sed -i, perl -i, a redirect, tee, a heredoc or `node -e` on a repo file.',
  ...BASELINE_ROUTE.map((line, i) => (i === 0 ? `- ${line}` : line)),
  'On any hook block your next reply says whether it was a process failure, a kit bug or a known kit bug; never retry or route around it.',
];

export function grepToolCall(files, pattern) {
  const target = files.length === 1 ? files[0] : '<one of the files>';
  const text = pattern || '<pattern>';
  return `Grep tool: pattern ${JSON.stringify(text)}, path ${JSON.stringify(target)}, output_mode "content" (-n, -i and -C <lines> are Grep parameters)${files.length > 1 ? '; one call per file' : ''}`;
}

export const writeToolLine = (path) => `Write tool: file_path ${JSON.stringify(path)}, content (the whole new file).`;

export const editToolLine = (path) => `Edit tool: file_path ${JSON.stringify(path)}, old_string -> new_string for each substitution (replace_all: true for a global s///g); one Edit per file.`;
