// git-subcommand.mjs — which git subcommand a command line runs, read past git's global options (KIT-T1069).
//
//   gitCommand(words) -> { sub, args, dir, config, options }
//     words: the tokens AFTER the `git` word, quotes already respected by the caller's tokenizer
//     sub:   the lower-case subcommand ('' when the line ends inside the global options)
//     args:  the tokens after the subcommand
//     dir:   the value of `-C`, quotes stripped ('' when absent)
//     config: the `-c key=value` settings as { key: value } (keys lower-case)
//     options: every global option given, in order, as { flag, value } (value '' for a flag without one)
//
// `git -C <dir> grep`, `git --no-pager grep` and `git -c k=v grep` are all `git grep`; a gate that reads only the
// first word after `git` misses every one of them.

const VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source']);
const unquote = (s) => String(s).replace(/^["']|["']$/g, '');

export function gitCommand(words) {
  let dir = '';
  const config = {};
  const options = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.startsWith('-')) return { sub: unquote(word).toLowerCase(), args: words.slice(i + 1), dir, config, options };
    const [flag, ...inline] = word.startsWith('--') ? word.split('=') : [word];
    const separate = VALUE_OPTIONS.has(flag) && !inline.length;
    const value = inline.length ? unquote(inline.join('=')) : separate ? unquote(words[i + 1] || '') : '';
    options.push({ flag, value });
    if (flag === '-C') dir = value;
    if (flag === '-c') {
      const [key, ...rest] = value.split('=');
      config[key.toLowerCase()] = rest.join('=');
    }
    if (separate) i++;
  }
  return { sub: '', args: [], dir, config, options };
}
