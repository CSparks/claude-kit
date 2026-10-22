// cargo-subs.mjs — which cargo subcommands compile (and so load the machine).
//
// `CARGO_BUILD_SUBS` — the build-shaped subcommands (and the project's `t`/`b`/`r` aliases).
// `isCargoBuild(cmd)` → true when any `cargo <sub>` in the command string is one of them,
//   `cd rust && cargo test -p x` included.

export const CARGO_BUILD_SUBS = new Set(['test', 'build', 'check', 'clippy', 'bench', 'nextest', 'run', 't', 'b', 'r']);

export function isCargoBuild(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  return toks.some((t, i) => t === 'cargo' && CARGO_BUILD_SUBS.has(toks[i + 1]));
}
