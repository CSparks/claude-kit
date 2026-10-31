// timing-cmd.mjs — what a cargo command line names (KIT-D121): its `-p` crates and its test targets.
//
//   cratesOf(cmd)  -> the `-p` / `--package` crates, ['(workspace)'] when none
//   targetsOf(cmd) -> '--test x' / '--bin x' / '--lib' per named target, ['(all tests)'] when none
//   WORKSPACE      -> the placeholder crate name

export const WORKSPACE = '(workspace)';
const PACKAGE_FLAGS = new Set(['-p', '--package']);
const TARGET_FLAGS = new Set(['--test', '--bin', '--example', '--bench']);

const argsOf = (cmd) => {
  const toks = String(cmd).trim().split(/\s+/);
  const sep = toks.indexOf('--');
  return sep === -1 ? toks : toks.slice(0, sep);
};

export function cratesOf(cmd) {
  const args = argsOf(cmd);
  const named = args.flatMap((t, i) => (PACKAGE_FLAGS.has(args[i - 1]) ? [t] : []));
  return named.length ? named : [WORKSPACE];
}

export function targetsOf(cmd) {
  const args = argsOf(cmd);
  const named = args.flatMap((t, i) => (TARGET_FLAGS.has(args[i - 1]) ? [`${args[i - 1]} ${t}`] : args[i] === '--lib' ? ['--lib'] : []));
  return named.length ? named : ['(all tests)'];
}
