// precheck-scope.mjs — the part of the workspace a job will build, checked first (KIT-D115 follow-up). The precheck's
// whole-workspace `cargo check --all-targets` can outlast its timeout on a big game, and a timed-out precheck lets the job
// queue with its compile error. The narrow check compiles only what the job's own cargo commands build: each named
// package's library plus the test binaries it names (or all its tests when it names none), so an error in a file the
// patch touches is found in seconds.
//
//   narrowChecks(checkCmd, jobCommands, { submodule }?) -> `cargo check` commands, [] when the job's commands name no package
//     checkCmd: the configured whole-workspace check; its flags (--offline, --features …) are kept, --workspace and
//     --all-targets are replaced by `-p <crate> … --lib --test <name> …`.
//     submodule: the repo is a submodule with a workspace of its own. The check runs where the job's first cargo command
//     runs (its `cd <dir> &&` prefix leads the check), covers only that command's workspace, and drops the superproject's
//     `--features`: they name superproject crates, which cargo refuses outside its workspace.
//     `--manifest-path <file>`: the command builds in the workspace that manifest roots (a framework crate with its own
//     dev-dependencies). It gets a check of its own that repeats the flag and drops `--features`; folding its packages into
//     the repo's check resolves them without those dev-dependencies and refuses every integration test (KIT-T829).

const TEST_COMMAND = /^cargo\s+(?:test|t|nextest\s+run)(?:\s+(.*))?$/;
const WORKSPACE_FLAGS = new Set(['--workspace', '--all-targets', '--all']);
const PACKAGE = new Set(['-p', '--package']);
const TARGET_KIND = new Set(['--lib', '--bins', '--tests', '--examples', '--benches']);
const NAMED_TARGET = new Set(['--test', '--bin', '--example', '--bench']);
const FEATURE_FLAGS = new Set(['--features', '-F']);
const MANIFEST_PATH = '--manifest-path';
const ENTER = /^cd\s+\S+\s*&&\s*/;

const enterOf = (command) => (ENTER.exec(String(command).trim()) || [''])[0];

function cargoTest(command) {
  const m = TEST_COMMAND.exec(String(command).trim().replace(ENTER, ''));
  if (!m) return null;
  const args = (m[1] || '').split(/\s+/).filter(Boolean);
  const end = args.indexOf('--');
  return end === -1 ? args : args.slice(0, end);
}

function manifestOf(args) {
  const at = args.indexOf(MANIFEST_PATH);
  if (at !== -1) return args[at + 1] || '';
  const joined = args.find((a) => a.startsWith(`${MANIFEST_PATH}=`));
  return joined ? joined.slice(MANIFEST_PATH.length + 1) : '';
}

function addArgs(group, args) {
  const named = [];
  for (let i = 0; i < args.length; i++) {
    if (PACKAGE.has(args[i]) && args[i + 1]) { if (!group.packages.includes(args[i + 1])) group.packages.push(args[i + 1]); i++; }
    else if (NAMED_TARGET.has(args[i]) && args[i + 1]) named.push(`${args[i]} ${args[++i]}`);
    else if (TARGET_KIND.has(args[i])) named.push(args[i]);
  }
  group.targets.push(...(named.length ? named : ['--tests']));
}

// One group per workspace the commands build in: a manifest path is its own workspace; the rest share the repo's (a
// submodule keeps one group per `cd` prefix and checks the first cargo command's).
function wanted(commands, submodule) {
  const groups = new Map();
  for (const command of commands) {
    const args = cargoTest(command);
    if (!args) continue;
    const manifest = manifestOf(args);
    const enter = submodule ? enterOf(command) : '';
    const key = `${enter}|${manifest}`;
    if (!groups.has(key)) groups.set(key, { enter, manifest, packages: [], targets: [] });
    addArgs(groups.get(key), args);
  }
  const all = [...groups.values()];
  return (submodule ? all.slice(0, 1) : all).filter((g) => g.packages.length);
}

const withoutFeatures = (tokens) => tokens.filter((t, i) => !FEATURE_FLAGS.has(t) && !FEATURE_FLAGS.has(tokens[i - 1]));

function checkOf(checkCmd, { enter, manifest, packages, targets }, submodule) {
  const flags = String(checkCmd).trim().split(/\s+/).filter((t) => !WORKSPACE_FLAGS.has(t));
  const kept = submodule || manifest ? withoutFeatures(flags) : flags;
  const scope = [...(manifest ? [MANIFEST_PATH, manifest] : []), ...packages.flatMap((p) => ['-p', p]), ...new Set(['--lib', ...targets])];
  const features = kept.findIndex((t) => FEATURE_FLAGS.has(t));
  const at = features === -1 ? kept.length : features;
  return `${enter}${[...kept.slice(0, at), ...scope, ...kept.slice(at)].join(' ')}`;
}

export function narrowChecks(checkCmd, jobCommands, { submodule = false } = {}) {
  return wanted(jobCommands || [], submodule).map((group) => checkOf(checkCmd, group, submodule));
}
