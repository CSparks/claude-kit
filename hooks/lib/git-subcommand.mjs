// git-subcommand.mjs — which git subcommand a command line runs, read past git's global options (KIT-T1069).
//
//   gitCommand(words) -> { sub, args, dir, config }
//     words: the tokens AFTER the `git` word, quotes already respected by the caller's tokenizer
//     sub:   the lower-case subcommand ('' when the line ends inside the global options)
//     args:  the tokens after the subcommand
//     dir:   the value of `-C`, quotes stripped ('' when absent)
//     config: the `-c key=value` settings as { key: value }
//
// `git -C <dir> grep`, `git --no-pager grep` and `git -c k=v grep` are all `git grep`; a gate that reads only the
// first word after `git` misses every one of them.

const VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source']);
const unquote = (s) => String(s).replace(/^["']|["']$/g, '');

export function gitCommand(words) {
  let dir = '';
  const config = {};
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.startsWith('-')) return { sub: unquote(word).toLowerCase(), args: words.slice(i + 1), dir, config };
    if (!VALUE_OPTIONS.has(word)) continue;
    if (word === '-C') dir = unquote(words[i + 1] || '');
    if (word === '-c') {
      const [key, ...value] = unquote(words[i + 1] || '').split('=');
      config[key.toLowerCase()] = value.join('=');
    }
    i++;
  }
  return { sub: '', args: [], dir, config };
}
