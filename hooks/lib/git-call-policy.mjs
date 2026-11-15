// git-call-policy.mjs — the ALLOW-LIST a git call must stay inside to be judged precisely (KIT-T1163). Git can be redirected
// in more ways than any list names (environment, options, configuration, PATH, aliases, external programs), so a call is
// judged by the rules for its subcommand only when every part of it is on the list below; any other call is a sweep the
// gate refuses while another writer is live in the checkout, with the part that was not on the list named.
//
//   gitCallProblem(git, { lead, raw, shell, blind }) -> '' | the part of the call that is not on the allow-list
//     git:   gitCommand(...) output; lead: the words before `git` in its segment; raw: the whole command; shell: its shell;
//     blind: the quoting of the line is not trusted
//   GIT_ALLOW_RULE   the lists in one paragraph (printed by `q gates source`)
//
// Allowed: a BUILT-IN subcommand (a subcommand-less call runs nothing); global options -C <dir>, --no-pager, -P,
// --no-optional-locks, --literal-pathspecs, and `-c key=value` for a key in ALLOWED_CONFIG or under ALLOWED_CONFIG_PREFIXES;
// no environment variable assigned in front of the call, exported anywhere in the command, or (bare) assigned when the
// name is already in the environment, which includes PATH; no `env` options. ALLOWED_ASSIGNED_NAMES is empty: no name
// is exempt. The words `export`, `setenv`, `declare -x`, `typeset -x` and `set -a`, and any mention of the environment in
// PowerShell (`$env:`, `Env:`, `[Environment]`, SetEnvironmentVariable), count anywhere in the command or in a command text it
// runs, when a git word follows them in that text: a READ of `$env:TEMP` counts too. Telling a read from a change by the text of a
// command is not sound (KIT-T1262: three review rounds broke every recogniser), so the refusal says what to do instead: run the git
// call as its own command. A bare assignment of a name already in the environment counts in any of those texts. A git call that runs a
// command from somewhere unknown (git-run-commands.mjs) is off the list.

import { gitRunCommands } from './git-run-commands.mjs';
import { nestedSegments } from './lead-command-walk.mjs';

const BUILTIN = new Set(['add', 'am', 'annotate', 'apply', 'archive', 'bisect', 'blame', 'branch', 'bugreport', 'bundle', 'cat-file', 'check-attr', 'check-ignore',
  'check-mailmap', 'check-ref-format', 'checkout', 'checkout-index', 'cherry', 'cherry-pick', 'clean', 'clone', 'column', 'commit', 'commit-graph', 'commit-tree', 'config',
  'count-objects', 'credential', 'describe', 'diagnose', 'diff', 'diff-files', 'diff-index', 'diff-tree', 'difftool', 'fast-export', 'fast-import', 'fetch', 'fetch-pack',
  'filter-branch', 'fmt-merge-msg', 'for-each-ref', 'for-each-repo', 'format-patch', 'fsck', 'gc', 'get-tar-commit-id', 'grep', 'hash-object', 'help', 'hook', 'init',
  'interpret-trailers', 'log', 'ls-files', 'ls-remote', 'ls-tree', 'mailinfo', 'mailsplit', 'maintenance', 'merge', 'merge-base', 'merge-file', 'merge-index', 'merge-tree',
  'mergetool', 'mktag', 'mktree', 'multi-pack-index', 'mv', 'name-rev', 'notes', 'pack-objects', 'pack-redundant', 'pack-refs', 'patch-id', 'prune', 'prune-packed', 'pull',
  'push', 'range-diff', 'read-tree', 'rebase', 'reflog', 'remote', 'repack', 'replace', 'request-pull', 'rerere', 'reset', 'restore', 'rev-list', 'rev-parse', 'revert', 'rm',
  'send-email', 'shortlog', 'show', 'show-branch', 'show-index', 'show-ref', 'sparse-checkout', 'stash', 'status', 'stripspace', 'submodule', 'switch', 'symbolic-ref', 'tag',
  'unpack-file', 'unpack-objects', 'update-index', 'update-ref', 'update-server-info', 'var', 'verify-commit', 'verify-pack', 'verify-tag', 'version', 'whatchanged',
  'worktree', 'write-tree']);
const ALLOWED_FLAGS = new Set(['-C', '-c', '--no-pager', '-P', '--no-optional-locks', '--literal-pathspecs']);
export const ALLOWED_CONFIG = ['core.quotepath', 'core.autocrlf', 'core.safecrlf', 'core.longpaths', 'user.name', 'user.email', 'commit.gpgsign', 'protocol.file.allow'];
export const ALLOWED_CONFIG_PREFIXES = ['color.', 'advice.'];
export const ALLOWED_ASSIGNED_NAMES = [];

export const GIT_ALLOW_RULE = `a git call is judged precisely only when it stays on the allow-list: a built-in subcommand; global options -C <dir>, --no-pager, -P, --no-optional-locks, --literal-pathspecs and -c with ${ALLOWED_CONFIG.join(', ')}, ${ALLOWED_CONFIG_PREFIXES.map((p) => `${p}*`).join(', ')}; no environment assigned in front of it, exported in the command, or (bare) assigned to a name already in the environment (PATH, HOME, XDG_CONFIG_HOME, GIT_*); any other git call (an alias, an external git-x program, --exec-path, --git-dir, --work-tree, --config-env, an include or core.* key, an environment prefix, submodule foreach, for-each-repo, filter-branch, difftool or mergetool with a tool or command, a rebase --exec or bisect run whose command cannot be read) is refused while another writer is live in the checkout: write the call plainly, with a built-in command and those options`;

const ENV_ASSIGN = /^([A-Za-z_][A-Za-z0-9_]*)=/;
const ENV_OPTIONS_WRAPPER = /^(?:.*[\\/])?env(?:\.exe)?$/i;
// Every spelling that can reach the environment: the shell words (any flag group of declare, typeset or local holding x; set -a, -k,
// -o allexport, -o keyword) and PowerShell's own routes (`$env:`, the Env: drive, [Environment], the Environment provider,
// PSProvider, PSDrive, SetEnvironmentVariable). A plain word such as `local` or `environment` in a path is not one.
const EXPORTS = /(?<![\w-])(?:export|setenv|(?:declare|typeset|local)\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*x[A-Za-z]*|set\s+(?:-[A-Za-z]*[ak]\b|-o\s+(?:allexport|keyword)))(?![\w-])|\$env:|\bEnv:|SetEnvironmentVariable|\[Environment\]|Environment::|PSProvider|PSDrive/i;
const GIT_WORD = /(?<![\w-])git(?![\w-])/i;
const UNQUOTED = /['"`\\]/g;
// The environment token of `text` that a git word follows, or '': `git commit -m "export the helper"` changes nothing. The text is
// tried as written and with quotes, backslashes and backticks removed (`'export'`, `ex""port`).
const environmentTokenBeforeGit = (text) => {
  for (const candidate of [text, text.replace(UNQUOTED, '')]) {
    const found = EXPORTS.exec(candidate);
    if (found && GIT_WORD.test(candidate.slice(found.index + found[0].length))) return found[0];
  }
  return '';
};
const caseless = process.platform === 'win32';
const inEnvironment = (name) => Object.keys(process.env).some((k) => (caseless ? k.toLowerCase() === name.toLowerCase() : k === name));

const configAllowed = (key) => ALLOWED_CONFIG.includes(key) || ALLOWED_CONFIG_PREFIXES.some((p) => key.startsWith(p));

function optionProblem({ flag, value }) {
  if (!ALLOWED_FLAGS.has(flag)) return `global option ${flag}${value ? `=${value}` : ''}`;
  if (flag === '-c' && !configAllowed(value.split('=')[0].toLowerCase())) return `git config key ${value.split('=')[0]} given with -c`;
  return '';
}

// Names a bare assignment segment of the command sets: `A=1 B=2` as a command of its own.
function bareAssignments(parts) {
  return parts.flatMap((part) => {
    const names = [];
    for (const token of String(part.text).trim().split(/\s+/)) {
      const m = ENV_ASSIGN.exec(token);
      if (!m) return [];
      names.push(m[1]);
    }
    return names;
  });
}

// `parts`: every segment of the command and of each command text it runs (nestedSegments), so an export or an assignment
// inside a `bash -c`, `eval` or `su -c` string counts like one at the top level.
function environmentProblem(lead, raw, parts) {
  const prefix = lead.map((w) => ENV_ASSIGN.exec(w)?.[1]).find((n) => n && !ALLOWED_ASSIGNED_NAMES.includes(n));
  if (prefix) return `environment assignment ${prefix}= in front of git`;
  const at = lead.findIndex((w) => ENV_OPTIONS_WRAPPER.test(w));
  if (at >= 0 && lead.slice(at + 1).some((w) => w.startsWith('-'))) return 'options of env in front of git';
  const token = [raw, ...parts.map((part) => part.text)].map(environmentTokenBeforeGit).find(Boolean);
  if (token) return `the environment is named in the same command (\`${token}\`): run the git call as its own command, with no environment variable read or set in the same command`;
  const set = bareAssignments(parts).find((n) => !ALLOWED_ASSIGNED_NAMES.includes(n) && inEnvironment(n));
  return set ? `${set}= assigned in the same command, a name already in the environment` : '';
}

export function gitCallProblem(git, { lead = [], raw = '', shell = '', blind = false }) {
  if (!git.sub) return '';
  if (!BUILTIN.has(git.sub)) return `git ${git.sub}, which is not a built-in git command (an alias or an external program)`;
  const option = git.options.map(optionProblem).find(Boolean);
  return option || gitRunCommands(git, { blind }).problem || environmentProblem(lead, String(raw), nestedSegments(String(raw), shell));
}
