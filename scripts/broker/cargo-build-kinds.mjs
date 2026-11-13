// cargo-build-kinds.mjs — which target kinds a cargo command line compiles (KIT-T1143).
//
//   builtKinds(args)  -> Set of 'lib' | 'bin' | 'test' | 'bench' | 'example' the command compiles for a selected package.
//     Explicit target flags (--lib, --bin, --tests, --test NAME, --examples ...) name the kinds; else the subcommand's
//     default applies (build/check/run/clippy/doc: lib and bin; test: lib, bin, test, example). --all-targets, an
//     unknown subcommand and bench compile every kind: the side that keeps the guard.
//   ALL_KINDS         -> every kind
//   SOURCE_KINDS      -> the kinds a package's own source always compiles: lib and bin

export const ALL_KINDS = Object.freeze(['lib', 'bin', 'test', 'bench', 'example']);
export const SOURCE_KINDS = Object.freeze(['lib', 'bin']);

const FLAG_KIND = {
  '--lib': 'lib', '--doc': 'lib', '--bin': 'bin', '--bins': 'bin', '--test': 'test', '--tests': 'test',
  '--bench': 'bench', '--benches': 'bench', '--example': 'example', '--examples': 'example',
};
const ALL_TARGETS_FLAG = '--all-targets';
const SOURCE_ONLY = ['build', 'b', 'check', 'c', 'clippy', 'doc', 'd', 'rustc', 'rustdoc', 'run', 'r', 'install', 'fix'];
const TEST_DEFAULT = [...SOURCE_KINDS, 'test', 'example'];
const TEST_COMMANDS = ['test', 't'];

const subcommandOf = (args) => String(args.find((a) => !String(a).startsWith('-') && !String(a).startsWith('+')) ?? '');

export function builtKinds(args) {
  const list = [];
  for (const a of args) {
    if (String(a) === '--') break;
    list.push(String(a).split('=')[0]);
  }
  if (list.includes(ALL_TARGETS_FLAG)) return new Set(ALL_KINDS);
  const named = list.filter((a) => FLAG_KIND[a]).map((a) => FLAG_KIND[a]);
  if (named.length) return new Set([...SOURCE_KINDS, ...named]);
  const sub = subcommandOf(args);
  if (SOURCE_ONLY.includes(sub)) return new Set(SOURCE_KINDS);
  if (TEST_COMMANDS.includes(sub)) return new Set(TEST_DEFAULT);
  return new Set(ALL_KINDS);
}
