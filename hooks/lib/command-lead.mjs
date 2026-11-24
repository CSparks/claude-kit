// command-lead.mjs — which word leads a shell command once wrappers and grouping words are skipped.
//
//   commandName(word) -> string
//     the bare command name: directory and `.exe|.bat|.cmd` removed
//   leadIndex(words, matches, options) -> number
//     the index of the first word `matches(name, restWords)` accepts, found past wrappers (`sudo -u root`, `env A=1`,
//     `command`, `timeout 5`) and shell grouping words (`then`, `!`); -1 when another command leads
//   commandWordIndex(words, options) -> number
//     the index of the command word itself, past the same wrappers; -1 when only wrappers and assignments stand
//   fromCommandWord(text) -> string
//     the segment text from its command word on, without keywords (`do`, `then`, `!`), `{`, `(` and env assignments before it

const WRAPPER = /^(?:sudo|doas|env|command|exec|nohup|time|nice|ionice|timeout|stdbuf|xargs|builtin|setsid|unbuffer)$/i;
const RESERVED = /^(?:!|if|then|else|elif|do|while|until)$/;
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
const NUMBER = /^\d+(?:\.\d+)?[smhd]?$/;

export const commandName = (word) => String(word).replace(/.*[\\/]/, '').replace(/\.(?:exe|bat|cmd)$/i, '');

// What can stand before a segment's command word: a compound-command keyword, an opening `{` or `(`, an env assignment.
const LEAD_PREFIX = /^(?:\s+|(?:!|if|then|else|elif|do|while|until|\{)(?=\s)|\(+|[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s"'])*(?=\s))+/;

/** The segment text from its command word on: leading compound-command keywords, grouping and env assignments cut. */
export const fromCommandWord = (text) => String(text).replace(LEAD_PREFIX, '');

function walk(words, matches, { extraWrapper = null, operands = {}, strict = false, stopAtCommand = false }) {
  let wrapped = false;
  let afterFlag = false;
  let owed = 0;
  let owedUnlessFlag = false;
  for (let i = 0; i < words.length; i++) {
    const name = commandName(words[i]);
    if (matches(name, words.slice(i + 1))) return i;
    if (RESERVED.test(words[i])) continue;
    if (strict && wrapped && words[i] === '--') { afterFlag = false; continue; }
    const wrapper = WRAPPER.test(name) || (extraWrapper !== null && extraWrapper.test(name));
    const flag = wrapped && words[i].startsWith('-');
    const value = wrapped && (afterFlag || NUMBER.test(words[i]));
    if (flag && owedUnlessFlag) owed = 0;
    const operand = wrapped && !flag && !value && owed > 0;
    if (!wrapper && !ENV_ASSIGN.test(words[i]) && !flag && !value && !operand) return stopAtCommand ? i : -1;
    if (operand) owed--;
    if (wrapper) {
      owed += operands[name.toLowerCase()]?.count || 0;
      owedUnlessFlag = Boolean(operands[name.toLowerCase()]?.flagReplaces);
    }
    wrapped ||= wrapper;
    afterFlag = flag;
  }
  return -1;
}

/**
 * `options` widen the walk for a caller that must not be fooled by a wrapper it does not know: `extraWrapper` (a RegExp of
 * more wrapper names), `operands` ({ name: { count, flagReplaces } }: positional words the wrapper takes before its command,
 * none when an option appears and `flagReplaces` is set), `strict` (a `--` after a wrapper ends its options).
 */
export const leadIndex = (words, matches, options = {}) => walk(words, matches, options);

/**
 * The index of the command a segment runs: the first word past wrappers, assignments, options and their values, a word the
 * walk cannot place leading; -1 when only wrappers and assignments stand.
 */
export const commandWordIndex = (words, options = {}) => walk(words, () => false, { ...options, stopAtCommand: true });
