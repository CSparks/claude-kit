// builds-run-usage.mjs — the one wording of a `builds --run` call's form, shared by the gate's refusal (source-shell-advice)
// and the launcher's own usage error (scripts/broker/detached-run.mjs).
//
//   LAUNCHER_USAGE    the form with placeholders
//   LAUNCHER_EXAMPLE  one call that passes: a cd and a filter inside the quotes, --out under the directory's target/
//   LAUNCHER_NOTES    the wrong turns agents make, one line each

export const LAUNCHER_USAGE = 'builds --run "<command>" --out <file> --timeout N --tool-timeout N';
export const LAUNCHER_EXAMPLE = 'builds --run "cd crates/foo && cargo test -p foo 2>&1 | tail -30" --out crates/foo/target/test.txt --timeout 170 --tool-timeout 180';
export const LAUNCHER_NOTES = [
  '--out is target/<file> relative to the directory you run in, or a file under the session scratchpad.',
  'A cd, a pipe and a redirect go INSIDE the quoted command; nothing follows the call. When it ends, read the --out file.',
];
