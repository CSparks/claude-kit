// precheck-scope.mjs — the part of the workspace a job will build, checked first (KIT-D115 follow-up). The precheck's
// whole-workspace `cargo check --all-targets` can outlast its timeout on a big game, and a timed-out precheck lets the job
// queue with its compile error. The narrow check compiles only what the job's own cargo commands build: each named
// package's library plus the test binaries it names (or all its tests when it names none), so an error in a file the
// patch touches is found in seconds.
//
//   narrowCheck(checkCmd, jobCommands) -> a `cargo check` command, or null when the job's commands name no package
//     checkCmd: the configured whole-workspace check; its flags (--offline, --features …) are kept, --workspace and
//     --all-targets are replaced by `-p <crate> … --lib --test <name> …`.

const TEST_COMMAND = /^cargo\s+(?:test|t|nextest\s+run)(?:\s+(.*))?$/;
const WORKSPACE_FLAGS = new Set(['--workspace', '--all-targets', '--all']);
const PACKAGE = new Set(['-p', '--package']);
const TARGET_KIND = new Set(['--lib', '--bins', '--tests', '--examples', '--benches']);
const NAMED_TARGET =new Set(['--test', '--bin', '--example', '--bench']);

function cargoTest(command) {
  const m = TEST_COMMAND.exec(String(command).trim().replace(/^cd\s+\S+\s*&&\s*/, ''));
  if (!m) return null;
  const args = (m[1] || '').split(/\s+/).filter(Boolean);
  const end = args.indexOf('--');
  return end === -1 ? args : args.slice(0, end);
}

function wanted(commands) {
  const packages = [];
  const targets = [];
  for (const command of commands) {
    const args = cargoTest(command);
    if (!args) continue;
    const named = [];
    for (let i = 0; i < args.length; i++) {
      if (PACKAGE.has(args[i]) && args[i + 1]) { if (!packages.includes(args[i + 1])) packages.push(args[i + 1]); i++; }
      else if (NAMED_TARGET.has(args[i]) && args[i + 1]) named.push(`${args[i]} ${args[++i]}`);
      else if (TARGET_KIND.has(args[i])) named.push(args[i]);
    }
    targets.push(...(named.length ? named : ['--tests']));
  }
  return { packages, targets: [...new Set(targets)] };
}

export function narrowCheck(checkCmd, jobCommands) {
  const { packages, targets } = wanted(jobCommands || []);
  if (!packages.length) return null;
  const kept = String(checkCmd).trim().split(/\s+/).filter((t) => !WORKSPACE_FLAGS.has(t));
  const scope = [...packages.flatMap((p) => ['-p', p]), ...new Set(['--lib', ...targets])];
  const features = kept.findIndex((t) => t === '--features' || t === '-F');
  const at = features === -1 ? kept.length : features;
  return [...kept.slice(0, at), ...scope, ...kept.slice(at)].join(' ');
}
