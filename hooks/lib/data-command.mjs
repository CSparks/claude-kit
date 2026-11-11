// data-command.mjs — is a shell command one whose quoted arguments and stdin are data, never code (KIT-T784).
//
//   isDataCommand(words) -> boolean   words: one command's words (env assignments allowed up front)
//
// True for tools that take text as a value (git, gh, cat, tee, t, cap, rem, q, wc, sort, jq, echo, printf, cd, head, tail)
// and for node/python running a script FILE. False for shells, `node -e`, `node -`, ssh, eval and anything
// unknown: their text may be run.

const DATA_TOOLS = /^(?:git|gh|cat|tee|t|cap|rem|q|wc|sort|jq|echo|printf|cd|head|tail)$/i;
const SCRIPT_RUNNERS = /^(?:node|python3?|py)(?:\.exe)?$/i;
const SCRIPT_FILE = /\.(?:m?js|cjs|py)$/i;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;

export const baseName = (word) => word.replace(/^["']|["']$/g, '').replace(/\\/g, '/').split('/').pop();

const INLINE_RUNNERS = /^(?:node|python3?|py|deno|bun)(?:\.exe)?$/i;
const INLINE_FLAG = /^(?:-e|--eval|-p|--print|-c)$/;

/** True for an interpreter run with its program inline (`node -e "..."`, `python -c "..."`): the quoted text is its own language. */
export function isInlineCode(words) {
  const at = words.findIndex((w) => !ENV_ASSIGN.test(w));
  return at >= 0 && INLINE_RUNNERS.test(baseName(words[at])) && words.slice(at + 1).some((w) => INLINE_FLAG.test(w));
}

export function isDataCommand(words) {
  const at = words.findIndex((w) => !ENV_ASSIGN.test(w));
  if (at < 0) return false;
  const tool = baseName(words[at]);
  if (DATA_TOOLS.test(tool)) return true;
  if (!SCRIPT_RUNNERS.test(tool)) return false;
  const script = words.slice(at + 1).find((w) => !w.startsWith('-'));
  return !!script && SCRIPT_FILE.test(baseName(script));
}
