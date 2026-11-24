// install-owner.mjs — which `install` words of one command a known non-copying command positively owns.
//
//   unownedInstalls(words) -> number
//     how many `install` words of `words` (one command's words, grouping characters cut) the shell may run as the coreutils
//     copy: the one leading the command, and every other one no owner below claims. An unknown command before `install`
//     (`frobnicate install a b`, `docker run --rm npm install a b`, `chroot npm install a b`) owns nothing.
//   installWordCount(words) -> number
//     how many words of `words` are an `install` word, owned or not
//   ownerLeadIndex(words) -> number
//     the index of the command word the owner walk finds past wrappers; -1 when only wrappers and assignments stand
//
// Owners, each in exact forms (any other form owns nothing):
//   a package manager whose own subcommand is `install` (`npm --prefix app install`, `cargo install`, `rustup toolchain
//     install`, `dotnet tool install`, `nix profile install`); an option between the manager and `install` must be one the
//     manager's table lists, and a value option directly before `install` took it as its value;
//   `make` and `gmake`, `ninja`: `install` a target word among the listed options and assignments;
//   `meson install`; `cmake --build DIR --target install`; git, whose words are text.
// The owner is the command a strict walk finds past wrappers (`sudo`, `fakeroot`, `chroot DIR`, `wsl -d Ubuntu --`).

import { commandName, commandWordIndex, leadIndex } from './command-lead.mjs';

const INSTALL = /^install$/i;
const NO_GROUP = [[]];

const SHARED_FLAGS = new Set(['-y', '--yes', '-q', '--quiet', '-v', '--verbose', '--silent', '-g', '--global', '--no-audit', '--no-fund', '--force', '--dry-run', '--locked', '--frozen', '--offline', '--user']);

const MANAGERS = new Map([
  ['npm', { values: ['--prefix', '--workspace', '-w', '--registry', '--cache', '--userconfig'] }],
  ['pnpm', { values: ['--dir', '-C', '--filter', '-F', '--registry'] }],
  ['yarn', { values: ['--cwd', '--registry', '--cache-folder'] }],
  ['bun', { values: ['--cwd', '--registry', '--cache-dir'] }],
  ['cargo', { values: ['--manifest-path', '--root', '--target-dir', '--config', '-C', '-Z', '--color'] }],
  ['pip', { values: ['--cache-dir', '--log', '--proxy', '--retries', '--timeout', '--cert', '--client-cert'] }],
  ['pip3', { values: ['--cache-dir', '--log', '--proxy', '--retries', '--timeout', '--cert', '--client-cert'] }],
  ['pipx', {}],
  ['uv', { paths: [[], ['pip']], values: ['--directory', '--project', '--python', '--cache-dir', '--config-file'] }],
  ['poetry', { values: ['-C', '--directory', '--project', '-P'] }],
  ['gem', {}],
  ['bundle', {}],
  ['brew', {}],
  ['apt', { values: ['-o', '-c', '-t', '--target-release'] }],
  ['apt-get', { values: ['-o', '-c', '-t', '--target-release'] }],
  ['dnf', { values: ['-c', '--config', '--installroot', '--releasever', '--setopt', '--enablerepo', '--disablerepo', '-x', '--exclude'] }],
  ['yum', { values: ['-c', '--config', '--installroot', '--releasever', '--setopt', '--enablerepo', '--disablerepo', '-x', '--exclude'] }],
  ['apk', { values: ['-p', '--root', '-X', '--repository'] }],
  ['choco', {}],
  ['winget', {}],
  ['scoop', {}],
  ['go', { values: ['-C'] }],
  ['composer', { values: ['-d', '--working-dir'] }],
  ['nuget', {}],
  ['mix', {}],
  ['pacman', {}],
  ['zypper', { values: ['-R', '--root'] }],
  ['snap', {}],
  ['flatpak', { values: ['--installation'] }],
  ['port', { values: ['-D'] }],
  ['dotnet', { paths: [['tool']] }],
  ['rustup', { paths: [['toolchain']] }],
  ['nix', { paths: [['profile']], values: ['--extra-experimental-features', '--option', '-I'] }],
]);

const MAKE = {
  values: new Set(['-C', '-f', '-I', '-o', '-W', '-l', '--directory', '--file', '--makefile', '--include-dir', '--old-file', '--assume-old', '--what-if', '--assume-new', '--new-file', '--load-average', '--max-load']),
  flag: /^(?:-[BbeikmnpqRrSstw]+|-j\d*|-O\w*|--(?:keep-going|silent|quiet|just-print|dry-run|always-make|no-print-directory|print-directory|ignore-errors|environment-overrides|no-builtin-rules|no-builtin-variables|warn-undefined-variables|jobs|output-sync|touch|question|stop|no-keep-going))$/,
  attached: /^-[CfIoWl]\S/,
};
const NINJA = {
  values: new Set(['-C', '-f', '-j', '-k', '-l', '-d', '-t', '-w']),
  flag: /^(?:-[nv]+|--verbose|--version)$/,
  attached: /^-[CfjklDtw]\S/,
};
const TARGET_TOOLS = new Map([['make', MAKE], ['gmake', MAKE], ['ninja', NINJA]]);
const CMAKE_TARGET_OPTION = /^(?:--target|-t)$/;

const OWNER_WALK = {
  extraWrapper: /^(?:busybox|wsl|fakeroot|chroot|strace|flock|nsenter|taskset|parallel)$/i,
  operands: { chroot: { count: 1 }, flock: { count: 1 }, taskset: { count: 1, flagReplaces: true } },
  strict: true,
};

const isInstall = (word) => INSTALL.test(commandName(word));
const optionName = (word) => word.split('=')[0];

// The words between a manager and its `install` without options; null when an option is not in the manager's table or a
// value option has no word left before `install` to take.
function subcommandWords(between, { values = [] }) {
  const words = [];
  for (let i = 0; i < between.length; i++) {
    const word = between[i];
    if (!word.startsWith('-')) { words.push(word.toLowerCase()); continue; }
    const name = optionName(word);
    if (values.includes(name)) {
      if (name === word && ++i >= between.length) return null;
    } else if (!SHARED_FLAGS.has(name)) return null;
  }
  return words;
}

const sameWords = (a, b) => a.length === b.length && a.every((word, i) => word === b[i]);

function managerOwns(manager, between) {
  const sub = subcommandWords(between, manager);
  return sub !== null && (manager.paths || NO_GROUP).some((path) => sameWords(path, sub));
}

// A build tool takes `install` as a target when every option before it is a listed one.
function targetOwns({ values, flag, attached }, between) {
  for (let i = 0; i < between.length; i++) {
    const word = between[i];
    if (!word.startsWith('-')) continue;
    const name = optionName(word);
    if (values.has(name)) {
      if (name === word && ++i >= between.length) return false;
    } else if (!flag.test(name) && !attached.test(word)) return false;
  }
  return true;
}

// `cmake --build DIR ... --target install`: the nearest option before `install` is the target option, the mode stays a build.
function cmakeOwns(between) {
  if (between[0] !== '--build' || between.includes('--')) return false;
  const option = [...between].reverse().find((word) => word.startsWith('-'));
  return CMAKE_TARGET_OPTION.test(option);
}

function owns(owner, between) {
  const name = commandName(owner).toLowerCase();
  if (name === 'git') return true;
  if (name === 'meson') return between.length === 0;
  if (name === 'cmake') return cmakeOwns(between);
  if (TARGET_TOOLS.has(name)) return targetOwns(TARGET_TOOLS.get(name), between);
  return MANAGERS.has(name) && managerOwns(MANAGERS.get(name), between);
}

/** Whether the `install` word at `at` is an argument of the command a strict walk finds before it, and that command owns it. */
function owned(words, at) {
  const lead = ownerLeadIndex(words);
  return lead >= 0 && lead < at && owns(words[lead], words.slice(lead + 1, at));
}

export const ownerLeadIndex = (words) => commandWordIndex(words, OWNER_WALK);

export const installWordCount = (words) => words.filter(isInstall).length;

export function unownedInstalls(words) {
  const leading = leadIndex(words, (name) => INSTALL.test(name), OWNER_WALK);
  return words.filter((word, i) => isInstall(word) && (i === leading || !owned(words, i))).length;
}
