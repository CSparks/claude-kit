// git-run-commands.mjs — the git subcommands that RUN a command the caller names, read from a parsed git call
// (git-subcommand.mjs gitCommand). A gate that judges the file writes of a shell command must judge the command such a call runs
// as it would judge it typed alone (KIT-T1172).
//
//   rawGitCall(text) -> gitCommand shape | null   the segment's git call from its quote-aware tokens

//   gitRunCommands(git, { blind }) -> { texts: string[], problem: string }
//     texts:   the shell commands the call runs in the directory it was started from (`rebase -x|--exec`, `bisect run`)
//     problem: why the call cannot be judged by its command: it runs one elsewhere or from configuration (`submodule foreach`,
//              `for-each-repo`, `filter-branch`, `difftool` or `mergetool` with `-x`, `--extcmd`, `-t` or `--tool`), or the
//              command operand is missing or is itself a variable or substitution; with `blind` (the quoting is not trusted)
//              any call that runs a command. '' when the call runs none.

import { commandName } from './command-lead.mjs';
import { gitCommand } from './git-subcommand.mjs';
import { cleaned, commandTokens } from './lead-command-walk.mjs';
import { dequoted } from './shell-segments.mjs';

const GIT_WORD = /^git$/i;
const NOT_EXTRACTABLE = /^\s*(?:$|[$`(])/;
const TOOL_FLAGS = /^(?:-t.*|-x.*|--tool(?:=.*)?|--extcmd(?:=.*)?)$/;
const REBASE_SHORT = /^-[A-Za-z]+$/;
const QUOTE_NEEDED = /[\s"'$`;&|<>()]/;

const quoted = (word) => (!QUOTE_NEEDED.test(word) ? word : word.includes('"') ? `'${word}'` : `"${word}"`);
const asText = (words) => (words.length === 1 ? words[0] : words.map(quoted).join(' '));

// The values `-x`, `--exec` and `--exec=` give a rebase; a short bundle takes the rest of the token after its `x` as the value.
function rebaseExecs(args) {
  const found = [];
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === '--') break;
    if (token === '--exec' || token.startsWith('--exec=')) {
      found.push(token === '--exec' ? args[++i] ?? '' : token.slice('--exec='.length));
    } else if (REBASE_SHORT.test(token) && token.includes('x')) {
      const rest = token.slice(token.indexOf('x') + 1);
      found.push(rest || args[++i] || '');
    }
  }
  return found;
}

/**
 * The git call of one segment read from its quote-aware tokens, `$` and redirect characters inside a quoted operand intact
 * (the word walk strips both); null when the segment runs no git. gitCommand's shape.
 */
export function rawGitCall(text) {
  const tokens = commandTokens(text);
  const at = tokens.findIndex((t) => GIT_WORD.test(commandName(cleaned([t])[0] || '')));
  return at < 0 ? null : gitCommand(tokens.slice(at + 1).map(dequoted));
}

const unreadable = (what) => `${what} with a command operand this gate cannot read`;

export function gitRunCommands({ sub, args }, { blind = false } = {}) {
  const none = { texts: [], problem: '' };
  const first = args.find((a) => !a.startsWith('-')) || '';
  let found = none;
  if (sub === 'submodule' && first === 'foreach') found = { texts: [], problem: 'git submodule foreach, which runs its command inside each submodule directory' };
  else if (sub === 'for-each-repo') found = { texts: [], problem: 'git for-each-repo, which runs git in every repository a configuration key lists' };
  else if (sub === 'filter-branch') found = { texts: [], problem: 'git filter-branch, which runs shell filters over every commit' };
  else if ((sub === 'difftool' || sub === 'mergetool') && args.some((a) => TOOL_FLAGS.test(a))) {
    found = { texts: [], problem: `git ${sub} with a tool or command option, which runs a program git is not shown here` };
  } else if (sub === 'rebase') {
    const execs = rebaseExecs(args);
    found = execs.length ? { texts: execs, problem: execs.some((t) => NOT_EXTRACTABLE.test(t)) ? unreadable('git rebase --exec') : '' } : none;
  } else if (sub === 'bisect' && first === 'run') {
    const words = args.slice(args.indexOf('run') + 1);
    const text = asText(words);
    found = { texts: [text], problem: NOT_EXTRACTABLE.test(text) ? unreadable('git bisect run') : '' };
  }
  if (blind && (found.texts.length || found.problem)) return { texts: [], problem: found.problem || `git ${sub} runs a command and the quoting of this line cannot be trusted` };
  return found;
}
