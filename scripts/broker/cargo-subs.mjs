// cargo-subs.mjs — which cargo subcommands compile (and so load the machine).
//
// `CARGO_BUILD_SUBS` — the build-shaped subcommands (and the project's `t`/`b`/`r` aliases).
// `GATED_SUBS` — those plus the compiling ones that take no `-j` of the broker's (ndk, doc, install, ...):
//   every one takes cores from the machine build budget (KIT-D135).
// `isCargoBuild(cmd)` → true when any `cargo <sub>` in the command string is gated,
//   `cd rust && cargo test -p x` included.

export const CARGO_BUILD_SUBS = new Set(['test', 'build', 'check', 'clippy', 'bench', 'nextest', 'run', 't', 'b', 'r']);

export const GATED_SUBS = new Set([...CARGO_BUILD_SUBS, 'ndk', 'doc', 'install', 'fix', 'rustc', 'rustdoc', 'miri']);

export function isCargoBuild(cmd) {
  const toks = String(cmd).trim().split(/\s+/);
  return toks.some((t, i) => t === 'cargo' && GATED_SUBS.has(toks[i + 1]));
}
