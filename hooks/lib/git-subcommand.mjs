// git-subcommand.mjs — which git subcommand a command line runs, read past git's global options (KIT-T1069).
//
//   gitCommand(words) -> { sub, args, dir, config, gitDir, workTree, redirected }
//     words: the tokens AFTER the `git` word, quotes already respected by the caller's tokenizer
//     sub:   the lower-case subcommand ('' when the line ends inside the global options)
//     args:  the tokens after the subcommand
//     dir:   the value of `-C`, quotes stripped ('' when absent)
//     config: the `-c key=value` settings as { key: value } (keys lower-case)
//     gitDir, workTree: the values of `--git-dir` and `--work-tree` ('' when absent)
//     redirected: true when an option changes which configuration or tree git reads in a way a caller cannot reproduce:
//       `--git-dir`, `--work-tree`, `--config-env`, and `-c include.path=` or `-c includeIf.<cond>.path=`
//
// `git -C <dir> grep`, `git --no-pager grep` and `git -c k=v grep` are all `git grep`; a gate that reads only the
// first word after `git` misses every one of them.

const VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env', '--attr-source']);
const INCLUDE_KEY = /^include/;
const unquote = (s) => String(s).replace(/^["']|["']$/g, '');

export function gitCommand(words) {
  let dir = '';
  let gitDir = '';
  let workTree = '';
  let configEnv = false;
  const config = {};
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.startsWith('-')) return result(words.slice(i + 1), unquote(word).toLowerCase());
    const [flag, ...inline] = word.startsWith('--') ? word.split('=') : [word];
    const separate = VALUE_OPTIONS.has(flag) && !inline.length;
    const value = inline.length ? unquote(inline.join('=')) : separate ? unquote(words[i + 1] || '') : '';
    if (flag === '-C') dir = value;
    if (flag === '--git-dir') gitDir = value;
    if (flag === '--work-tree') workTree = value;
    if (flag === '--config-env') configEnv = true;
    if (flag === '-c') {
      const [key, ...rest] = value.split('=');
      config[key.toLowerCase()] = rest.join('=');
    }
    if (separate) i++;
  }
  return result([], '');

  function result(args, sub) {
    const redirected = Boolean(gitDir || workTree) || configEnv || Object.keys(config).some((k) => INCLUDE_KEY.test(k));
    return { sub, args, dir, config, gitDir, workTree, redirected };
  }
}
