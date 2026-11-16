// grep-tool-note.mjs — the lines of a query-gate source-discovery block that depend on WHICH tool was judged.
//
//   grepToolLines(isGrepTool)    -> [] for a Bash/PowerShell call; for the Grep tool, a note that it was judged as the `rg` line above
//   targetedLookLines(isGrepTool) -> the "one known file is allowed" advice, naming the tool the caller used

export function grepToolLines(isGrepTool) {
  return isGrepTool
    ? ['  (You called the Grep tool: it is judged as the rg line above, so a directory, a glob or no path is `q code`, never Grep.)']
    : [];
}

export function targetedLookLines(isGrepTool) {
  return isGrepTool
    ? ['For a TARGETED look once you know the file: a Grep call whose path is ONE file passes, as does the Read tool.']
    : ['For a TARGETED look once you know the file, use the Grep/Glob/Read tools', '(not Bash grep). A bare `grep <pattern> <one-specific-file>` is allowed.'];
}
