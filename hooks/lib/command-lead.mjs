// command-lead.mjs — which word leads a shell command once wrappers and grouping words are skipped.
//
//   commandName(word) -> string
//     the bare command name: directory and `.exe|.bat|.cmd` removed
//   leadIndex(words, matches) -> number
//     the index of the first word `matches(name, restWords)` accepts, found past wrappers (`sudo -u root`, `env A=1`,
//     `command`, `timeout 5`) and shell grouping words (`then`, `!`); -1 when another command leads
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

export function leadIndex(words, matches) {
  let wrapped = false;
  let afterFlag = false;
  for (let i = 0; i < words.length; i++) {
    if (matches(commandName(words[i]), words.slice(i + 1))) return i;
    if (RESERVED.test(words[i])) continue;
    const wrapper = WRAPPER.test(commandName(words[i]));
    const flag = wrapped && words[i].startsWith('-');
    const value = wrapped && (afterFlag || NUMBER.test(words[i]));
    if (!wrapper && !ENV_ASSIGN.test(words[i]) && !flag && !value) return -1;
    wrapped ||= wrapper;
    afterFlag = flag;
  }
  return -1;
}
