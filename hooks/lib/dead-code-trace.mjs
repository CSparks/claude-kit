// dead-code-trace.mjs — the pre-write `dead-code` check: a comment line that records history ("removed …", "was: …",
// "deprecated: …", "old: …", "previously: …") instead of describing the code (KIT-D078).
//
//   isDeadCodeTrace(lines, i) -> true when line i opens a trace comment
//
// A lowercase trace word with no colon, on a comment line that continues an unfinished sentence from the comment line
// above, is a wrapped description ("… with its redirect\n//   removed, or null …"), not a trace (KIT-T1599).

const TRACE = /^\s*(\/\/|#|--)\s*(removed|was:|deprecated:|old:|previously:)/i;
const COMMENT = /^\s*(\/\/|#|--)\s*(.*?)\s*$/;
const SENTENCE_END = /[.!?:;)]$/;

function continuesSentence(lines, i, marker) {
  const above = i > 0 ? COMMENT.exec(lines[i - 1]) : null;
  return !!above && above[1] === marker && above[2] !== '' && !SENTENCE_END.test(above[2]);
}

export function isDeadCodeTrace(lines, i) {
  const m = TRACE.exec(lines[i]);
  if (!m) return false;
  const wrapped = m[2] === 'removed' && !/^\s*removed\s*:/.test(lines[i].slice(lines[i].indexOf(m[1]) + m[1].length));
  return !(wrapped && continuesSentence(lines, i, m[1]));
}
